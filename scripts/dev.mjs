// Development: the API server (with reload) on :3132 and Vite on :3131, which proxies /api.
// Open http://localhost:3131.
import { spawn } from "node:child_process";

const API_PORT = process.env.VARATLAS_API_PORT || "3132";

const procs = [
  spawn("pnpm", ["exec", "tsx", "watch", "src/server/index.ts"], {
    stdio: "inherit",
    env: { ...process.env, PORT: API_PORT, VARATLAS_DEV: "1" },
  }),
  spawn("pnpm", ["exec", "vite"], {
    stdio: "inherit",
    env: { ...process.env, VARATLAS_API_PORT: API_PORT },
  }),
];

function stop(code = 0) {
  for (const p of procs) p.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const p of procs) p.on("exit", (code) => stop(code ?? 0));
