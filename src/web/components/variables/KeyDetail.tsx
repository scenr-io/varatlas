import { useEffect } from "preact/hooks";
import { Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-preact";
import { Chip } from "@/components/ui/Badge";
import type { KeySummary } from "@/insights";
import type { Row } from "@/rows";
import type { OrgTree } from "@shared/types";
import { Settings } from "./Settings";
import { ValueCell } from "./ValueCell";

const VALUES = {
  same: "Every copy holds the same value.",
  different: "The copies hold different values.",
  unreadable: "The values are hidden by GitLab, so they can't be compared.",
} as const;

/** Projects that receive a variable defined on `row`'s group or project. */
function reach(tree: OrgTree, row: Row): number {
  if (row.entity === "project") return 1;
  return tree.projects.filter((p) => p.path_with_namespace.startsWith(row.path + "/")).length;
}

/** Everything about one key across the org: every place it is defined, side by side. */
export function KeyDetail({
  summary,
  tree,
  onClose,
  onEdit,
  onDelete,
  onAdd,
  readOnly = false,
}: {
  readOnly?: boolean;
  summary: KeySummary;
  tree: OrgTree;
  onClose: () => void;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  onAdd: (key: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = [...summary.rows].sort((a, b) => a.path.localeCompare(b.path));
  const totalReach = new Set(
    rows.flatMap((r) =>
      r.entity === "project"
        ? [r.path]
        : tree.projects
            .filter((p) => p.path_with_namespace.startsWith(r.path + "/"))
            .map((p) => p.path_with_namespace),
    ),
  ).size;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-title"
        className="drawer-in relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-page shadow-2xl shadow-black/60"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 id="key-title" className="break-all font-mono text-lg font-semibold text-fg">
              {summary.key}
            </h2>
            <p className="mt-1.5 text-sm text-fg-2">
              Defined in {summary.locations} {summary.locations === 1 ? "place" : "places"}, reaching{" "}
              {totalReach} {totalReach === 1 ? "project" : "projects"}.{" "}
              {summary.locations > 1 && VALUES[summary.values]}
            </p>
            {summary.secret && !summary.maskedAll && (
              <p className="mt-2">
                <Chip tone="serious">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  {summary.locations > 1
                    ? "Looks like a secret but isn't masked everywhere"
                    : "Looks like a secret but isn't masked"}
                </Chip>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-fg-3 transition-colors hover:bg-surface hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
          {rows.map((r) => {
            const n = reach(tree, r);
            return (
              <li key={`${r.entity}:${r.entityId}:${r.v.environment_scope}`} className="group py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={`${r.web_url}/-/settings/ci_cd`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-mono text-[13px] text-fg hover:text-accent hover:underline"
                    >
                      {r.path}
                    </a>
                    <p className="mt-0.5 text-xs text-fg-3">
                      {r.entity === "group"
                        ? `Group variable, inherited by ${n} ${n === 1 ? "project" : "projects"}`
                        : "Project variable"}
                      {", "}
                      {r.v.environment_scope === "*"
                        ? "all environments"
                        : `environment ${r.v.environment_scope}`}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-shrink-0 gap-0.5">
                      <button
                        onClick={() => onEdit(r)}
                        aria-label={`Edit ${summary.key} in ${r.path}`}
                        className="rounded-md p-1.5 text-fg-3 transition-colors hover:bg-surface hover:text-fg"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(r)}
                        aria-label={`Delete ${summary.key} from ${r.path}`}
                        className="rounded-md p-1.5 text-fg-3 transition-colors hover:bg-critical/15 hover:text-critical"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 max-w-[260px]">
                    <ValueCell v={r.v} revealAll={false} />
                  </div>
                  <Settings v={r.v} />
                </div>
                {r.v.description && <p className="mt-2 text-xs text-fg-2">{r.v.description}</p>}
              </li>
            );
          })}
        </ul>

        {!readOnly && (
          <div className="border-t border-line px-6 py-4">
            <button
              onClick={() => onAdd(summary.key)}
              className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add {summary.key} somewhere else
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
