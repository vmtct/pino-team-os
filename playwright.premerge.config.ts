import { defineConfig } from "@playwright/test";

/** Dedicated PRE-MERGE local UI harness; never points to Production or Staging. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "premerge-local-*.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open:"never", outputFolder:"playwright-report/premerge-local" }]],
  use: {
    baseURL: "http://127.0.0.1:3109",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3109",
    url: "http://127.0.0.1:3109/",
    reuseExistingServer: false,
    timeout: 120000,
    env: { NODE_ENV:"development" },
  }
});
