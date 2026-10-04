
import { useMemo, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { ChevronRight, FolderGit2, Globe, LogOut, RefreshCw } from "lucide-preact";
import { ScenrCredit } from "@/components/ui/ScenrCredit";
import { buildGroupTree, type GroupNode } from "@/tree";
import type { EntityRef, GitLabUser, OrgTree } from "@shared/types";

export type Selection = EntityRef | null;

interface Props {
  tree: OrgTree | null;
  /** `${entity}:${id}` → number of variables defined directly on it */
  varCounts: Map<string, number>;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onRefresh: () => void;
  refreshing: boolean;
  user: GitLabUser | null;
  canLogout: boolean;
  onLogout: () => void;
}

const INDENT = 14;

function ActiveBar() {
  return (
    <span className="absolute left-0 top-1/2 h-[55%] w-[3px] -translate-y-1/2 rounded-full bg-accent" />
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-auto rounded-md bg-white/[0.07] px-1.5 font-mono text-[9.5px] font-bold text-white/40">
      {n}
    </span>
  );
}

const rowBase =
  "relative flex cursor-pointer items-center gap-1.5 rounded-lg py-[7px] pr-2 text-[12.5px] transition-colors";
const rowState = (active: boolean) =>
  active ? "bg-white/[0.07] text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/90";

export default function Sidebar({
  tree,
  varCounts,
  selection,
  onSelect,
  onRefresh,
  refreshing,
  user,
  canLogout,
  onLogout,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const roots = useMemo(() => (tree ? buildGroupTree(tree) : []), [tree]);

  const isActive = (entity: EntityRef["entity"], id: number) =>
    selection?.entity === entity && selection.id === id;

  function toggle(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderGroup(node: GroupNode, depth: number): ComponentChildren {
    const isCollapsed = collapsed.has(node.id);
    const active = isActive("group", node.id);
    const hasKids = node.children.length > 0 || node.projects.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`group ${rowBase} font-semibold ${rowState(active)}`}
          style={{ paddingLeft: `${8 + depth * INDENT}px` }}
          onClick={() => onSelect({ entity: "group", id: node.id })}
        >
          {active && <ActiveBar />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.id);
            }}
            className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded text-white/35 hover:text-white ${
              hasKids ? "" : "invisible"
            }`}
            aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
            aria-expanded={!isCollapsed}
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
          </button>
          <FolderGit2
            className={`h-3.5 w-3.5 flex-shrink-0 ${active ? "text-brand" : "text-white/30"}`}
          />
          <span className="truncate">{node.name}</span>
          <Count n={varCounts.get(`group:${node.id}`) ?? 0} />
        </div>
        {!isCollapsed && (
          <div>
            {node.children.map((c) => renderGroup(c, depth + 1))}
            {node.projects.map((p) => {
              const pActive = isActive("project", p.id);
              return (
                <div
                  key={p.id}
                  className={`${rowBase} font-medium ${rowState(pActive)}`}
                  style={{ paddingLeft: `${8 + (depth + 1) * INDENT + 20}px` }}
                  onClick={() => onSelect({ entity: "project", id: p.id })}
                >
                  {pActive && <ActiveBar />}
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      pActive ? "bg-brand" : "bg-white/20"
                    }`}
                  />
                  <span className="truncate">{p.name}</span>
                  <Count n={varCounts.get(`project:${p.id}`) ?? 0} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid-bg flex h-full flex-col bg-night-3">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-5">
        <span className="font-display text-[22px] leading-none text-white">varatlas</span>
        <ScenrCredit className="ml-auto text-white/30 hover:text-white/60" />
      </div>

      {/* All variables + refresh */}
      <div className="flex-shrink-0 px-3 pt-4">
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="font-mono text-[9px] font-bold tracking-[0.22em] text-white/30">
            <span className="text-brand">/</span> ORG TREE
          </p>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Re-sync from GitLab"
            aria-label="Re-sync from GitLab"
            className="rounded p-1 text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div
          className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${rowState(
            selection === null,
          )}`}
          onClick={() => onSelect(null)}
        >
          {selection === null && <ActiveBar />}
          <Globe className={`h-4 w-4 ${selection === null ? "text-brand" : ""}`} />
          All variables
        </div>
      </div>

      {/* Tree */}
      <nav className="mt-1 flex-1 overflow-y-auto px-3 pb-4" aria-label="Groups and projects">
        {tree === null ? (
          <div className="space-y-2 px-2 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-7 animate-pulse rounded-lg bg-white/[0.05]"
                style={{ width: `${85 - (i % 4) * 12}%` }}
              />
            ))}
          </div>
        ) : (
          roots.map((r) => renderGroup(r, 0))
        )}
      </nav>

      {/* User */}
      <div className="flex-shrink-0 border-t border-white/[0.07] px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-1">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="h-7 w-7 flex-shrink-0 rounded-full ring-1 ring-white/15"
            />
          ) : (
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {(user?.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">
              {user?.name || "Unknown user"}
            </p>
            <p className="truncate font-mono text-[10px] text-white/35">@{user?.username || ""}</p>
          </div>
          {canLogout && (
            <button
              onClick={onLogout}
              title="Disconnect token"
              aria-label="Disconnect token"
              className="ml-auto rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
