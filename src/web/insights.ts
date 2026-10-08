/*
 * Everything the UI derives from the org snapshot: findings, per-key summaries,
 * the variables a project actually receives, and per-group statistics.
 * Pure functions over rows, so they are easy to test.
 */

import type { EntityVariables, OrgTree } from "@shared/types";
import { rowId, type Row } from "./rows";
import { looksSecret } from "./secrets";

/* ------------------------------------------------------------------ */
/* Inheritance helpers                                                 */
/* ------------------------------------------------------------------ */

/** True when `ancestor` is a parent group path of `path`. */
export function isAncestorPath(ancestor: string, path: string): boolean {
  return path.startsWith(ancestor + "/");
}

/** GitLab scopes overlap when equal or when either applies to every environment. */
export function scopesOverlap(a: string, b: string): boolean {
  return a === b || a === "*" || b === "*";
}

const depth = (path: string) => path.split("/").length;

/** Every parent path of `path`, nearest first: "a/b/c" → ["a/b", "a"]. */
export function parentPaths(path: string): string[] {
  const out: string[] = [];
  for (let i = path.lastIndexOf("/"); i > 0; i = path.lastIndexOf("/", i - 1)) out.push(path.slice(0, i));
  return out;
}

/** Group rows into lists by a key, appending in place (no copying per insert). */
function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Per-key summaries                                                   */
/* ------------------------------------------------------------------ */

type Consistency = "same" | "different" | "unreadable";

export interface KeySummary {
  key: string;
  rows: Row[];
  /** distinct groups/projects defining the key */
  locations: number;
  scopes: string[];
  /** do the readable values agree? */
  values: Consistency;
  maskedAll: boolean;
  protectedAll: boolean;
  secret: boolean;
}

function consistency(rows: Row[]): Consistency {
  const readable = rows.map((r) => r.v.value).filter((v): v is string => v !== null);
  if (readable.length === 0) return "unreadable";
  return new Set(readable).size === 1 ? "same" : "different";
}

export function summarizeKeys(rows: Row[]): KeySummary[] {
  return [...groupBy(rows, (r) => r.v.key).entries()]
    .map(([key, list]) => ({
      key,
      rows: list,
      locations: new Set(list.map((r) => `${r.entity}:${r.entityId}`)).size,
      scopes: [...new Set(list.map((r) => r.v.environment_scope))].sort(),
      values: consistency(list),
      maskedAll: list.every((r) => r.v.masked || r.v.hidden),
      protectedAll: list.every((r) => r.v.protected),
      secret: looksSecret(key),
    }))
    .sort((a, b) => b.locations - a.locations || a.key.localeCompare(b.key));
}

/* ------------------------------------------------------------------ */
/* Effective variables: what one project actually receives             */
/* ------------------------------------------------------------------ */

export interface EffectiveRow extends Row {
  /** group path this row is inherited from; absent for the project's own variables */
  inheritedFrom?: string;
  /** a nearer definition replaces this one in every environment */
  overriddenBy?: string;
  /** environments where a nearer definition replaces this one */
  overriddenIn?: string[];
}

/**
 * The project's own variables plus everything inherited from its parent groups.
 * Nearer definitions win: project, then the deepest group, up to the top group.
 */
export function effectiveRows(rows: Row[], projectPath: string): EffectiveRow[] {
  const own = rows.filter((r) => r.entity === "project" && r.path === projectPath);
  const inherited = rows.filter((r) => r.entity === "group" && isAncestorPath(r.path, projectPath));
  const all: EffectiveRow[] = [...own, ...inherited.map((r) => ({ ...r, inheritedFrom: r.path }))];

  return all
    .map((r) => {
      if (!r.inheritedFrom) return r;
      const nearer = all.filter(
        (o) =>
          o !== r &&
          o.v.key === r.v.key &&
          scopesOverlap(o.v.environment_scope, r.v.environment_scope) &&
          (o.entity === "project" || depth(o.path) > depth(r.path)),
      );
      const full = nearer.find(
        (o) => o.v.environment_scope === r.v.environment_scope || o.v.environment_scope === "*",
      );
      if (full) return { ...r, overriddenBy: full.path };
      if (nearer.length) return { ...r, overriddenIn: nearer.map((o) => o.v.environment_scope) };
      return r;
    })
    .sort(
      (a, b) =>
        a.v.key.localeCompare(b.v.key) ||
        Number(!!a.inheritedFrom) - Number(!!b.inheritedFrom) ||
        depth(b.path) - depth(a.path),
    );
}

