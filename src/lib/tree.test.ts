import { describe, expect, it } from "vitest";
import { pooled } from "./pooled";
import { buildGroupTree } from "./tree";

describe("buildGroupTree", () => {
  it("nests subgroups and projects under their parents", () => {
    const roots = buildGroupTree({
      groups: [
        { id: 1, name: "acme", full_path: "acme", parent_id: null, web_url: "" },
        { id: 2, name: "platform", full_path: "acme/platform", parent_id: 1, web_url: "" },
        { id: 9, name: "orphan", full_path: "x/orphan", parent_id: 99, web_url: "" },
      ],
      projects: [
        {
          id: 10,
          name: "api",
          path_with_namespace: "acme/platform/api",
          namespace_id: 2,
          web_url: "",
          archived: false,
        },
      ],
    });

    expect(roots.map((r) => r.name)).toEqual(["acme", "orphan"]);
    expect(roots[0].children[0].name).toBe("platform");
    expect(roots[0].children[0].projects).toEqual([{ id: 10, name: "api" }]);
  });
});

describe("pooled", () => {
  it("preserves order and respects the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await pooled([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});
