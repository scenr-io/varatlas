import { describe, expect, it } from "vitest";
import type { EntityVariables, GitLabVariable, OrgTree } from "@shared/types";
import {
  effectiveRows,
  findFindings,
  groupStats,
  posture,
  rowsInScope,
  scopeCounts,
  scopesOverlap,
  summarizeKeys,
} from "./insights";
import { toRows } from "./rows";
import { looksSecret } from "./secrets";

const v = (key: string, over: Partial<GitLabVariable> = {}): GitLabVariable => ({
  key,
  value: "v",
  variable_type: "env_var",
  protected: false,
  masked: false,
  raw: false,
  environment_scope: "*",
  description: null,
  ...over,
});

const ent = (
  entity: "group" | "project",
  id: number,
  path: string,
  variables: GitLabVariable[],
  error?: string,
): EntityVariables => ({ entity, id, path, name: path.split("/").pop()!, web_url: "", variables, error });

const tree: OrgTree = {
  groups: [
    { id: 1, name: "acme", full_path: "acme", parent_id: null, web_url: "" },
    { id: 2, name: "platform", full_path: "acme/platform", parent_id: 1, web_url: "" },
    { id: 3, name: "web", full_path: "acme/web", parent_id: 1, web_url: "" },
  ],
  projects: [
    { id: 10, name: "api", path_with_namespace: "acme/platform/api", namespace_id: 2, web_url: "", archived: false },
    { id: 11, name: "site", path_with_namespace: "acme/web/site", namespace_id: 3, web_url: "", archived: false },
  ],
};

const entities = [
  ent("group", 1, "acme", [v("REGISTRY", { value: "r1", protected: true }), v("API_TOKEN", { masked: true })]),
  ent("group", 2, "acme/platform", [v("DB_URL", { value: "postgres://a" })]),
  ent("group", 3, "acme/web", [v("SENTRY_DSN", { value: "same" })]),
  ent("project", 10, "acme/platform/api", [
    v("REGISTRY", { value: "r2" }),
    v("DB_URL", { value: "postgres://b", environment_scope: "production" }),
    v("SENTRY_DSN", { value: "same" }),
    v("DEPLOY_KEY", { value: "k1", environment_scope: "production" }),
  ]),
  ent("project", 11, "acme/web/site", [v("DEPLOY_KEY", { value: "k2", environment_scope: "production" })]),
  ent("project", 12, "acme/secret", [], "No access to CI/CD variables (needs Maintainer)"),
];
const rows = toRows(entities);

describe("helpers", () => {
  it("flags secret-looking keys but not public or id keys", () => {
    expect(looksSecret("AWS_SECRET_ACCESS_KEY")).toBe(true);
    expect(looksSecret("GITLAB_TOKEN")).toBe(true);
    expect(looksSecret("SSH_PRIVATE_KEY_B64")).toBe(true);
    expect(looksSecret("SSH_PUBLIC_KEY")).toBe(false);
    expect(looksSecret("AWS_ACCESS_KEY_ID")).toBe(false);
    expect(looksSecret("AWS_DEFAULT_REGION")).toBe(false);
  });

  it("treats * as overlapping every scope", () => {
    expect(scopesOverlap("*", "production")).toBe(true);
    expect(scopesOverlap("staging", "production")).toBe(false);
  });
});

describe("summarizeKeys", () => {
  it("counts locations and value agreement per key", () => {
    const byKey = Object.fromEntries(summarizeKeys(rows).map((k) => [k.key, k]));
    expect(byKey.REGISTRY).toMatchObject({ locations: 2, values: "different" });
    expect(byKey.SENTRY_DSN).toMatchObject({ locations: 2, values: "same", secret: true });
    expect(byKey.DEPLOY_KEY.scopes).toEqual(["production"]);
  });
});

describe("effectiveRows", () => {
  const eff = effectiveRows(rows, "acme/platform/api");
  const find = (key: string, from?: string) =>
    eff.find((r) => r.v.key === key && (r.inheritedFrom ?? null) === (from ?? null));

  it("includes inherited group variables", () => {
    expect(find("API_TOKEN", "acme")).toBeTruthy();
    expect(eff.some((r) => r.path === "acme/web")).toBe(false);
  });

  it("marks full overrides by nearer definitions", () => {
    expect(find("REGISTRY", "acme")?.overriddenBy).toBe("acme/platform/api");
  });

  it("marks partial overrides when a nearer definition covers only some environments", () => {
    expect(find("DB_URL", "acme/platform")?.overriddenIn).toEqual(["production"]);
  });
});

describe("rowsInScope", () => {
  const paths = (scope: Parameters<typeof rowsInScope>[1]) =>
    [...new Set(rowsInScope(rows, scope).map((r) => r.path))].sort();

  it("covers a group and everything below it", () => {
    expect(paths({ entity: "group", path: "acme/platform" })).toEqual(["acme/platform", "acme/platform/api"]);
  });

  it("does not treat a path prefix as a parent", () => {
    expect(paths({ entity: "group", path: "acme/plat" })).toEqual([]);
  });

  it("gives a project its own and inherited variables", () => {
    expect(paths({ entity: "project", path: "acme/web/site" })).toEqual(["acme", "acme/web", "acme/web/site"]);
  });

  it("covers everything without a selection", () => {
    expect(rowsInScope(rows, null)).toBe(rows);
  });
});

describe("findFindings", () => {
  const findings = Object.fromEntries(findFindings(rows, entities).map((f) => [f.id, f]));

  it("finds unmasked and unprotected secrets", () => {
    // API_TOKEN is masked; SENTRY_DSN x2 and DEPLOY_KEY x2 are not.
    expect(findings["unmasked-secrets"].count).toBe(4);
    expect(findings["unprotected-secrets"].count).toBe(5);
  });

  it("separates drift from shareable copies, ignoring inherited overrides", () => {
    expect(findings.drift.count).toBe(1); // DEPLOY_KEY[production] in two unrelated projects
    expect(findings.copies.count).toBe(1); // SENTRY_DSN identical in acme/web and acme/platform/api
  });

  it("finds overrides of inherited variables", () => {
    expect(findings.overrides.count).toBe(2); // REGISTRY and DB_URL on the api project
  });

  it("reports unreadable places with their paths", () => {
    expect(findings.unreadable).toMatchObject({ count: 1, paths: ["acme/secret"] });
  });
});

describe("statistics", () => {
  it("summarizes posture and scopes", () => {
    expect(posture(rows)).toMatchObject({ total: 9, masked: 1, protected: 1 });
    expect(scopeCounts(rows)[0]).toEqual({ scope: "*", count: 6 });
  });

  it("totals each group's own, subgroup and project variables", () => {
    const acme = groupStats(tree, rows).find((g) => g.path === "acme")!;
    expect(acme).toMatchObject({ depth: 0, own: 2, inSubgroups: 2, inProjects: 5, projects: 2 });
    const platform = groupStats(tree, rows).find((g) => g.path === "acme/platform")!;
    expect(platform).toMatchObject({ depth: 1, own: 1, inProjects: 4, projects: 1 });
  });
});
