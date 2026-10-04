import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverTree, isExcludedPath } from "./discovery";

const group = (id: number, full_path: string, parent_id: number | null) => ({
  id,
  name: full_path.split("/").pop(),
  full_path,
  parent_id,
  web_url: `https://gitlab.com/groups/${full_path}`,
});

const project = (id: number, path: string, namespaceId: number) => ({
  id,
  name: path.split("/").pop(),
  path_with_namespace: path,
  archived: false,
  web_url: `https://gitlab.com/${path}`,
  namespace: { id: namespaceId, kind: "group" },
});

/** Answer GitLab API calls by path prefix. */
function routeFetch(routes: Record<string, unknown[]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace("/api/v4", "");
      const body = routes[path];
      if (!body) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isExcludedPath", () => {
  it("matches any segment, case-insensitively", () => {
    expect(isExcludedPath("acme/Sandbox/app", ["sandbox"])).toBe(true);
    expect(isExcludedPath("acme/sandboxes/app", ["sandbox"])).toBe(false);
    expect(isExcludedPath("acme/app", [])).toBe(false);
  });
});

describe("discoverTree", () => {
  it("walks descendants of root groups and collects their projects", async () => {
    routeFetch({
      "/groups": [group(1, "acme", null), group(2, "acme/platform", 1)],
      "/groups/1/descendant_groups": [group(2, "acme/platform", 1), group(3, "acme/platform/deep", 2)],
      "/groups/1/projects": [project(10, "acme/platform/api", 2), project(11, "acme/platform/deep/x", 3)],
    });

    const tree = await discoverTree("t");

    expect(tree.groups.map((g) => g.full_path)).toEqual([
      "acme",
      "acme/platform",
      "acme/platform/deep",
    ]);
    expect(tree.projects.map((p) => p.path_with_namespace)).toEqual([
      "acme/platform/api",
      "acme/platform/deep/x",
    ]);
    expect(tree.projects[0].namespace_id).toBe(2);
  });

  it("treats a group with an invisible parent as a root", async () => {
    routeFetch({
      "/groups": [group(5, "corp/team", 4)],
      "/groups/5/descendant_groups": [],
      "/groups/5/projects": [project(50, "corp/team/svc", 5)],
    });
    const tree = await discoverTree("t");
    expect(tree.groups.map((g) => g.id)).toEqual([5]);
    expect(tree.projects.map((p) => p.id)).toEqual([50]);
  });

  it("drops excluded paths", async () => {
    vi.stubEnv("VARATLAS_EXCLUDE_PATHS", "sandbox");
    routeFetch({
      "/groups": [group(1, "acme", null)],
      "/groups/1/descendant_groups": [group(2, "acme/sandbox", 1)],
      "/groups/1/projects": [project(10, "acme/sandbox/tmp", 2), project(11, "acme/app", 1)],
    });
    const tree = await discoverTree("t");
    expect(tree.groups.map((g) => g.full_path)).toEqual(["acme"]);
    expect(tree.projects.map((p) => p.path_with_namespace)).toEqual(["acme/app"]);
  });
});
