/* The key detail panel: every place one key is defined, side by side. */

import { Pencil, Plus, ShieldAlert, Trash2 } from "lucide-preact";
import { Chip } from "@/components/ui/Badge";
import { Button, iconButtonClass } from "@/components/ui/Button";
import { consistencySentence } from "@/components/ui/ConsistencyChip";
import { Drawer } from "@/components/ui/Drawer";
import { plural, scopePhrase } from "@/format";
import { isAncestorPath, type KeySummary } from "@/insights";
import type { Row } from "@/rows";
import type { OrgTree } from "@shared/types";
import { Settings } from "./Settings";
import { ValueCell } from "./ValueCell";

/** Paths of the projects that receive a variable defined on `row`'s group or project. */
function reachedProjects(tree: OrgTree, row: Row): string[] {
  if (row.entity === "project") return [row.path];
  return tree.projects.map((p) => p.path_with_namespace).filter((path) => isAncestorPath(row.path, path));
}

export function KeyDetail({
  summary,
  tree,
  onClose,
  onEdit,
  onDelete,
  onAdd,
  readOnly = false,
}: {
  summary: KeySummary;
  tree: OrgTree;
  onClose: () => void;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  onAdd: (key: string) => void;
  readOnly?: boolean;
}) {
  const rows = [...summary.rows].sort((a, b) => a.path.localeCompare(b.path));
  const totalReach = new Set(rows.flatMap((r) => reachedProjects(tree, r))).size;

  return (
    <Drawer
      titleId="key-title"
      wide
      onClose={onClose}
      title={<h2 className="break-all font-mono text-lg font-semibold text-fg">{summary.key}</h2>}
      subtitle={
        <>
          <p className="mt-1.5 text-sm text-fg-2">
            Defined in {plural(summary.locations, "place")}, reaching {plural(totalReach, "project")}.{" "}
            {summary.locations > 1 && consistencySentence(summary.values)}
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
        </>
      }
      footer={
        readOnly ? undefined : (
          <Button onClick={() => onAdd(summary.key)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add {summary.key} somewhere else
          </Button>
        )
      }
    >
      <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
        {rows.map((r) => {
          const reach = reachedProjects(tree, r).length;
          return (
            <li key={`${r.entity}:${r.entityId}:${r.v.environment_scope}`} className="py-4">
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
                      ? `Group variable, inherited by ${plural(reach, "project")}`
                      : "Project variable"}
                    , {scopePhrase(r.v.environment_scope)}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex flex-shrink-0 gap-0.5">
                    <button
                      onClick={() => onEdit(r)}
                      aria-label={`Edit ${summary.key} in ${r.path}`}
                      className={iconButtonClass()}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(r)}
                      aria-label={`Delete ${summary.key} from ${r.path}`}
                      className={iconButtonClass("danger")}
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
    </Drawer>
  );
}
