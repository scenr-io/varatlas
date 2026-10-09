import { useState } from "preact/hooks";
import { pct, plural, px } from "@/format";
import type { GroupStat } from "@/insights";
import type { AtlasCopy } from "@/overview";

/** What the readout says about one row. */
function describe(s: GroupStat): string {
  if (s.isProject) return `${s.path}: ${plural(s.inProjects, "variable")} defined on the project itself.`;
  if (s.inSubgroups + s.inProjects === 0) {
    return `${s.path}: ${plural(s.own, "variable")} on the group, inherited by ${plural(s.projects, "project")}.`;
  }
  return (
    `${s.path}: ${plural(s.own, "variable")} on the group, inherited by ${plural(s.projects, "project")}; ` +
    `${s.inSubgroups} more in subgroups and ${s.inProjects} in projects below it.`
  );
}

/**
 * The org hierarchy as bars on one baseline: for every group, variables defined on the
 * group itself (reaching every project below) versus further down the tree.
 */
export function Atlas({
  stats,
  labels,
  onSelect,
}: {
  stats: GroupStat[];
  labels: AtlasCopy["labels"];
  onSelect: (groupId: number) => void;
}) {
  const shown = stats.filter((s) => s.own + s.inSubgroups + s.inProjects > 0);
  const hidden = stats.length - shown.length;
  const [active, setActive] = useState<GroupStat | null>(null);

  const first = shown[0];
  if (!first) {
    return <p className="py-6 text-sm text-fg-2">No variables are defined in this part of the tree.</p>;
  }

  const max = Math.max(...shown.map((s) => s.own + s.inSubgroups + s.inProjects));
  const minDepth = Math.min(...shown.map((s) => s.depth));
  const readout = active ?? first;

  return (
    <div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-series-1" aria-hidden="true" />
          {labels.first}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-series-2" aria-hidden="true" />
          {labels.second}
        </span>
      </div>

      <p className="mt-3 min-h-[2.5rem] text-xs leading-relaxed text-fg-2" aria-live="polite">
        {describe(readout)}
      </p>

      <ul
        className="mt-2 max-h-[400px] overflow-y-auto overflow-x-hidden"
        aria-label="Variables per group"
        onPointerLeave={() => setActive(null)}
      >
        {shown.map((s) => {
          const below = s.inSubgroups + s.inProjects;
          const total = s.own + below;
          return (
            <li key={`${s.isProject ? "p" : "g"}${s.id}`}>
              <button
                onClick={() => !s.isProject && onSelect(s.id)}
                onPointerEnter={() => setActive(s)}
                onFocus={() => setActive(s)}
                className={`grid w-full grid-cols-[11rem_minmax(0,1fr)_2.25rem] items-center gap-3 rounded-md py-1 pl-2 pr-1 text-left transition-colors hover:bg-raised/60 ${
                  readout === s ? "bg-raised/40" : ""
                } ${s.isProject ? "cursor-default" : ""}`}
                aria-label={describe(s)}
              >
                <span
                  className={`truncate text-[13px] ${s.isProject ? "font-mono text-xs text-fg" : "text-fg-2"}`}
                  style={{ paddingLeft: px((s.depth - minDepth) * 12) }}
                >
                  {s.name}
                </span>
                <span className="flex h-5 items-center gap-[2px]" aria-hidden="true">
                  {s.own > 0 && (
                    <span
                      className={`h-2 bg-series-1 ${below === 0 ? "rounded-r" : ""}`}
                      style={{ width: pct(s.own, max) }}
                    />
                  )}
                  {below > 0 && (
                    <span className="h-2 rounded-r bg-series-2" style={{ width: pct(below, max) }} />
                  )}
                </span>
                <span className="text-right text-xs tabular-nums text-fg-2">{total}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <p className="mt-3 text-xs text-fg-3">
          {shown.some((s) => s.isProject)
            ? `${plural(hidden, "parent group passes", "parent groups pass")} nothing down.`
            : `${plural(hidden, "group without variables isn't", "groups without variables aren't")} shown.`}
        </p>
      )}
    </div>
  );
}
