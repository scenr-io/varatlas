/*
 * How fast is the analysis on a large org? Run: pnpm bench
 * Builds a synthetic org (500 groups, 3,000 projects, 20,000 variables) and times
 * what happens once per data load and what happens on every sidebar click.
 */
import type { EntityVariables, OrgTree } from "../src/shared/types";
import * as insights from "../src/web/insights";
import { filterRows, toRows } from "../src/web/rows";

const impl = insights;

function syntheticOrg(groups: number, projects: number, vars: number) {
  const tree: OrgTree = { groups: [], projects: [] };
  for (let i = 0; i < groups; i++) {
    const parent = i === 0 ? null : Math.floor((i - 1) / 5);
    const path = parent === null ? "acme" : `${tree.groups[parent].full_path}/g${i}`;
    tree.groups.push({ id: i, name: `g${i}`, full_path: path, parent_id: parent, web_url: "" });
  }
  for (let i = 0; i < projects; i++) {
    const g = tree.groups[i % groups];
    tree.projects.push({ id: 10_000 + i, name: `p${i}`, path_with_namespace: `${g.full_path}/p${i}`, namespace_id: g.id, web_url: "", archived: false });
  }
  const entities: EntityVariables[] = [
    ...tree.groups.map((g) => ({ entity: "group" as const, id: g.id, path: g.full_path, name: g.name, web_url: "", variables: [] })),
    ...tree.projects.map((p) => ({ entity: "project" as const, id: p.id, path: p.path_with_namespace, name: p.name, web_url: "", variables: [] })),
  ] as EntityVariables[];
  for (let i = 0; i < vars; i++) {
    entities[(i * 7919) % entities.length].variables.push({
      key: `KEY_${i % 1500}${i % 3 === 0 ? "_TOKEN" : ""}`,
      value: `v${i % 4}`,
      variable_type: "env_var",
      protected: i % 2 === 0,
      masked: i % 3 === 1,
      raw: false,
      environment_scope: i % 5 === 0 ? "production" : "*",
      description: null,
    });
  }
  return { tree, entities };
}

function time(label: string, fn: () => unknown, runs = 5): number {
  fn(); // warm up
  const t = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const ms = (performance.now() - t) / runs;
  console.log(`  ${label.padEnd(38)} ${ms.toFixed(1).padStart(8)} ms`);
  return ms;
}

const { tree, entities } = syntheticOrg(500, 3000, 20_000);
const rows = toRows(entities);
const group = tree.groups[7];
const project = tree.projects[1234];
console.log(`${rows.length} variables, ${tree.groups.length} groups, ${tree.projects.length} projects\n`);

console.log("Once per data load");
time("findings (whole org)", () => impl.findFindings(rows, entities));
time("atlas statistics (whole org)", () => impl.groupStats(tree, rows));
time("key summaries (whole org)", () => impl.summarizeKeys(rows));

console.log("\nOn every sidebar click");
const click = (scope: Parameters<typeof insights.rowsInScope>[1]) => () => {
  const scoped = insights.rowsInScope(rows, scope);
  const live = scoped.filter((r) => !r.overriddenBy);
  impl.summarizeKeys(live);
  impl.posture(live);
  impl.scopeCounts(live);
};
time("select a group", click({ entity: "group", path: group.full_path }));
time("select a project (with inheritance)", click({ entity: "project", path: project.path_with_namespace }));

console.log("\nOn every keystroke in search");
time("filter 20,000 variables", () =>
  filterRows(rows, { query: "token", level: "all", attrs: new Set(), scope: "all", ids: null }),
);
