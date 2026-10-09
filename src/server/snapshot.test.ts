import { describe, expect, it, vi } from "vitest";
import { variable } from "../../test/helpers";
import type { OrgData } from "./gitlab/org";
import { createSnapshotStore } from "./snapshot";

const data = (key = "A"): OrgData => ({
  tree: { groups: [], projects: [] },
  entities: [
    {
      entity: "project",
      id: 1,
      path: "acme/api",
      name: "api",
      web_url: "",
      variables: [variable(key)],
    },
  ],
  source: "graphql",
});

describe("createSnapshotStore", () => {
  it("serves the cached snapshot until a fresh load is requested", async () => {
    const load = vi.fn(async () => data());
    const store = createSnapshotStore(load, () => 1000);

    const first = await store.get("t");
    expect(first.syncedAt).toBe(1000);
    await store.get("t");
    expect(load).toHaveBeenCalledTimes(1);

    await store.get("t", { fresh: true });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between concurrent requests", async () => {
    let resolve!: (d: OrgData) => void;
    const load = vi.fn(() => new Promise<OrgData>((r) => (resolve = r)));
    const store = createSnapshotStore(load);

    const a = store.get("t");
    const b = store.get("t", { fresh: true });
    resolve(data());
    expect(await a).toBe(await b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps tokens apart and forgets dropped ones", async () => {
    const load = vi.fn(async (token: string) => data(token));
    const store = createSnapshotStore(load);

    expect((await store.get("one")).entities[0].variables[0].key).toBe("one");
    expect((await store.get("two")).entities[0].variables[0].key).toBe("two");
    store.drop("one");
    await store.get("one");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("applies mutations to the cached snapshot", async () => {
    const store = createSnapshotStore(async () => data());
    await store.get("t");
    store.patch("t", { entity: "project", id: 1 }, (vars) => vars.filter((v) => v.key !== "A"));
    expect((await store.get("t")).entities[0].variables).toEqual([]);
  });

  it("does not cache failed loads", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(data());
    const store = createSnapshotStore(load);
    await expect(store.get("t")).rejects.toThrow("boom");
    await expect(store.get("t")).resolves.toMatchObject({ source: "graphql" });
  });
});
