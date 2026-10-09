/* Server entry point. Bundled into dist/server/index.mjs by scripts/build.mjs. */

import { serve } from "@hono/node-server";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { createDemo } from "./demo";
import { fetchOrg } from "./gitlab/org";
import { createSnapshotStore } from "./snapshot";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional */
}

const dev = process.env.VARATLAS_DEV === "1";
const port = Number(process.env.PORT || 3131);
// `||`, not `??`: an empty HOST= line in .env.local must not mean "all interfaces".
const hostname = process.env.HOST || "127.0.0.1";

// Demo mode serves a fictional org from memory: no GitLab, no token needed.
const demo = process.env.VARATLAS_DEMO === "1" ? createDemo() : null;
if (demo) process.env.GITLAB_TOKEN = "demo";

const store = createSnapshotStore(demo ? demo.fetchOrg : fetchOrg);

// With a server-side token, load the snapshot at boot so even the first page open is instant.
if (process.env.GITLAB_TOKEN) {
  store.get(process.env.GITLAB_TOKEN).catch((e) => {
    console.warn(`[varatlas] initial load failed: ${(e as Error).message}`);
  });
}

const app = createApp({
  store,
  // In development Vite serves the UI; in production the bundle sits next to ../public.
  publicDir: dev ? undefined : resolve(dirname(fileURLToPath(import.meta.url)), "../public"),
  backend: demo?.backend,
  demo: !!demo,
});

const server = serve({ fetch: app.fetch, port, hostname }, () => {
  if (!dev) {
    console.log(
      `varatlas${demo ? " (demo mode)" : ""} → http://localhost:${port}  (listening on ${hostname})`,
    );
  }
});

// Exit promptly on `docker stop` / Ctrl-C (Node as PID 1 has no default signal handlers).
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