/** The rows a selection covers: everything below a group, or what a project receives. */
export function rowsInScope(
  rows: Row[],
  scope: { entity: "group" | "project"; path: string } | null,
): EffectiveRow[] {
  if (!scope) return rows;
  if (scope.entity === "project") return effectiveRows(rows, scope.path);
  return rows.filter((r) => r.path === scope.path || isAncestorPath(scope.path, r.path));
}

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

export type Severity = "serious" | "warning" | "info";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** the variables this finding is about */
  rowIds: Set<string>;
  /** headline count and its unit, e.g. 3 "variables" */
  count: number;
  unit: string;
  /** places involved when there are no rows to show, e.g. unreadable projects */
  paths?: string[];
}

/** (key, scope) pairs defined in more than one place that don't inherit from each other. */
function unrelatedCopies(rows: Row[]) {
  const out: { rows: Row[]; values: Consistency }[] = [];
  for (const list of groupBy(rows, (r) => `${r.v.key}\u0000${r.v.environment_scope}`).values()) {
    if (list.length < 2) continue;
    // Related copies (one inherits from another) are overrides, not duplicates.
    const paths = new Set(list.map((r) => r.path));
    if (list.some((r) => parentPaths(r.path).some((p) => paths.has(p)))) continue;
    out.push({ rows: list, values: consistency(list) });
  }
  return out;
}

export function findFindings(rows: Row[], entities: EntityVariables[]): Finding[] {
  const ids = (list: Row[]) => new Set(list.map(rowId));
  const findings: Finding[] = [];

  const secrets = rows.filter((r) => looksSecret(r.v.key));

  const unmasked = secrets.filter((r) => !r.v.masked && !r.v.hidden);
  findings.push({
    id: "unmasked-secrets",
    severity: "serious",
    title: "Secrets that aren't masked",
    detail: "Their values can show up in job logs. Mark them masked, or masked and hidden.",
    rowIds: ids(unmasked),
    count: unmasked.length,
    unit: unmasked.length === 1 ? "variable" : "variables",
  });

  const unprotected = secrets.filter((r) => !r.v.protected);
  findings.push({
    id: "unprotected-secrets",
    severity: "warning",
    title: "Secrets available on every branch",
    detail:
      "Unprotected variables reach pipelines on any branch, including merge requests. Protect them unless feature branches need them.",
    rowIds: ids(unprotected),
    count: unprotected.length,
    unit: unprotected.length === 1 ? "variable" : "variables",
  });

  const copies = unrelatedCopies(rows);
  const drift = copies.filter((c) => c.values === "different");
  findings.push({
    id: "drift",
    severity: "warning",
    title: "Same key, different values",
    detail:
      "The same key and environment hold different values in unrelated places. Check they're meant to differ.",
    rowIds: ids(drift.flatMap((c) => c.rows)),
    count: drift.length,
    unit: drift.length === 1 ? "key" : "keys",
  });

  const unreadable = entities.filter((e) => e.error);
  findings.push({
    id: "unreadable",
    severity: "warning",
    title: "Places varatlas can't read",
    detail: "Reading variables needs the Maintainer role. Anything defined here is missing from every view.",
    rowIds: new Set(),
    count: unreadable.length,
    unit: unreadable.length === 1 ? "group or project" : "groups and projects",
    paths: unreadable.map((e) => e.path),
  });

  const shared = copies.filter((c) => c.values === "same");
  findings.push({
    id: "copies",
    severity: "info",
    title: "Copies that could be shared",
    detail:
      "Identical values defined separately. Defining them once on a common parent group keeps them in sync.",
    rowIds: ids(shared.flatMap((c) => c.rows)),
    count: shared.length,
    unit: shared.length === 1 ? "key" : "keys",
  });

  const groupRowsByKey = groupBy(
    rows.filter((r) => r.entity === "group"),
    (r) => r.v.key,
  );
  const overrides = rows.filter((r) =>
    (groupRowsByKey.get(r.v.key) ?? []).some(
      (g) => isAncestorPath(g.path, r.path) && scopesOverlap(g.v.environment_scope, r.v.environment_scope),
    ),
  );
  findings.push({
    id: "overrides",
    severity: "info",
    title: "Group variables overridden further down",
    detail:
      "A subgroup or project redefines a variable it would otherwise inherit. Intended overrides are fine; accidental ones cause surprises.",
    rowIds: ids(overrides),
    count: overrides.length,
    unit: overrides.length === 1 ? "override" : "overrides",
  });

  return findings.filter((f) => f.count > 0);
}

