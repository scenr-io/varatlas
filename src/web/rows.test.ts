import { describe, expect, it } from "vitest";
import { distinctScopes, EMPTY_FILTERS, filterRows, keyLocationCounts, toRows } from "./rows";
import type { EntityVariables, GitLabVariable } from "@shared/types";

const v = (key: string, over: Partial<GitLabVariable> = {}): GitLabVariable => ({
  key,
  value: "value",
  variable_type: "env_var",
  protected: false,
  masked: false,
  raw: false,
  environment_scope: "*",
  description: null,
  ...over,
});

const entities: EntityVariables[] = [
  {
    entity: "group",
    id: 1,
    path: "acme",
    name: "acme",
    web_url: "",
    variables: [v("REGISTRY", { protected: true })],
  },
  {
    entity: "project",
    id: 10,
    path: "acme/api",
    name: "api",
    web_url: "",
    variables: [
      v("DB_URL", { environment_scope: "production", masked: true }),
      v("DB_URL", { environment_scope: "staging" }),
      v("REGISTRY"),
    ],
  },
  {
    entity: "project",
    id: 11,
    path: "other/web",
    name: "web",
    web_url: "",
    variables: [v("CERT", { variable_type: "file" })],
  },
];

const rows = toRows(entities);

describe("keyLocationCounts", () => {
  it("counts distinct groups/projects, not environment scopes", () => {
    const counts = keyLocationCounts(rows);
    expect(counts.get("DB_URL")).toBe(1);
    expect(counts.get("REGISTRY")).toBe(2);
  });
});

describe("distinctScopes", () => {
  it("returns sorted unique scopes", () => {
    expect(distinctScopes(rows)).toEqual(["*", "production", "staging"]);
  });
});

describe("filterRows", () => {
  const keys = (f: Partial<typeof EMPTY_FILTERS>) =>
    filterRows(rows, { ...EMPTY_FILTERS, ...f }).map((r) => `${r.path}:${r.v.key}`);

  it("limits a group selection to its subtree", () => {
    expect(keys({ selection: { entity: "group", path: "acme" } })).toEqual([
      "acme:REGISTRY",
      "acme/api:DB_URL",
      "acme/api:DB_URL",
      "acme/api:REGISTRY",
    ]);
  });

  it("does not treat a path prefix as a parent", () => {
    expect(keys({ selection: { entity: "group", path: "acm" } })).toEqual([]);
  });

  it("filters by level, attributes and scope", () => {
    expect(keys({ level: "group" })).toEqual(["acme:REGISTRY"]);
    expect(keys({ attrs: new Set(["masked"]) })).toEqual(["acme/api:DB_URL"]);
    expect(keys({ attrs: new Set(["file"]) })).toEqual(["other/web:CERT"]);
    expect(keys({ scope: "staging" })).toEqual(["acme/api:DB_URL"]);
  });

  it("searches keys and paths case-insensitively", () => {
    expect(keys({ query: "WEB" })).toEqual(["other/web:CERT"]);
  });
});
