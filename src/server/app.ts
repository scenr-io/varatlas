/* The varatlas HTTP app: JSON API under /api, plus the built web UI when `publicDir` is set. */

import { serveStatic } from "@hono/node-server/serve-static";
import { relative } from "node:path";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import type { AuthProblem, AuthStatus, GitLabVariable } from "../shared/types";
import { clearTokenCookie, requireToken, resolveToken, setTokenCookie } from "./auth";
import { gitlabBackend, type Backend } from "./backend";
import { allowedHosts } from "./config";
import { GitLabError } from "./gitlab/client";
import { canReadVariables } from "./gitlab/user";
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

/** How a failed /user call should be explained. */
function classify(e: unknown, scopesKnown: boolean): AuthProblem {
  if (e instanceof GitLabError && e.status === 401) return "invalid";
  // 403 on /user with a token GitLab still recognises means the scopes are too narrow.
  if (e instanceof GitLabError && e.status === 403) return scopesKnown ? "scope" : "invalid";
  return "unreachable";
}

const SCOPE_HELP = "varatlas needs the api scope, or read_api to browse without editing.";

/** Turn GitLab's terse 403s on reads and writes into instructions. */
function explainForbidden(e: unknown, action: "read" | "change"): never {
  if (e instanceof GitLabError && e.status === 403) {
    if (/insufficient_scope/i.test(e.message)) {
      throw new HttpError(
        403,
        action === "change"
          ? "This token can only read. Changing variables needs a token with the api scope."
          : `This token can't read CI/CD variables. ${SCOPE_HELP}`,
      );
    }
    if (action === "change") {
      throw new HttpError(403, "You need the Maintainer role on this group or project to change its variables.");
    }
  }
  throw e;
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function createApp({
  store,
  publicDir,
  backend = gitlabBackend,
  demo = false,
}: {
  store: SnapshotStore;
  publicDir?: string;
  /** where variables come from; the built-in demo org when `demo` is set */
  backend?: Backend;
  demo?: boolean;
}) {
  const { whoAmI, tokenAccess, createVariable, updateVariable, deleteVariable } = backend;
  const gitlabBaseUrl = () => backend.baseUrl();
  const withDemo = (status: AuthStatus): AuthStatus => (demo ? { ...status, demo: true } : status);
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

  /** GET /api/auth: is a token configured, does GitLab accept it, and what may it do? */
  app.get("/api/auth", async (c) => {
    const baseUrl = gitlabBaseUrl();
    const { token, source } = resolveToken(c);
    if (!token) return c.json<AuthStatus>({ configured: false, source: null, baseUrl });

    const [user, access] = await Promise.allSettled([whoAmI(token), tokenAccess(token)]);
    const info = access.status === "fulfilled" ? access.value : null;
    const tokenInfo = info ?? { name: null, scopes: null, expiresAt: null };

    if (user.status === "rejected") {
      const problem = classify(user.reason, info !== null);
      // A saved token GitLab refuses is useless; forget it so the token screen starts clean.
      if (problem === "invalid" && source === "cookie") clearTokenCookie(c);
      return c.json<AuthStatus>({ configured: false, source, baseUrl, token: tokenInfo, problem });
    }
    if (!canReadVariables(info)) {
      return c.json<AuthStatus>({ configured: false, source, baseUrl, user: user.value, token: tokenInfo, problem: "scope" });
    }
    return c.json<AuthStatus>(withDemo({ configured: true, source, user: user.value, baseUrl, token: tokenInfo }));
  });

  /** POST /api/auth: check a pasted token and keep it in the session cookie. */
  app.post("/api/auth", async (c) => {
    const token = parseTokenRequest(await readJson(c.req.raw));
    const [userResult, info] = await Promise.all([
      whoAmI(token).then(
        (u) => ({ ok: true as const, u }),
        (e) => ({ ok: false as const, e }),
      ),
      tokenAccess(token),
    ]);
    const scopes = info?.scopes?.length ? `It has ${info.scopes.join(", ")}. ` : "";
    if (!userResult.ok) {
      const problem = classify(userResult.e, info !== null);
      if (problem === "unreachable") throw new HttpError(502, `Couldn't reach GitLab at ${new URL(gitlabBaseUrl()).host}.`);
      if (problem === "scope") throw new HttpError(400, `This token can't be used. ${scopes}${SCOPE_HELP}`);
      throw new HttpError(400, "GitLab refused this token. Check it hasn't expired or been revoked, and that it was copied in full.");
    }
    if (!canReadVariables(info)) {
      throw new HttpError(400, `This token can't read CI/CD variables. ${scopes}${SCOPE_HELP}`);
    }
    const user = userResult.u;
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
    const snapshot = await store
      .get(token, { fresh: c.req.query("refresh") === "1" })
      .catch((e) => explainForbidden(e, "read"));
    return c.json(snapshot);
  });

  app.post("/api/variables", async (c) => {
    const token = requireToken(c);
    const { entity, id, draft } = parseCreateRequest(await readJson(c.req.raw));
    const variable = await createVariable(token, { entity, id }, draft).catch((e) =>
      explainForbidden(e, "change"),
    );
    store.patch(token, { entity, id }, (vars) => [...vars, variable]);
    return c.json({ variable });
  });

  app.put("/api/variables", async (c) => {
    const token = requireToken(c);
    const { entity, id, key, scope, changes } = parseUpdateRequest(await readJson(c.req.raw));
    const variable = await updateVariable(token, { entity, id }, key, scope, changes).catch((e) =>
      explainForbidden(e, "change"),
    );
    store.patch(token, { entity, id }, (vars) =>
      vars.map((v) => (sameVar(key, scope)(v) ? variable : v)),
    );
    return c.json({ variable });
  });

  app.delete("/api/variables", async (c) => {
    const token = requireToken(c);
    const { entity, id, key, scope } = parseDeleteRequest(await readJson(c.req.raw));
    await deleteVariable(token, { entity, id }, key, scope).catch((e) => explainForbidden(e, "change"));
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
