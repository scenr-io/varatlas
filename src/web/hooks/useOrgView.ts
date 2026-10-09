/* Everything the dashboard derives from the snapshot for the current selection and filters. */

import { useMemo } from "preact/hooks";
import { findFindings, groupStats, narrowFinding, rowsInScope, summarizeKeys } from "@/insights";
import { buildOverview, pathInSelection } from "@/overview";
import { filterRows, rowId, toRows, type Row } from "@/rows";
import { findEntity } from "@/tree";
import type { EntityVariables, OrgTree } from "@shared/types";
import type { DashboardState } from "./useDashboardState";

export function useOrgView(tree: OrgTree | null, entities: EntityVariables[] | null, state: DashboardState) {
  const { selection, query, level, attrs, scope, finding } = state;

  const rows = useMemo(() => toRows(entities ?? []), [entities]);
  const allKeys = useMemo(() => summarizeKeys(rows), [rows]);
  const keyLocations = useMemo(() => new Map(allKeys.map((k) => [k.key, k.locations])), [allKeys]);
  const varCounts = useMemo(
    () => new Map((entities ?? []).map((e) => [`${e.entity}:${e.id}`, e.variables.length])),
    [entities],
  );

  // Org-wide results are computed once per snapshot; a selection only narrows them.
  const allFindings = useMemo(() => findFindings(rows, entities ?? []), [rows, entities]);
  const allStats = useMemo(() => (tree ? groupStats(tree, rows) : []), [tree, rows]);

  const selected = useMemo(() => (selection && tree ? findEntity(tree, selection) : null), [selection, tree]);
  const scoped = useMemo(() => rowsInScope(rows, selected), [rows, selected]);

  const findings = useMemo(() => {
    const inView = new Map<string, Row>(scoped.filter((r) => !r.overriddenBy).map((r) => [rowId(r), r]));
    return allFindings
      .map((f) => narrowFinding(f, inView, (p) => pathInSelection(selected, p)))
      .filter((f) => f.count > 0);
  }, [allFindings, scoped, selected]);

  const filtered = useMemo(
    () =>
      filterRows(scoped, {
        query,
        // A project's view mixes its own and inherited variables, so "where defined" doesn't apply.
        level: selected?.entity === "project" ? "all" : level,
        attrs,
        scope,
        ids: finding?.rowIds ?? null,
      }),
    [scoped, query, level, attrs, scope, finding, selected],
  );

  const keysInView = useMemo(() => {
    const keys = new Set(filtered.map((r) => r.v.key));
    return allKeys.filter((k) => keys.has(k.key));
  }, [filtered, allKeys]);

  const overview = useMemo(
    () => (tree && entities ? buildOverview({ tree, scoped, selected, findings, allStats }) : null),
    [tree, entities, scoped, selected, findings, allStats],
  );

  return {
    rows,
    allKeys,
    keyLocations,
    varCounts,
    selected,
    scoped,
    findings,
    filtered,
    keysInView,
    overview,
  };
}
