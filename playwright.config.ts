import { defineConfig, devices } from "@playwright/test";
import { databaseUrl } from "./e2e/database";

// Not 3000: a server started by hand with the working database may be there
const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // One database for all tests: they run one after another
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The production build, as on the server, connected to the e2e database
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    // A static file: the server is ready before the e2e database is
    url: `${baseURL}/icon.svg`,
    env: {
      DATABASE_URL: databaseUrl,
      // Login: links point at this server, emails go to Mailpit (started with
      // `docker compose up -d`; a service container in CI), never to a real
      // address. The secret is a throwaway
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
      SMTP_URL: "smtp://localhost:1025",
    },
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
