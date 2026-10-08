import { afterEach, describe, expect, it, vi } from "vitest";
import { findFindings, summarizeKeys } from "../web/insights";
import { toRows } from "../web/rows";
import { createApp } from "./app";
import { createDemo, demoOrg } from "./demo";
import { createSnapshotStore } from "./snapshot";

const ORIGIN = "http://localhost:3131";
const req = (path: string, method = "GET", body?: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { host: "localhost:3131", origin: ORIGIN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("demo org", () => {
  const { tree, entities } = demoOrg();
  const rows = toRows(entities);

  it("is a consistent tree", () => {
    const groupIds = new Set(tree.groups.map((g) => g.id));
    expect(tree.projects.every((p) => groupIds.has(p.namespace_id))).toBe(true);
    expect(tree.groups.filter((g) => g.parent_id === null).map((g) => g.full_path)).toEqual(["northwind"]);
  });

  it("shows every kind of finding", () => {
    const ids = findFindings(rows, entities).map((f) => f.id).sort();
    expect(ids).toEqual(["copies", "drift", "overrides", "unmasked-secrets", "unprotected-secrets", "unreadable"]);
  });

  it("never defines the same key and environment twice in one place", () => {
    for (const e of entities) {
      const seen = new Set(e.variables.map((v) => `${v.key}|${v.environment_scope}`));
      expect(seen.size).toBe(e.variables.length);
    }
  });

  it("has keys repeated across places", () => {
    expect(summarizeKeys(rows).filter((k) => k.locations > 1).length).toBeGreaterThan(2);
  });
});

describe("demo backend", () => {
  afterEach(() => vi.unstubAllEnvs());

  function app() {
    vi.stubEnv("GITLAB_TOKEN", "demo");
    const demo = createDemo();
    return createApp({ store: createSnapshotStore(demo.fetchOrg), backend: demo.backend, demo: true });
  }

  it("reports demo mode and a full-access token", async () => {
    const res = await app().request(req("/api/auth"));
    expect(await res.json()).toMatchObject({ configured: true, demo: true, token: { scopes: ["api"] } });
  });

  it("creates, updates and deletes in memory", async () => {
    const a = app();
    const draft = { key: "NEW_VAR", value: "hello-world", variable_type: "env_var", protected: false, masked: false, raw: false, environment_scope: "*" };
    expect((await a.request(req("/api/variables", "POST", { entity: "group", id: 1, draft }))).status).toBe(200);
    const updated = await a.request(
      req("/api/variables", "PUT", { entity: "group", id: 1, key: "NEW_VAR", scope: "*", changes: { value: "changed-value" } }),
    );
    expect((await updated.json()).variable.value).toBe("changed-value");
    expect((await a.request(req("/api/variables", "DELETE", { entity: "group", id: 1, key: "NEW_VAR", scope: "*" }))).status).toBe(200);

    const fresh = await (await a.request(req("/api/variables?refresh=1"))).json();
    const root = fresh.entities.find((e: { id: number; entity: string }) => e.entity === "group" && e.id === 1);
    expect(root.variables.some((v: { key: string }) => v.key === "NEW_VAR")).toBe(false);
  });

  it("refuses changes where the demo user has no access", async () => {
    const { entities } = demoOrg();
    const locked = entities.find((e) => e.error)!;
    const res = await app().request(
      req("/api/variables", "DELETE", { entity: locked.entity, id: locked.id, key: "X", scope: "*" }),
    );
    expect(res.status).toBe(403);
  });
});
