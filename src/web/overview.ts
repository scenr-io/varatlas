/* The overview's text and charts for the current selection: whole org, a group or a project. */

import type { OrgTree } from "@shared/types";
import { plural } from "./format";
import {
  isAncestorPath,
  posture,
  scopeCounts,
  summarizeKeys,
  type EffectiveRow,
  type Finding,
  type GroupStat,
  type KeySummary,
  type Posture,
} from "./insights";
import type { Selected } from "./tree";

export interface AtlasCopy {
  title: string;
  note: string;
  labels: { first: string; second: string };
}

export interface OverviewModel {
  headline: string;
  subline: string;
  stats: GroupStat[];
  atlas: AtlasCopy;
  posture: Posture;
  scopes: { scope: string; count: number }[];
  keys: KeySummary[];
}

/** True when `path` is part of the selection: below a group, or above (or at) a project. */
export function pathInSelection(selected: Selected | null, path: string): boolean {
  if (!selected || path === selected.path) return true;
  return selected.entity === "group"
    ? isAncestorPath(selected.path, path)
    : isAncestorPath(path, selected.path);
}

const TREE_COPY: AtlasCopy = {
  title: "Where variables are defined",
  note: "Variables on a group reach every project below it. Select a group to focus on it.",
  labels: { first: "Defined on the group, inherited below", second: "Defined in its subgroups and projects" },
};

const LINEAGE_COPY: AtlasCopy = {
  title: "Where this project's variables come from",
  note: "Each parent group passes its variables down. Nearer definitions replace inherited ones.",
  labels: { first: "Inherited from the group", second: "Defined on the project" },
};

export function buildOverview({
  tree,
  scoped,
  selected,
  findings,
  allStats,
}: {
  tree: OrgTree;
  /** rows in the selection; for a project, its effective rows */
  scoped: EffectiveRow[];
  selected: Selected | null;
  findings: Finding[];
  /** org-wide atlas statistics, computed once per snapshot */
  allStats: GroupStat[];
}): OverviewModel {
  const live = scoped.filter((r) => !r.overriddenBy);
  const places = new Set(live.map((r) => `${r.entity}:${r.entityId}`)).size;
  const attention = findings.length
    ? `${plural(findings.length, "finding")} to review.`
    : "Nothing needs attention.";

  let headline: string;
  let subline: string;
  if (!selected) {
    const total = tree.groups.length + tree.projects.length;
    headline = `${plural(live.length, "variable")} in ${places} of ${total} groups and projects`;
    subline = `${plural(new Set(live.map((r) => r.v.key)).size, "distinct key")}. ${attention}`;
  } else if (selected.entity === "group") {
    headline = `${plural(live.length, "variable")} in ${selected.name} and below`;
    subline = `Defined in ${plural(places, "place")} under ${selected.path}. ${attention}`;
  } else {
    const inherited = live.filter((r) => r.inheritedFrom);
    const groups = new Set(inherited.map((r) => r.inheritedFrom)).size;
    const replaced = scoped.length - live.length;
    headline = `${selected.name} receives ${plural(live.length, "variable")}`;
    subline =
      `${live.length - inherited.length} of its own and ${inherited.length} inherited from ` +
      plural(groups, "parent group") +
      (replaced
        ? `. ${plural(replaced, "inherited variable is", "inherited variables are")} replaced by nearer ones`
        : "") +
      `. ${attention}`;
  }

  let stats: GroupStat[];
  let atlas: AtlasCopy;
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
    atlas = LINEAGE_COPY;
  } else {
    stats = allStats.filter((s) => pathInSelection(selected, s.path));
    atlas = TREE_COPY;
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
}
