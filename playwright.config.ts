import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 40_000,
  use: {
    baseURL: "http://localhost:3001",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "ui", testMatch: "**/quest.spec.ts" },
    { name: "live", testMatch: "**/jev.live.spec.ts" },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
