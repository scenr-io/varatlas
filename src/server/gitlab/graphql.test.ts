import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrgGraphQL, gidToNumber, toVariable } from "./graphql";

const gvar = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  value: "v",
  variableType: "ENV_VAR",
  protected: false,
  masked: false,
  hidden: false,
  raw: false,
  environmentScope: "*",
  description: null,
  ...over,
});

const vars = (nodes: unknown[], hasNextPage = false) => ({ nodes, pageInfo: { hasNextPage } });
const page = (nodes: unknown[], endCursor: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage: endCursor !== null, endCursor },
});

const group = (id: number, fullPath: string, parentId: number | null, ciVariables: unknown) => ({
  id: `gid://gitlab/Group/${id}`,
  name: fullPath.split("/").pop(),
  fullPath,
  webUrl: `https://gitlab.com/groups/${fullPath}`,
  parent: parentId === null ? null : { id: `gid://gitlab/Group/${parentId}` },
  ciVariables,
});

const project = (id: number, fullPath: string, groupId: number, ciVariables: unknown, archived = false) => ({
  id: `gid://gitlab/Project/${id}`,
  name: fullPath.split("/").pop(),
  fullPath,
  webUrl: `https://gitlab.com/${fullPath}`,
  archived,
  group: { id: `gid://gitlab/Group/${groupId}` },
  ciVariables,
});

/**
 * Fake GitLab: GraphQL answers come from `groupsPages` / `projectsPages` keyed by cursor;
 * REST variable listings come from `rest`.
 */
function fakeGitLab(opts: {
  groupsPages: Record<string, unknown>;
  projectsPages: Record<string, unknown>;
  rest?: Record<string, unknown[]>;
}) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/graphql")) {
      const { query, variables } = JSON.parse(String(init?.body));
      const cursor = variables.after ?? "start";
      const data = query.includes("descendantGroups")
        ? { group: opts.groupsPages[cursor] }
        : { group: { projects: opts.projectsPages[cursor] } };
      return new Response(JSON.stringify({ data }), { status: 200 });
    }
    const path = new URL(url).pathname.replace("/api/v4", "");
    return new Response(JSON.stringify(opts.rest?.[path] ?? []), { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const root = { id: 1, name: "acme", full_path: "acme", parent_id: null, web_url: "" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("helpers", () => {
  it("parses global ids", () => {
    expect(gidToNumber("gid://gitlab/Project/987")).toBe(987);
  });

  it("maps GraphQL variables to the REST shape", () => {
    expect(toVariable(gvar("CERT", { variableType: "FILE", hidden: null }) as never)).toMatchObject({
      key: "CERT",
      variable_type: "file",
      environment_scope: "*",
      hidden: false,
    });
  });
});

describe("fetchOrgGraphQL", () => {
  it("builds the tree and variables across pages", async () => {
    const fetch = fakeGitLab({
      groupsPages: {
        start: {
          ...group(1, "acme", null, vars([gvar("REGISTRY")])),
          descendantGroups: page([group(2, "acme/platform", 1, vars([]))], "g2"),
        },
        g2: {
          ...group(1, "acme", null, vars([gvar("REGISTRY")])),
          descendantGroups: page([group(3, "acme/platform/deep", 2, vars([gvar("DEEP")]))]),
        },
      },
      projectsPages: {
        start: page([project(10, "acme/platform/api", 2, vars([gvar("DB_URL", { masked: true })]))], "p2"),
        p2: page([project(11, "acme/web", 1, vars([]))]),
      },
    });

    const { tree, entities } = await fetchOrgGraphQL("t", [root]);

    expect(tree.groups.map((g) => [g.id, g.full_path, g.parent_id])).toEqual([
      [1, "acme", null],
      [2, "acme/platform", 1],
      [3, "acme/platform/deep", 2],
    ]);
    expect(tree.projects.map((p) => [p.id, p.namespace_id])).toEqual([
      [10, 2],
      [11, 1],
    ]);
    const byPath = Object.fromEntries(entities.map((e) => [e.path, e.variables.map((v) => v.key)]));
    expect(byPath).toEqual({
      acme: ["REGISTRY"],
      "acme/platform": [],
      "acme/platform/deep": ["DEEP"],
      "acme/platform/api": ["DB_URL"],
      "acme/web": [],
    });
    // 2 group pages + 2 project pages, no REST variable calls.
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("marks entities without access instead of failing", async () => {
    fakeGitLab({
      groupsPages: { start: { ...group(1, "acme", null, null), descendantGroups: page([]) } },
      projectsPages: { start: page([project(10, "acme/api", 1, null)]) },
    });
    const { entities } = await fetchOrgGraphQL("t", [root]);
    expect(entities.every((e) => e.error?.includes("Maintainer"))).toBe(true);
  });

  it("falls back to REST for entities with more variables than one page", async () => {
    const fetch = fakeGitLab({
      groupsPages: { start: { ...group(1, "acme", null, vars([]) ), descendantGroups: page([]) } },
      projectsPages: { start: page([project(10, "acme/api", 1, vars([gvar("A")], true))]) },
      rest: {
        "/projects/10/variables": [
          { key: "A", value: "1", variable_type: "env_var", protected: false, masked: false, raw: false, environment_scope: "*", description: null },
          { key: "B", value: "2", variable_type: "env_var", protected: false, masked: false, raw: false, environment_scope: "*", description: null },
        ],
      },
    });
    const { entities } = await fetchOrgGraphQL("t", [root]);
    expect(entities.find((e) => e.path === "acme/api")?.variables.map((v) => v.key)).toEqual(["A", "B"]);
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/projects/10/variables"))).toBe(true);
  });

  it("drops archived and excluded projects and groups", async () => {
    vi.stubEnv("VARATLAS_EXCLUDE_PATHS", "sandbox");
    fakeGitLab({
      groupsPages: {
        start: {
          ...group(1, "acme", null, vars([])),
          descendantGroups: page([group(2, "acme/sandbox", 1, vars([]))]),
        },
      },
      projectsPages: {
        start: page([
          project(10, "acme/sandbox/tmp", 2, vars([])),
          project(11, "acme/old", 1, vars([]), true),
          project(12, "acme/app", 1, vars([])),
        ]),
      },
    });
    const { tree, entities } = await fetchOrgGraphQL("t", [root]);
    expect(tree.groups.map((g) => g.full_path)).toEqual(["acme"]);
    expect(tree.projects.map((p) => p.path_with_namespace)).toEqual(["acme/app"]);
    expect(entities.map((e) => e.path)).toEqual(["acme", "acme/app"]);
  });

  it("surfaces GraphQL errors so the caller can fall back to REST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Field 'hidden' doesn't exist" }] }))),
    );
    await expect(fetchOrgGraphQL("t", [root])).rejects.toThrow(/hidden/);
  });
});
