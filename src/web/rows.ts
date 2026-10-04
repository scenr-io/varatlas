/* Flat row model for the variables table, plus pure filtering helpers. */

import type { EntityType, EntityVariables, GitLabVariable } from "@shared/types";

export interface Row {
  entity: EntityType;
  entityId: number;
  path: string;
  web_url: string;
  v: GitLabVariable;
}

export type LevelFilter = "all" | EntityType;
export type AttrFilter = "protected" | "masked" | "file";

export interface Filters {
  query: string;
  level: LevelFilter;
  attrs: ReadonlySet<AttrFilter>;
  /** environment scope, or "all" */
  scope: string;
  /** limit to one group (and everything below it) or one project */
  selection: { entity: EntityType; path: string } | null;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  level: "all",
  attrs: new Set(),
  scope: "all",
  selection: null,
};

export function rowId(r: Row): string {
  return `${r.entity}:${r.entityId}:${r.v.key}:${r.v.environment_scope}`;
}

export function toRows(entities: EntityVariables[]): Row[] {
  return entities.flatMap((e) =>
    e.variables.map((v) => ({
      entity: e.entity,
      entityId: e.id,
      path: e.path,
      web_url: e.web_url,
      v,
    })),
  );
}

/**
 * For each key, the number of distinct groups/projects defining it. The same
 * key in several environment scopes of one project counts once.
 */
export function keyLocationCounts(rows: Row[]): Map<string, number> {
  const locations = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = locations.get(r.v.key) ?? new Set<string>();
    set.add(`${r.entity}:${r.entityId}`);
    locations.set(r.v.key, set);
  }
  return new Map([...locations].map(([key, set]) => [key, set.size]));
}

export function distinctScopes(rows: Row[]): string[] {
  return [...new Set(rows.map((r) => r.v.environment_scope))].sort();
}

export function filterRows(rows: Row[], f: Filters): Row[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.selection) {
      const { entity, path } = f.selection;
      if (entity === "project") {
        if (r.entity !== "project" || r.path !== path) return false;
      } else if (r.path !== path && !r.path.startsWith(path + "/")) {
        return false;
      }
    }
    if (f.level !== "all" && r.entity !== f.level) return false;
    if (f.attrs.has("protected") && !r.v.protected) return false;
    if (f.attrs.has("masked") && !(r.v.masked || r.v.hidden)) return false;
    if (f.attrs.has("file") && r.v.variable_type !== "file") return false;
    if (f.scope !== "all" && r.v.environment_scope !== f.scope) return false;
    if (q) {
      const haystack = [
        r.v.key,
        r.v.value ?? "",
        r.v.environment_scope,
        r.path,
        r.v.description ?? "",
      ]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
