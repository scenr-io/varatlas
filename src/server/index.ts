/* Server entry point. Bundled into dist/server/index.mjs by scripts/build.mjs. */

import { serve } from "@hono/node-server";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { serverOptions, serverToken } from "./config";
import { createDemo } from "./demo";
import { fetchOrg } from "./gitlab/org";
import { createSnapshotStore } from "./snapshot";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional */
}

const options = serverOptions();

// Demo mode serves a made-up org from memory: no GitLab, and a fixed token instead of a real one.
const demo = options.demo ? createDemo() : null;
const token = demo ? "demo" : serverToken();

const store = createSnapshotStore(demo ? demo.fetchOrg : fetchOrg);

// With a server-side token, load the snapshot at boot so even the first page open is instant.
if (token) {
  store.get(token).catch((e: unknown) => {
    console.warn(`[varatlas] initial load failed: ${e instanceof Error ? e.message : String(e)}`);
  });
}

const app = createApp({
  store,
  // In development Vite serves the UI; in production the bundle sits next to ../public.
  publicDir: options.dev ? undefined : resolve(dirname(fileURLToPath(import.meta.url)), "../public"),
  backend: demo?.backend,
  demo: !!demo,
  getServerToken: () => token,
});

const server = serve({ fetch: app.fetch, port: options.port, hostname: options.host }, () => {
  if (!options.dev) {
    console.log(
      `varatlas${demo ? " (demo mode)" : ""} → http://localhost:${options.port}  (listening on ${options.host})`,
    );
  }
});

// Exit promptly on `docker stop` / Ctrl-C (Node as PID 1 has no default signal handlers).
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
