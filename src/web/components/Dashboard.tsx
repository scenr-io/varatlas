
import { useCallback, useMemo, useState } from "preact/hooks";
import { Loader2, Menu, Plus } from "lucide-preact";
import TokenGate from "@/components/auth/TokenGate";
import Sidebar, { type Selection } from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { AccessWarning } from "@/components/variables/AccessWarning";
import { DeleteDialog } from "@/components/variables/DeleteDialog";
import { FilterBar } from "@/components/variables/FilterBar";
import VariableDrawer, { type DrawerState } from "@/components/variables/VariableDrawer";
import { VariableTable } from "@/components/variables/VariableTable";
import { useOrgVariables } from "@/hooks/useOrgVariables";
import {
  distinctScopes,
  filterRows,
  keyLocationCounts,
  toRows,
  type AttrFilter,
  type LevelFilter,
  type Row,
} from "@/rows";
import type {
  EntityRef,
  GitLabVariable,
  OrgTree,
  VariableChanges,
  VariableDraft,
} from "@shared/types";

function pathOf(tree: OrgTree, ref: EntityRef): string | null {
  return ref.entity === "group"
    ? (tree.groups.find((g) => g.id === ref.id)?.full_path ?? null)
    : (tree.projects.find((p) => p.id === ref.id)?.path_with_namespace ?? null);
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

export default function Dashboard() {
  const toast = useToast();
  const org = useOrgVariables();
  const { auth, tree, entities } = org;

  const [selection, setSelection] = useState<Selection>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [attrs, setAttrs] = useState<Set<AttrFilter>>(new Set());
  const [scope, setScope] = useState("all");
  const [revealAll, setRevealAll] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /* ---------------- derived data ---------------- */

  const rows = useMemo(() => toRows(entities ?? []), [entities]);
  const keyLocations = useMemo(() => keyLocationCounts(rows), [rows]);
  const scopes = useMemo(() => distinctScopes(rows), [rows]);
  const errored = useMemo(() => (entities ?? []).filter((e) => e.error), [entities]);

  const varCounts = useMemo(
    () => new Map((entities ?? []).map((e) => [`${e.entity}:${e.id}`, e.variables.length])),
    [entities],
  );

  const selectionPath = useMemo(
    () => (selection && tree ? pathOf(tree, selection) : null),
    [selection, tree],
  );

  const filtered = useMemo(
    () =>
      filterRows(rows, {
        query,
        level,
        attrs,
        scope,
        selection:
          selection && selectionPath ? { entity: selection.entity, path: selectionPath } : null,
      }),
    [rows, query, level, attrs, scope, selection, selectionPath],
  );

  /* ---------------- actions ---------------- */

  function toggleAttr(a: AttrFilter) {
    setAttrs((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  function openCreate() {
    if (!tree) return;
    let target: EntityRef | null = selection;
    if (!target) {
      const g = tree.groups[0];
      const p = tree.projects[0];
      target = g ? { entity: "group", id: g.id } : p ? { entity: "project", id: p.id } : null;
    }
    if (!target) return;
    setDrawer({ mode: "create", target, targetPath: pathOf(tree, target) ?? "" });
  }

  function openEdit(r: Row) {
    setDrawer({
      mode: "edit",
      target: { entity: r.entity, id: r.entityId },
      targetPath: r.path,
      original: r.v,
    });
  }

  async function submitDrawer(target: EntityRef, draft: VariableDraft) {
    if (!drawer) return;
    setDrawerBusy(true);
    try {
      if (drawer.mode === "create") {
        await org.createVariable(target, draft);
        toast("ok", `Created ${draft.key}`);
      } else if (drawer.original) {
        const original = drawer.original;
        await org.updateVariable(drawer.target, original, changesFrom(original, draft));
        toast("ok", `Updated ${original.key}`);
      }
      setDrawer(null);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "Request failed");
    } finally {
      setDrawerBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await org.deleteVariable({ entity: deleting.entity, id: deleting.entityId }, deleting.v);
      toast("ok", `Deleted ${deleting.v.key}`);
      setDeleting(null);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const cancelDelete = useCallback(() => setDeleting(null), []);

  /* ---------------- render ---------------- */

  if (auth === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-night-3">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!auth.configured) {
    return <TokenGate baseUrl={auth.baseUrl} onConnected={org.start} />;
  }

  const loading = entities === null && !org.loadError;
  // With data on screen, a failed background refresh is shown in the header, not over the table.
  const blockingError = entities === null ? org.loadError : null;
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

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 flex-shrink-0 md:flex md:flex-col">{sidebar(setSelection)}</aside>

      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNav(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 w-72">
            {sidebar((s) => {
              setSelection(s);
              setMobileNav(false);
            })}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-black/[0.06] bg-paper/85 px-4 backdrop-blur-md md:px-8">
          <button
            onClick={() => setMobileNav(true)}
            className="rounded-md p-1.5 text-ink/50 hover:bg-black/5 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="hidden font-mono text-[10px] font-bold tracking-[0.2em] text-ink/35 md:block">
            <span className="text-accent">/</span>{" "}
            {selectionPath ? selectionPath.toUpperCase() : "ALL VARIABLES"}
          </p>
          <div className="ml-auto flex items-center gap-3">
            {entities && (
              <p className="hidden font-mono text-[10px] text-ink/35 lg:block">
                {rows.length} vars · {tree?.groups.length ?? 0} groups ·{" "}
                {tree?.projects.length ?? 0} projects
              </p>
            )}
            <SyncStatus
              syncedAt={org.syncedAt}
              refreshing={org.refreshing}
              error={entities ? org.loadError : null}
            />
            <button
              onClick={openCreate}
              disabled={!tree}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-accent-soft disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add variable
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-5 md:px-8">
          <AccessWarning errored={errored} />
          <FilterBar
            query={query}
            onQuery={setQuery}
            level={level}
            onLevel={setLevel}
            attrs={attrs}
            onToggleAttr={toggleAttr}
            scope={scope}
            scopes={scopes}
            onScope={setScope}
            revealAll={revealAll}
            onToggleReveal={() => setRevealAll((s) => !s)}
          />
          <VariableTable
            rows={filtered}
            loading={loading}
            loadError={blockingError}
            onRetry={org.start}
            keyLocations={keyLocations}
            revealAll={revealAll}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        </main>
      </div>

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
        <DeleteDialog
          row={deleting}
          busy={deleteBusy}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
