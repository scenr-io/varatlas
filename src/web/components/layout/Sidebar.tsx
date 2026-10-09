/* Left rail: the group and project tree to scope the views, plus account and project links. */

import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { Bug, ChevronRight, Code, FolderTree, LogOut, Package, RefreshCw } from "lucide-preact";
import { iconButtonClass } from "@/components/ui/Button";
import { ScenrCredit } from "@/components/ui/ScenrCredit";
import { NEW_ISSUE_URL, REPO_URL } from "@/links";
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
// Preact 11 does not append "px" to numeric style values.
const indent = (depth: number, extra = 0) => ({ paddingLeft: `${10 + depth * INDENT + extra}px` });

function Row({
  active,
  onClick,
  style,
  children,
}: {
  active: boolean;
  onClick: () => void;
  style?: Record<string, string>;
  children: ComponentChildren;
}) {
  return (
    <div
      role="treeitem"
      aria-selected={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      style={style}
      className={`relative flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-[13px] transition-colors ${
        active ? "bg-raised text-fg" : "text-fg-2 hover:bg-surface hover:text-fg"
      }`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />}
      {children}
    </div>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="ml-auto pl-2 text-xs tabular-nums text-fg-3">{n}</span>;
}

export function Sidebar({
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
    const open = !collapsed.has(node.id);
    const hasKids = node.children.length > 0 || node.projects.length > 0;
    return (
      <div key={node.id} role="group">
        <Row
          active={isActive("group", node.id)}
          onClick={() => onSelect({ entity: "group", id: node.id })}
          style={indent(depth)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.id);
            }}
            className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded text-fg-3 hover:text-fg ${
              hasKids ? "" : "invisible"
            }`}
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={open}
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
          <FolderTree className="h-3.5 w-3.5 flex-shrink-0 text-fg-3" aria-hidden="true" />
          <span className="truncate font-medium">{node.name}</span>
          <Count n={varCounts.get(`group:${node.id}`) ?? 0} />
        </Row>
        {open && (
          <div>
            {node.children.map((c) => renderGroup(c, depth + 1))}
            {node.projects.map((p) => (
              <Row
                key={p.id}
                active={isActive("project", p.id)}
                onClick={() => onSelect({ entity: "project", id: p.id })}
                style={indent(depth + 1, 20)}
              >
                <Package className="h-3.5 w-3.5 flex-shrink-0 text-fg-3" aria-hidden="true" />
                <span className="truncate">{p.name}</span>
                <Count n={varCounts.get(`project:${p.id}`) ?? 0} />
              </Row>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-line bg-page">
      <div className="flex h-14 flex-shrink-0 items-baseline justify-between px-5 pt-4">
        <span className="font-display text-[26px] leading-none text-fg">varatlas</span>
        <ScenrCredit />
      </div>

      <div className="flex flex-shrink-0 items-center justify-between px-5 pb-2 pt-3">
        <h2 className="text-xs font-medium text-fg-3">Groups and projects</h2>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Reload from GitLab"
          aria-label="Reload from GitLab"
          className="rounded p-1 text-fg-3 transition-colors hover:bg-surface hover:text-fg disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Groups and projects">
        <div role="tree">
          <Row active={selection === null} onClick={() => onSelect(null)} style={indent(0)}>
            <span className="font-medium">Whole org</span>
          </Row>
          {tree === null ? (
            <div className="space-y-2 px-2 pt-3" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-6" style={{ width: `${85 - (i % 4) * 12}%` }} />
              ))}
            </div>
          ) : (
            roots.map((r) => renderGroup(r, 0))
          )}
        </div>
      </nav>

      <div className="flex flex-shrink-0 items-center gap-4 border-t border-line px-5 py-2.5 text-xs">
        <a
          href={NEW_ISSUE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-fg-2 transition-colors hover:text-fg"
        >
          <Bug className="h-3.5 w-3.5" aria-hidden="true" />
          Report an issue
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-fg-3 transition-colors hover:text-fg"
        >
          <Code className="h-3.5 w-3.5" aria-hidden="true" />
          Source
        </a>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 border-t border-line px-5 py-3">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-7 w-7 flex-shrink-0 rounded-full" />
        ) : (
          <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold">
            {(user?.name || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight text-fg">
            {user?.name || "Unknown user"}
          </p>
          {user?.username && <p className="truncate font-mono text-[11px] text-fg-3">@{user.username}</p>}
        </div>
        {canLogout && (
          <button
            onClick={onLogout}
            title="Disconnect token"
            aria-label="Disconnect token"
            className={`ml-auto ${iconButtonClass()}`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
