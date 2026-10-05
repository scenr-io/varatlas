import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { Loader2, Plus } from "lucide-preact";
import { accessState } from "@/access";
import { AccessBanner } from "@/components/access/AccessBanner";
import {
  AccessProblem,
  AccessScreen,
  CheckAgain,
  checksFor,
  CreateTokenLink,
  EnvTokenFix,
  SecondaryButton,
} from "@/components/access/AccessProblem";
import TokenGate from "@/components/auth/TokenGate";
import Sidebar, { type Selection } from "@/components/layout/Sidebar";
import { TopBar, type View } from "@/components/layout/TopBar";
import { Overview } from "@/components/overview/Overview";
import { useToast } from "@/components/ui/Toast";
import { DeleteDialog } from "@/components/variables/DeleteDialog";
import { FilterBar, type Mode } from "@/components/variables/FilterBar";
import { KeyDetail } from "@/components/variables/KeyDetail";
import { KeyTable } from "@/components/variables/KeyTable";
import VariableDrawer, { type DrawerState } from "@/components/variables/VariableDrawer";
import { VariableTable } from "@/components/variables/VariableTable";
import { useOrgVariables } from "@/hooks/useOrgVariables";
import {
  findFindings,
  groupStats,
  isAncestorPath,
  posture,
  rowsInScope,
  scopeCounts,
  summarizeKeys,
  type Finding,
  type GroupStat,
} from "@/insights";
import { distinctScopes, filterRows, rowId, toRows, type AttrFilter, type LevelFilter, type Row } from "@/rows";
import type { EntityRef, GitLabVariable, OrgTree, VariableChanges, VariableDraft } from "@shared/types";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function lookup(tree: OrgTree, ref: EntityRef) {
  if (ref.entity === "group") {
    const g = tree.groups.find((x) => x.id === ref.id);
    return g ? { ...ref, path: g.full_path, name: g.name } : null;
  }
  const p = tree.projects.find((x) => x.id === ref.id);
  return p ? { ...ref, path: p.path_with_namespace, name: p.name } : null;
}

/** Edit-mode changes. An empty value on a hidden variable means "keep the current value". */
function changesFrom(original: GitLabVariable, draft: VariableDraft): VariableChanges {
  const changes: VariableChanges = {
    variable_type: draft.variable_type,
    protected: draft.protected,
    masked: draft.masked,
    raw: draft.raw,
    environment_scope: draft.environment_scope,
    description: draft.description ?? "",
  };
  if (!(original.hidden && draft.value === "")) changes.value = draft.value;
  return changes;
}

const KEY_UNITS = new Set(["drift", "copies"]);

/** Narrow an org-wide finding to the variables (or places) in the current view. */
function scopeFinding(f: Finding, inView: Map<string, Row>, pathInView: (p: string) => boolean): Finding {
  if (f.paths) {
    const paths = f.paths.filter(pathInView);
    return { ...f, paths, count: paths.length };
  }
  const ids = new Set([...f.rowIds].filter((id) => inView.has(id)));
  const count = KEY_UNITS.has(f.id) ? new Set([...ids].map((id) => inView.get(id)!.v.key)).size : ids.size;
  return { ...f, rowIds: ids, count };
}

