import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgVariables } from "../shared/types";
import { createApp } from "./app";
import type { SnapshotStore } from "./snapshot";

const ORIGIN = "http://localhost:3131";

function snapshot(): OrgVariables {
  return { tree: { groups: [], projects: [] }, entities: [], syncedAt: 1, source: "graphql" };
}

function makeStore(): SnapshotStore {
  return { get: vi.fn(async () => snapshot()), patch: vi.fn(), drop: vi.fn() };
}

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { host: "localhost:3131", ...init.headers };
  if (method !== "GET") {
    headers.origin ??= ORIGIN;
    headers["content-type"] ??= "application/json";
  }
  return new Request(`${ORIGIN}${path}`, { ...init, method, headers });
}

beforeEach(() => {
  vi.stubEnv("GITLAB_TOKEN", "glpat-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("API guards", () => {
  it("rejects unknown hosts", async () => {
    const res = await createApp({ store: makeStore() }).request(
      req("/api/variables", { headers: { host: "evil.example" } }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects cross-origin mutations", async () => {
    const res = await createApp({ store: makeStore() }).request(
      req("/api/variables", { method: "DELETE", headers: { origin: "https://evil.example" }, body: "{}" }),
    );
    expect(res.status).toBe(403);
  });

  it("sets security headers", async () => {
    const res = await createApp({ store: makeStore() }).request(req("/healthz"));
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("/api/variables", () => {
  it("returns the cached snapshot and forces a reload with ?refresh=1", async () => {
    const store = makeStore();
    const app = createApp({ store });

    const res = await app.request(req("/api/variables"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(snapshot());
    expect(store.get).toHaveBeenLastCalledWith("glpat-test", { fresh: false });

    await app.request(req("/api/variables?refresh=1"));
    expect(store.get).toHaveBeenLastCalledWith("glpat-test", { fresh: true });
  });

  it("requires a token", async () => {
    vi.stubEnv("GITLAB_TOKEN", "");
    const res = await createApp({ store: makeStore() }).request(req("/api/variables"));
    expect(res.status).toBe(401);
  });

  it("validates mutation bodies", async () => {
    const app = createApp({ store: makeStore() });
    const bad = await app.request(req("/api/variables", { method: "POST", body: '{"entity":"user"}' }));
    expect(bad.status).toBe(400);
    const invalid = await app.request(req("/api/variables", { method: "POST", body: "nope" }));
    expect(invalid.status).toBe(400);
  });

  it("deletes through GitLab and patches the snapshot", async () => {
    const fetch = vi.fn(async (_url: string) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const store = makeStore();

    const res = await createApp({ store }).request(
      req("/api/variables", {
        method: "DELETE",
        body: JSON.stringify({ entity: "project", id: 7, key: "API_KEY", scope: "production" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://gitlab.com/api/v4/projects/7/variables/API_KEY?filter[environment_scope]=production",
    );
    expect(store.patch).toHaveBeenCalledWith("glpat-test", { entity: "project", id: 7 }, expect.any(Function));
  });

  it("passes GitLab errors through with their status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "403 Forbidden" }), { status: 403 })),
    );
    const res = await createApp({ store: makeStore() }).request(
      req("/api/variables", {
        method: "DELETE",
        body: JSON.stringify({ entity: "group", id: 1, key: "A", scope: "*" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "403 Forbidden" });
  });
});

describe("/api/auth", () => {
  it("reports an unconfigured token without calling GitLab", async () => {
    vi.stubEnv("GITLAB_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const res = await createApp({ store: makeStore() }).request(req("/api/auth"));
    expect(await res.json()).toMatchObject({ configured: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores a valid token in an httpOnly cookie", async () => {
    vi.stubEnv("GITLAB_TOKEN", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ username: "ada", name: "Ada", avatar_url: null }))),
    );
    const res = await createApp({ store: makeStore() }).request(
      req("/api/auth", { method: "POST", body: JSON.stringify({ token: "glpat-new" }) }),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("varatlas_token=glpat-new");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  });
});
