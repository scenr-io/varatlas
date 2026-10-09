/// <reference types="vitest/config" />
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const API_PORT = Number(process.env.VARATLAS_API_PORT || 3132);
const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: "src/web",
  plugins: [preact(), tailwindcss()],
  resolve: {
    alias: { "@shared": dir("./src/shared"), "@": dir("./src/web") },
  },
  build: {
    outDir: "../../dist/public",
    emptyOutDir: true,
    target: "es2022",
    // Small app: one JS and one CSS file load faster than many tiny chunks.
    modulePreload: { polyfill: false },
  },
  server: {
    host: "127.0.0.1",
    port: 3131,
    strictPort: true,
    // In development the API runs as a separate process (see scripts/dev.mjs).
    // changeOrigin: false keeps the browser's Host header, which the API's same-origin guard checks.
    proxy: { "/api": { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: false } },
  },
  test: {
    root: ".",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