/* ------------------------------------------------------------------ */
/* Statistics for the overview                                         */
/* ------------------------------------------------------------------ */

export interface Posture {
  total: number;
  masked: number;
  protected: number;
  hidden: number;
  file: number;
}

export function posture(rows: Row[]): Posture {
  return {
    total: rows.length,
    masked: rows.filter((r) => r.v.masked || r.v.hidden).length,
    protected: rows.filter((r) => r.v.protected).length,
    hidden: rows.filter((r) => r.v.hidden).length,
    file: rows.filter((r) => r.v.variable_type === "file").length,
  };
}

export function scopeCounts(rows: Row[]): { scope: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.v.environment_scope, (m.get(r.v.environment_scope) ?? 0) + 1);
  return [...m.entries()]
    .map(([scope, count]) => ({ scope, count }))
    .sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));
}

export interface GroupStat {
  id: number;
  name: string;
  path: string;
  depth: number;
  /** variables defined on this group itself (inherited by everything below) */
  own: number;
  /** variables defined on subgroups below it */
  inSubgroups: number;
  /** variables defined on projects anywhere below it */
  inProjects: number;
  /** projects that inherit this group's own variables */
  projects: number;
  /** a project row in a lineage view (a project and the groups above it) */
  isProject?: boolean;
}

/** Per-group totals for the atlas, in tree order (parents before children). */
export function groupStats(tree: OrgTree, rows: Row[]): GroupStat[] {
  const stats = new Map<string, GroupStat>();
  for (const g of [...tree.groups].sort((a, b) => a.full_path.localeCompare(b.full_path))) {
    stats.set(g.full_path, {
      id: g.id,
      name: g.name,
      path: g.full_path,
      depth: 0,
      own: 0,
      inSubgroups: 0,
      inProjects: 0,
      projects: 0,
    });
  }

  // Visible parent groups of a path, cached: many variables share a path.
  const cache = new Map<string, GroupStat[]>();
  const parentsOf = (path: string) => {
    let found = cache.get(path);
    if (!found) {
      found = parentPaths(path)
        .map((p) => stats.get(p))
        .filter((s): s is GroupStat => s !== undefined);
      cache.set(path, found);
    }
    return found;
  };

  // One pass: credit each variable and project to every group above it.
  for (const s of stats.values()) s.depth = parentsOf(s.path).length;
  for (const r of rows) {
    if (r.entity === "group") {
      const self = stats.get(r.path);
      if (self) self.own++;
      for (const s of parentsOf(r.path)) s.inSubgroups++;
    } else {
      for (const s of parentsOf(r.path)) s.inProjects++;
    }
  }
  for (const p of tree.projects) for (const s of parentsOf(p.path_with_namespace)) s.projects++;

  return [...stats.values()];
}
