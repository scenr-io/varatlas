/* The varatlas HTTP app: JSON API under /api, plus the built web UI when `publicDir` is set. */

import { serveStatic } from "@hono/node-server/serve-static";
import { relative } from "node:path";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import type { AuthStatus, GitLabVariable } from "../shared/types";
import { clearTokenCookie, requireToken, resolveToken, setTokenCookie } from "./auth";
import { allowedHosts, gitlabBaseUrl } from "./config";
import { GitLabError } from "./gitlab/client";
import { whoAmI } from "./gitlab/user";
import { createVariable, deleteVariable, updateVariable } from "./gitlab/variables";
import { HttpError } from "./http";
import { checkApiRequest } from "./security";
import type { SnapshotStore } from "./snapshot";
import {
  parseCreateRequest,
  parseDeleteRequest,
  parseTokenRequest,
  parseUpdateRequest,
} from "./validation";

const sameVar = (key: string, scope: string) => (v: GitLabVariable) =>
  v.key === key && v.environment_scope === scope;

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function createApp({ store, publicDir }: { store: SnapshotStore; publicDir?: string }) {
  const app = new Hono();

  app.use(compress());
  app.use(
    secureHeaders({
      // Everything is served from this origin; avatars come from GitLab over https.
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      xFrameOptions: "DENY",
      referrerPolicy: "no-referrer",
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.get("/healthz", (c) => c.text("ok"));

  /* ---------------- API ---------------- */

  app.use("/api/*", async (c, next) => {
    const verdict = checkApiRequest(
      { method: c.req.method, headers: c.req.raw.headers },
      allowedHosts(),
    );
    if (!verdict.ok) return c.json({ error: verdict.error }, verdict.status as 403);
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.get("/api/auth", async (c) => {
    const baseUrl = gitlabBaseUrl();
    const { token, source } = resolveToken(c);
    if (!token) return c.json<AuthStatus>({ configured: false, source: null, baseUrl });
    try {
      const user = await whoAmI(token);
      return c.json<AuthStatus>({ configured: true, source, user, baseUrl });
    } catch {
      return c.json<AuthStatus>({ configured: false, source: null, baseUrl });
    }
  });

  app.post("/api/auth", async (c) => {
    const token = parseTokenRequest(await readJson(c.req.raw));
    const user = await whoAmI(token).catch((e) => {
      if (e instanceof GitLabError && e.status === 401) throw new HttpError(400, "Invalid token");
      throw new HttpError(502, "Could not reach GitLab");
    });
    setTokenCookie(c, token);
    // Warm the snapshot while the browser renders, so the first table load is faster.
    store.get(token).catch(() => {});
    return c.json({ ok: true, user });
  });

  app.delete("/api/auth", (c) => {
    const { token, source } = resolveToken(c);
    if (token && source === "cookie") store.drop(token);
    clearTokenCookie(c);
    return c.json({ ok: true });
  });

  /** ?refresh=1 forces a reload from GitLab; otherwise the cached snapshot is returned. */
  app.get("/api/variables", async (c) => {
    const token = requireToken(c);
    return c.json(await store.get(token, { fresh: c.req.query("refresh") === "1" }));
  });

  app.post("/api/variables", async (c) => {
    const token = requireToken(c);
    const { entity, id, draft } = parseCreateRequest(await readJson(c.req.raw));
    const variable = await createVariable(token, { entity, id }, draft);
    store.patch(token, { entity, id }, (vars) => [...vars, variable]);
    return c.json({ variable });
  });

  app.put("/api/variables", async (c) => {
    const token = requireToken(c);
    const { entity, id, key, scope, changes } = parseUpdateRequest(await readJson(c.req.raw));
    const variable = await updateVariable(token, { entity, id }, key, scope, changes);
    store.patch(token, { entity, id }, (vars) =>
      vars.map((v) => (sameVar(key, scope)(v) ? variable : v)),
    );
    return c.json({ variable });
  });

  app.delete("/api/variables", async (c) => {
    const token = requireToken(c);
    const { entity, id, key, scope } = parseDeleteRequest(await readJson(c.req.raw));
    await deleteVariable(token, { entity, id }, key, scope);
    store.patch(token, { entity, id }, (vars) => vars.filter((v) => !sameVar(key, scope)(v)));
    return c.json({ ok: true });
  });

  app.notFound((c) =>
    c.req.path.startsWith("/api/") ? c.json({ error: "Not found" }, 404) : c.text("Not found", 404),
  );

  app.onError((e, c) => {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status as 400);
    console.error(e);
    return c.json({ error: "Unexpected server error" }, 500);
  });

  /* ---------------- Web UI ---------------- */

  if (publicDir) {
    // Fingerprinted assets never change; the HTML must always be revalidated.
    app.use("/assets/*", async (c, next) => {
      await next();
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    });
    app.use("/", async (c, next) => {
      await next();
      c.header("Cache-Control", "no-cache");
    });
    app.use("/*", serveStatic({ root: relative(process.cwd(), publicDir), precompressed: true }));
  }

  return app;
}
