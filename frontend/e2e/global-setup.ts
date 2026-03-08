import { execSync } from "child_process";

const TEST_DB_URL =
  "postgresql://sms_user:sms_password@localhost:5432/sms_db_test";

function run(cmd: string, env?: Record<string, string>) {
  execSync(cmd, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
}

async function globalSetup() {
  // Reset the E2E test database to a clean state.
  // This is a dedicated test database (sms_db_test), NOT production.
  run(`npx prisma db push --force-reset --skip-generate --accept-data-loss`, {
    DATABASE_URL: TEST_DB_URL,
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
  });

  // Build Next.js with the test database URL so the production server works
  run(`npx next build`, {
    DATABASE_URL: TEST_DB_URL,
    PYTHON_SERVICE_URL: "http://localhost:8001",
    MINIO_ENDPOINT: "localhost",
    MINIO_PORT: "9000",
    MINIO_ACCESS_KEY: "minioadmin",
    MINIO_SECRET_KEY: "minioadmin",
    MINIO_USE_SSL: "false",
  });

  console.log("Test database ready, Next.js built.");
}

export default globalSetup;
