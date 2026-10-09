/* Browser tests: the built app in demo mode, driven through a real browser. Run `pnpm build` first. */

import { defineConfig, devices } from "@playwright/test";

const PORT = 3150;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "test/e2e",
  // The demo org lives in the server's memory, so tests run one at a time against one server.
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Locally, use the installed Chrome instead of downloading a browser.
      use: { ...devices["Desktop Chrome"], channel: CI ? undefined : "chrome" },
    },
  ],
  webServer: {
    command: "node dist/server/index.mjs",
    url: `http://127.0.0.1:${PORT}/healthz`,
    env: { PORT: String(PORT), HOST: "127.0.0.1", VARATLAS_DEMO: "1" },
    reuseExistingServer: !CI,
  },
});
