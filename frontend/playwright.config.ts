import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

const testDbUrl =
  "postgresql://sms_user:sms_password@localhost:5432/sms_db_test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  timeout: 60_000,

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  globalSetup: "./e2e/global-setup.ts",

  webServer: [
    {
      command: "uv run uvicorn src.main:app --port 8001",
      cwd: "../python-service",
      port: 8001,
      reuseExistingServer: !isCI,
      timeout: 30_000,
      env: {
        E2E_TEST_MODE: "true",
        DATABASE_URL: testDbUrl,
      },
    },
    {
      // Use next start (production mode) to avoid dev server lock conflicts
      command: `npx next start --port 3001`,
      port: 3001,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: {
        DATABASE_URL: testDbUrl,
        PYTHON_SERVICE_URL: "http://localhost:8001",
        MINIO_ENDPOINT: "localhost",
        MINIO_PORT: "9000",
        MINIO_ACCESS_KEY: "minioadmin",
        MINIO_SECRET_KEY: "minioadmin",
        MINIO_USE_SSL: "false",
      },
    },
  ],
});
