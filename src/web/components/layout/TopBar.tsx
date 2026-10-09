import { Menu, Plus } from "lucide-preact";
import { SyncStatus } from "./SyncStatus";

export type View = "overview" | "variables";

const VIEWS: [View, string][] = [
  ["overview", "Overview"],
  ["variables", "Variables"],
];

interface Props {
  view: View;
  onView: (v: View) => void;
  /** what the page is scoped to, e.g. "Whole org" or a group name */
  scopeName: string;
  scopePath: string | null;
  syncedAt: number | null;
  refreshing: boolean;
  refreshError: string | null;
  canAdd: boolean;
  /** read-only tokens can't add variables, so the button isn't offered */
  readOnly: boolean;
  onAdd: () => void;
  onMenu: () => void;
}

export function TopBar(p: Props) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-line px-4 md:px-8">
      <button
        onClick={p.onMenu}
        className="rounded-md p-1.5 text-fg-2 hover:bg-surface md:hidden"
        aria-label="Open groups and projects"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-semibold text-fg">{p.scopeName}</p>
        {p.scopePath && <p className="truncate font-mono text-[11px] text-fg-3">{p.scopePath}</p>}
      </div>

      <nav className="ml-2 flex items-center gap-1" aria-label="Views">
        {VIEWS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => p.onView(v)}
            aria-current={p.view === v ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              p.view === v ? "bg-raised font-medium text-fg" : "text-fg-2 hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <SyncStatus syncedAt={p.syncedAt} refreshing={p.refreshing} error={p.refreshError} />
        {!p.readOnly && (
          <button
            onClick={p.onAdd}
            disabled={!p.canAdd}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add variable</span>
          </button>
        )}
      </div>
    </header>
  );
}
