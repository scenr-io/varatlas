/* Flat row model for the variables table, plus pure filtering helpers. */

import type { EntityType, EntityVariables, GitLabVariable } from "@shared/types";
import { looksSecret } from "./secrets";

export interface Row {
  entity: EntityType;
  entityId: number;
  path: string;
  web_url: string;
  v: GitLabVariable;
}

export type LevelFilter = "all" | EntityType;
export type AttrFilter = "protected" | "masked" | "file" | "secret";

export interface Filters {
  query: string;
  level: LevelFilter;
  attrs: ReadonlySet<AttrFilter>;
  /** environment scope, or "all" */
  scope: string;
  /** limit to these rows, e.g. the variables behind a finding */
  ids: ReadonlySet<string> | null;
}

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

export function distinctScopes(rows: Row[]): string[] {
  return [...new Set(rows.map((r) => r.v.environment_scope))].sort();
}

/** Apply the filter bar to rows already scoped to the selection (see rowsInScope). */
export function filterRows<R extends Row>(rows: R[], f: Filters): R[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.ids && !f.ids.has(rowId(r))) return false;
    if (f.level !== "all" && r.entity !== f.level) return false;
    if (f.attrs.has("protected") && !r.v.protected) return false;
    if (f.attrs.has("masked") && !(r.v.masked || r.v.hidden)) return false;
    if (f.attrs.has("file") && r.v.variable_type !== "file") return false;
    if (f.attrs.has("secret") && !looksSecret(r.v.key)) return false;
    if (f.scope !== "all" && r.v.environment_scope !== f.scope) return false;
    if (q) {
      const haystack = [r.v.key, r.v.value ?? "", r.v.environment_scope, r.path, r.v.description ?? ""]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
