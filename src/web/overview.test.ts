import { describe, expect, it } from "vitest";
import type { OrgTree } from "@shared/types";
import { entity, variable } from "../../test/helpers";
import { changesFrom } from "./edits";
import { findFindings, findingUnit, groupStats, narrowFinding, rowsInScope, type Finding } from "./insights";
import { buildOverview, pathInSelection } from "./overview";
import { rowId, toRows, type Row } from "./rows";
import { findEntity } from "./tree";

const tree: OrgTree = {
  groups: [
    { id: 1, name: "acme", full_path: "acme", parent_id: null, web_url: "" },
    { id: 2, name: "web", full_path: "acme/web", parent_id: 1, web_url: "" },
  ],
  projects: [
    {
      id: 10,
      name: "site",
      path_with_namespace: "acme/web/site",
      namespace_id: 2,
      web_url: "",
      archived: false,
    },
    { id: 11, name: "api", path_with_namespace: "acme/api", namespace_id: 1, web_url: "", archived: false },
  ],
};
const entities = [
  entity("group", 1, "acme", [variable("REGISTRY"), variable("API_TOKEN")]),
  entity("group", 2, "acme/web", []),
  entity("project", 10, "acme/web/site", [variable("REGISTRY", { value: "own" }), variable("DEPLOY_TOKEN")]),
  entity("project", 11, "acme/api", [variable("DEPLOY_TOKEN")]),
];
const rows = toRows(entities);

describe("findEntity", () => {
  it("resolves groups and projects to a path and name", () => {
    expect(findEntity(tree, { entity: "group", id: 2 })).toMatchObject({ path: "acme/web", name: "web" });
    expect(findEntity(tree, { entity: "project", id: 10 })).toMatchObject({ path: "acme/web/site" });
    expect(findEntity(tree, { entity: "project", id: 99 })).toBeNull();
  });
});

describe("pathInSelection", () => {
  const group = findEntity(tree, { entity: "group", id: 2 });
  const project = findEntity(tree, { entity: "project", id: 10 });
  it("includes everything below a group, and everything above a project", () => {
    expect(pathInSelection(group, "acme/web/site")).toBe(true);
    expect(pathInSelection(group, "acme/api")).toBe(false);
    expect(pathInSelection(project, "acme")).toBe(true);
    expect(pathInSelection(project, "acme/api")).toBe(false);
    expect(pathInSelection(null, "anything")).toBe(true);
  });
});

describe("narrowFinding", () => {
  const all = findFindings(rows, entities);
  const byId = (id: string) => all.find((f) => f.id === id) as Finding;
  const inView = (list: Row[]) => new Map(list.map((r) => [rowId(r), r]));

  it("recounts and re-labels a narrowed finding (no more '1 variables')", () => {
    const unmasked = byId("unmasked-secrets");
    expect(unmasked.count).toBe(3);
    expect(findingUnit(unmasked)).toBe("variables");
    const site = rows.filter((r) => r.path === "acme/web/site");
    const narrowed = narrowFinding(unmasked, inView(site), () => true);
    expect(narrowed.count).toBe(1);
    expect(findingUnit(narrowed)).toBe("variable");
  });

  it("counts distinct keys for key findings", () => {
    const copies = byId("copies");
    const narrowed = narrowFinding(copies, inView(rows), () => true);
    expect(narrowed.count).toBe(1); // DEPLOY_TOKEN, in two unrelated projects
    expect(findingUnit(narrowed)).toBe("key");
  });
});

describe("changesFrom", () => {
  const draft = {
    key: "K",
    value: "",
    variable_type: "env_var" as const,
    protected: true,
    masked: true,
    raw: false,
    environment_scope: "*",
  };
  it("keeps a hidden variable's value when the field is left empty", () => {
    expect(changesFrom(variable("K", { hidden: true, value: null }), draft)).not.toHaveProperty("value");
  });
  it("sends an emptied value for a normal variable", () => {
    expect(changesFrom(variable("K"), draft)).toMatchObject({ value: "", description: "" });
  });
});

describe("buildOverview", () => {
  const allStats = groupStats(tree, rows);
  const overview = (ref: { entity: "group" | "project"; id: number } | null) => {
    const selected = ref ? findEntity(tree, ref) : null;
    return buildOverview({ tree, scoped: rowsInScope(rows, selected), selected, findings: [], allStats });
  };

  it("summarises the whole org", () => {
    const o = overview(null);
    expect(o.headline).toBe("5 variables in 3 of 4 groups and projects");
    expect(o.subline).toBe("3 distinct keys. Nothing needs attention.");
    expect(o.atlas.title).toBe("Where variables are defined");
  });

  it("describes what a project receives, and shows its lineage", () => {
    const o = overview({ entity: "project", id: 10 });
    expect(o.headline).toBe("site receives 3 variables");
    expect(o.subline).toContain("2 of its own and 1 inherited from 1 parent group");
    expect(o.subline).toContain("1 inherited variable is replaced by nearer ones");
    expect(o.stats.map((s) => [s.path, s.own, s.inProjects])).toEqual([
      ["acme", 1, 0],
      ["acme/web", 0, 0],
      ["acme/web/site", 0, 2],
    ]);
  });
});
