/*
 * Everything the UI derives from the org snapshot: findings, per-key summaries,
 * the variables a project actually receives, and per-group statistics.
 * Pure functions over rows, so they are easy to test.
 */

import type { EntityVariables, OrgTree } from "@shared/types";
import { rowId, type Row } from "./rows";
import { looksSecret } from "./secrets";

export { looksSecret };

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
  const byKey = new Map<string, Row[]>();
  for (const r of rows) byKey.set(r.v.key, [...(byKey.get(r.v.key) ?? []), r]);
  return [...byKey.entries()]
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
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.v.key}\u0000${r.v.environment_scope}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: { rows: Row[]; values: Consistency }[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const related = list.some((a) => list.some((b) => a !== b && isAncestorPath(a.path, b.path)));
    if (related) continue;
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

  const overrides = rows.filter((r) =>
    rows.some(
      (g) =>
        g.entity === "group" &&
        g.v.key === r.v.key &&
        isAncestorPath(g.path, r.path) &&
        scopesOverlap(g.v.environment_scope, r.v.environment_scope),
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
  const paths = new Set(tree.groups.map((g) => g.full_path));
  const topDepth = (path: string) => {
    let d = 0;
    let p = path;
    while (p.includes("/")) {
      p = p.slice(0, p.lastIndexOf("/"));
      if (paths.has(p)) d++;
    }
    return d;
  };
  return [...tree.groups]
    .sort((a, b) => a.full_path.localeCompare(b.full_path))
    .map((g) => {
      const below = (p: string) => p === g.full_path || isAncestorPath(g.full_path, p);
      return {
        id: g.id,
        name: g.name,
        path: g.full_path,
        depth: topDepth(g.full_path),
        own: rows.filter((r) => r.entity === "group" && r.path === g.full_path).length,
        inSubgroups: rows.filter(
          (r) => r.entity === "group" && r.path !== g.full_path && below(r.path),
        ).length,
        inProjects: rows.filter((r) => r.entity === "project" && below(r.path)).length,
        projects: tree.projects.filter((p) => below(p.path_with_namespace)).length,
      };
    });
}
