import { defineConfig, devices } from "@playwright/test";

const smokeRunId = process.env.ENVFORGE_SMOKE_RUN_ID ?? `${Date.now().toString(36)}-${process.pid}`;
process.env.ENVFORGE_SMOKE_RUN_ID = smokeRunId;
const adminProjects = ["desktop-zh-light", "desktop-en-dark", "mobile-zh-dark", "mobile-en-light"];

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm run dev:api",
      cwd: "../..",
      env: {
        NODE_ENV: "development",
        PORT: "5174",
        ENVFORGE_ADMIN_EMAILS: adminProjects
          .map((project) => `codex-ui-admin-${smokeRunId}-${project}@example.test`)
          .join(",")
      },
      url: "http://127.0.0.1:5174/api/health",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "npm run dev --workspace @fool/web",
      cwd: "../..",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  projects: [
    { name: "desktop-zh-light", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "desktop-en-dark", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    { name: "mobile-zh-dark", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "mobile-en-light", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 }, colorScheme: "light" } }
  ]
});