export default function Dashboard() {
  const toast = useToast();
  const org = useOrgVariables();
  const { auth, tree, entities } = org;

  const [view, setView] = useState<View>(() => (location.hash === "#variables" ? "variables" : "overview"));
  const [mode, setMode] = useState<Mode>("location");
  const [selection, setSelection] = useState<Selection>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [attrs, setAttrs] = useState<Set<AttrFilter>>(new Set());
  const [scope, setScope] = useState("all");
  const [finding, setFinding] = useState<Finding | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    history.replaceState(null, "", `#${view}`);
  }, [view]);

  /* ---------------- what's in view ---------------- */

  const rows = useMemo(() => toRows(entities ?? []), [entities]);
  const allKeys = useMemo(() => summarizeKeys(rows), [rows]);
  const keyLocations = useMemo(() => new Map(allKeys.map((k) => [k.key, k.locations])), [allKeys]);
  const varCounts = useMemo(
    () => new Map((entities ?? []).map((e) => [`${e.entity}:${e.id}`, e.variables.length])),
    [entities],
  );

  const selected = useMemo(() => (selection && tree ? lookup(tree, selection) : null), [selection, tree]);

  const scoped = useMemo(() => rowsInScope(rows, selected), [rows, selected]);

  const pathInView = useCallback(
    (p: string) =>
      !selected ||
      p === selected.path ||
      (selected.entity === "group" ? isAncestorPath(selected.path, p) : isAncestorPath(p, selected.path)),
    [selected],
  );

  // Org-wide results are computed once per snapshot; a selection only narrows them.
  const allFindings = useMemo(() => findFindings(rows, entities ?? []), [rows, entities]);
  const allStats = useMemo(() => (tree ? groupStats(tree, rows) : []), [tree, rows]);

  const findings = useMemo(() => {
    const inView = new Map(scoped.filter((r) => !r.overriddenBy).map((r) => [rowId(r), r as Row]));
    return allFindings.map((f) => scopeFinding(f, inView, pathInView)).filter((f) => f.count > 0);
  }, [allFindings, scoped, pathInView]);

  const filtered = useMemo(
    () =>
      filterRows(scoped, {
        query,
        level: selected?.entity === "project" ? "all" : level,
        attrs,
        scope,
        ids: finding?.rowIds ?? null,
      }),
    [scoped, query, level, attrs, scope, finding, selected],
  );

  const keysInView = useMemo(() => {
    const keys = new Set(filtered.map((r) => r.v.key));
    return allKeys.filter((k) => keys.has(k.key));
  }, [filtered, allKeys]);

  const overview = useMemo(() => {
    if (!tree || !entities) return null;
    const live = scoped.filter((r) => !r.overriddenBy);
    const places = new Set(live.map((r) => `${r.entity}:${r.entityId}`)).size;
    const attention = findings.length ? `${plural(findings.length, "finding")} to review.` : "Nothing needs attention.";
    let headline: string;
    let subline: string;
    if (!selected) {
      const total = tree.groups.length + tree.projects.length;
      headline = `${plural(live.length, "variable")} in ${places} of ${total} groups and projects`;
      subline = `${plural(new Set(live.map((r) => r.v.key)).size, "distinct key")}. ${attention}`;
    } else if (selected.entity === "group") {
      headline = `${plural(live.length, "variable")} in ${selected.name} and below`;
      subline = `Defined in ${places} ${places === 1 ? "place" : "places"} under ${selected.path}. ${attention}`;
    } else {
      const inherited = live.filter((r) => r.inheritedFrom);
      const groups = new Set(inherited.map((r) => r.inheritedFrom)).size;
      const replaced = scoped.length - live.length;
      headline = `${selected.name} receives ${plural(live.length, "variable")}`;
      subline =
        `${live.length - inherited.length} of its own and ${inherited.length} inherited from ${plural(groups, "parent group")}` +
        (replaced ? `. ${plural(replaced, "inherited variable is", "inherited variables are")} replaced by nearer ones` : "") +
        `. ${attention}`;
    }
    let stats: GroupStat[];
    let atlas;
    if (selected?.entity === "project") {
      // Lineage: what the project gets from each parent group, and what it defines itself.
      const ancestors = allStats.filter((s) => isAncestorPath(s.path, selected.path));
      stats = [
        ...ancestors.map((s) => ({
          ...s,
          own: live.filter((r) => r.inheritedFrom === s.path).length,
          inSubgroups: 0,
          inProjects: 0,
        })),
        {
          id: selected.id,
          name: selected.name,
          path: selected.path,
          depth: ancestors.length,
          own: 0,
          inSubgroups: 0,
          inProjects: live.filter((r) => !r.inheritedFrom).length,
          projects: 1,
          isProject: true,
        },
      ];
      atlas = {
        title: "Where this project's variables come from",
        note: "Each parent group passes its variables down. Nearer definitions replace inherited ones.",
        labels: { first: "Inherited from the group", second: "Defined on the project" },
      };
    } else {
      stats = allStats.filter(
        (s) => !selected || s.path === selected.path || isAncestorPath(selected.path, s.path),
      );
      atlas = {
        title: "Where variables are defined",
        note: "Variables on a group reach every project below it. Select a group to focus on it.",
        labels: { first: "Defined on the group, inherited below", second: "Defined in its subgroups and projects" },
      };
    }
    return {
      headline,
      subline,
      stats,
      atlas,
      posture: posture(live),
      scopes: scopeCounts(live),
      keys: summarizeKeys(live),
    };
  }, [tree, entities, allStats, scoped, selected, findings]);

  /* ---------------- actions ---------------- */

  function clearFilters() {
    setQuery("");
    setAttrs(new Set());
    setScope("all");
    setLevel("all");
    setFinding(null);
  }

  function openFinding(f: Finding) {
    clearFilters();
    setFinding(f);
    setMode("location");
    setView("variables");
  }

  function toggleAttr(a: AttrFilter) {
    setAttrs((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  function openCreate(key?: string) {
    if (!tree) return;
    const fallback = tree.groups[0]
      ? { entity: "group" as const, id: tree.groups[0].id }
      : tree.projects[0]
        ? { entity: "project" as const, id: tree.projects[0].id }
        : null;
    const target = selection ?? fallback;
    if (!target) return;
    setDrawer({ mode: "create", target, targetPath: lookup(tree, target)?.path ?? "", key });
  }

  function openEdit(r: Row) {
    setDrawer({ mode: "edit", target: { entity: r.entity, id: r.entityId }, targetPath: r.path, original: r.v });
  }

  async function submitDrawer(target: EntityRef, draft: VariableDraft) {
    if (!drawer) return;
    setDrawerBusy(true);
    try {
      if (drawer.mode === "create") {
        await org.createVariable(target, draft);
        toast("ok", `Added ${draft.key} to ${tree ? lookup(tree, target)?.path : "GitLab"}`);
      } else if (drawer.original) {
        const original = drawer.original;
        await org.updateVariable(drawer.target, original, changesFrom(original, draft));
        toast("ok", `Saved ${original.key} in ${drawer.targetPath}`);
      }
      setDrawer(null);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "GitLab rejected the change");
    } finally {
      setDrawerBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await org.deleteVariable({ entity: deleting.entity, id: deleting.entityId }, deleting.v);
      toast("ok", `Deleted ${deleting.v.key} from ${deleting.path}`);
      setDeleting(null);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "GitLab rejected the deletion");
    } finally {
      setDeleteBusy(false);
    }
  }

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const cancelDelete = useCallback(() => setDeleting(null), []);
  const closeKey = useCallback(() => setOpenKey(null), []);

  /* ---------------- render ---------------- */

  if (auth === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-page">
        <Loader2 className="h-6 w-6 animate-spin text-fg-3" aria-label="Loading" />
      </div>
    );
  }

  if (!auth.configured) {
    const host = new URL(auth.baseUrl).host;
    const fromEnv = auth.source === "env";

    if (auth.problem === "unreachable") {
      return (
        <AccessScreen>
          <AccessProblem title={`Can't reach GitLab at ${host}`} actions={<CheckAgain onClick={org.start} />}>
            <p>
              varatlas couldn't connect to GitLab, so it can't check your token yet. Make sure{" "}
              <span className="font-mono text-fg">GITLAB_BASE_URL</span> points at your GitLab, and that this
              machine can reach it (VPN, proxy or firewall).
            </p>
          </AccessProblem>
        </AccessScreen>
      );
    }

    if (auth.problem === "invalid" && fromEnv) {
      return (
        <AccessScreen>
          <AccessProblem
            title="GitLab refused the server's token"
            checks={checksFor(auth, "accepted")}
            actions={
              <>
                <CreateTokenLink baseUrl={auth.baseUrl} />
                <CheckAgain onClick={org.start} />
              </>
            }
          >
            <p>It may have expired, been revoked, or been copied incompletely.</p>
            <EnvTokenFix />
          </AccessProblem>
        </AccessScreen>
      );
    }

    if (auth.problem === "scope") {
      return (
        <AccessScreen>
          <AccessProblem
            title="This token can't read CI/CD variables"
            checks={checksFor(auth, "read")}
            actions={
              <>
                <CreateTokenLink baseUrl={auth.baseUrl} />
                {fromEnv ? (
                  <CheckAgain onClick={org.start} />
                ) : (
                  <SecondaryButton onClick={org.disconnect}>Use a different token</SecondaryButton>
                )}
              </>
            }
          >
            <p>
              GitLab accepts it, but not for CI/CD variables. Create a token with the{" "}
              <span className="font-mono text-fg">api</span> scope to browse and edit, or{" "}
              <span className="font-mono text-fg">read_api</span> to browse only.
            </p>
            {fromEnv && <EnvTokenFix />}
          </AccessProblem>
        </AccessScreen>
      );
    }

    return (
      <TokenGate
        baseUrl={auth.baseUrl}
        onConnected={org.start}
        notice={
          auth.problem === "invalid"
            ? "GitLab refused your saved token, so it was removed. It may have expired or been revoked. Paste a new one to continue."
            : undefined
        }
      />
    );
  }

  const access = accessState(auth, entities);
  const readOnly = access.kind === "ok" && access.readOnly;
  const otherToken =
    auth.source === "cookie" ? (
      <SecondaryButton onClick={org.disconnect}>Use a different token</SecondaryButton>
    ) : null;
  const blocked =
    access.kind === "no-role" ? (
      <AccessProblem
        title="Your account can't read CI/CD variables here"
        checks={checksFor(auth, "role")}
        paths={access.paths}
        actions={
          <>
            <CheckAgain onClick={org.refresh} />
            {otherToken}
          </>
        }
      >
        <p>
          You can see {plural(access.paths.length, "group or project", "groups and projects")}, but GitLab only shows
          CI/CD variables to Maintainers and Owners, and your role is lower in all of them.
        </p>
        <p>Ask an Owner to make you a Maintainer, or connect a token from an account that already is one.</p>
        {auth.source === "env" && <EnvTokenFix />}
      </AccessProblem>
    ) : access.kind === "no-groups" ? (
      <AccessProblem
        title="This account isn't in any groups"
        checks={checksFor(auth, "groups")}
        actions={
          <>
            <CheckAgain onClick={org.refresh} />
            {otherToken}
          </>
        }
      >
        <p>
          varatlas starts from the groups your account belongs to on {new URL(auth.baseUrl).host}, and this account
          has none. Join a group, or connect a token from an account that is a member of one.
        </p>
      </AccessProblem>
    ) : null;

  const loading = entities === null && !org.loadError;
  const blockingError = entities === null ? org.loadError : null;
  const keySummary = openKey ? allKeys.find((k) => k.key === openKey) : undefined;
  const filtersActive = !!(query || attrs.size || scope !== "all" || level !== "all" || finding);

  const sidebar = (onPick: (s: Selection) => void) => (
    <Sidebar
      tree={tree}
      varCounts={varCounts}
      selection={selection}
      onSelect={onPick}
      onRefresh={org.refresh}
      refreshing={org.refreshing}
      user={auth.user ?? null}
      canLogout={auth.source === "cookie"}
      onLogout={org.disconnect}
    />
  );

  const empty = filtersActive ? (
    <>
      <p className="font-medium text-fg">No variables match these filters</p>
      <button
        onClick={clearFilters}
        className="mt-4 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-fg hover:bg-raised"
      >
        Clear filters
      </button>
    </>
  ) : (
    <>
      <p className="font-medium text-fg">No variables here yet</p>
      <p className="mt-1 text-sm text-fg-2">Variables you add to this group or project show up here.</p>
      {!readOnly && (
      <button
        onClick={() => openCreate()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add variable
      </button>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <aside className="hidden w-72 flex-shrink-0 md:flex md:flex-col">{sidebar(setSelection)}</aside>

      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <aside className="absolute bottom-0 left-0 top-0 w-72">
            {sidebar((s) => {
              setSelection(s);
              setMobileNav(false);
            })}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          view={view}
          onView={setView}
          scopeName={selected ? selected.name : "Whole org"}
          scopePath={selected?.path ?? null}
          syncedAt={org.syncedAt}
          refreshing={org.refreshing}
          refreshError={entities ? org.loadError : null}
          canAdd={!!tree && !blocked}
          readOnly={readOnly}
          onAdd={() => openCreate()}
          onMenu={() => setMobileNav(true)}
        />

        {access.kind === "ok" && (
          <AccessBanner readOnly={access.readOnly} expiresInDays={access.expiresInDays} baseUrl={auth.baseUrl} />
        )}

        {blocked ? (
          <main className="flex-1 overflow-y-auto px-4 py-10 md:px-8">{blocked}</main>
        ) : view === "overview" ? (
          <main className="flex-1 overflow-y-auto">
            {overview ? (
              <Overview
                {...overview}
                findings={findings}
                onFinding={openFinding}
                onGroup={(id) => setSelection({ entity: "group", id })}
                onScope={(s) => {
                  clearFilters();
                  setScope(s);
                  setView("variables");
                }}
                onKey={setOpenKey}
              />
            ) : (
              <VariableTable
                rows={[]}
                loading={loading}
                loadError={blockingError}
                onRetry={org.start}
                keyLocations={keyLocations}
                revealAll={false}
                onOpenKey={setOpenKey}
                onEdit={openEdit}
                onDelete={setDeleting}
                empty={empty}
              />
            )}
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-5 md:px-8">
            <FilterBar
              mode={mode}
              onMode={setMode}
              query={query}
              onQuery={setQuery}
              showLevel={selected?.entity !== "project"}
              level={level}
              onLevel={setLevel}
              attrs={attrs}
              onToggleAttr={toggleAttr}
              scope={scope}
              scopes={distinctScopes(scoped)}
              onScope={setScope}
              revealAll={revealAll}
              onToggleReveal={() => setRevealAll((s) => !s)}
              finding={finding?.title ?? null}
              onClearFinding={() => setFinding(null)}
            />
            {entities && (
              <p className="-mb-1 text-xs text-fg-3">
                {mode === "location"
                  ? `Showing ${filtered.length} of ${plural(scoped.length, "variable")}`
                  : `Showing ${plural(keysInView.length, "key")}`}
                {selected?.entity === "project" && ", including what this project inherits"}
              </p>
            )}
            {mode === "location" || loading || blockingError ? (
              <VariableTable
                rows={filtered}
                loading={loading}
                loadError={blockingError}
                onRetry={org.start}
                keyLocations={keyLocations}
                revealAll={revealAll}
                onOpenKey={setOpenKey}
                onEdit={openEdit}
                onDelete={setDeleting}
                empty={empty}
                readOnly={readOnly}
              />
            ) : (
              <KeyTable keys={keysInView} onOpen={setOpenKey} empty={empty} />
            )}
          </main>
        )}
      </div>

      {keySummary && tree && (
        <KeyDetail
          summary={keySummary}
          tree={tree}
          onClose={closeKey}
          onEdit={openEdit}
          onDelete={setDeleting}
          onAdd={(key) => openCreate(key)}
          readOnly={readOnly}
        />
      )}

      {drawer && tree && (
        <VariableDrawer
          state={drawer}
          tree={tree}
          busy={drawerBusy}
          onClose={closeDrawer}
          onSubmit={submitDrawer}
        />
      )}

      {deleting && (
        <DeleteDialog row={deleting} busy={deleteBusy} onCancel={cancelDelete} onConfirm={confirmDelete} />
      )}
    </div>
  );
}
