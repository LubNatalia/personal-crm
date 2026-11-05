import { createRequire } from "node:module";
import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./src/test/database-url.mts";

// @next/env is CommonJS whose exports can't be imported by name from ESM
const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");

// The same env files as Next.js and drizzle-kit
loadEnvConfig(import.meta.dirname, true);
const workingUrl = process.env.DATABASE_URL;
if (!workingUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "src/test/empty-module.ts",
      ),
    },
  },
  test: {
    environment: "node",
    // End-to-end tests are run by Playwright
    exclude: [...configDefaults.exclude, "e2e/**"],
    // One test database shared by all files: they run one after another
    fileParallelism: false,
    env: {
      // Tests get the address of the test database, not the working one
      DATABASE_URL: testDatabaseUrl(workingUrl),
      // Login settings for tests: a throwaway secret and Mailpit (started
      // with `docker compose up -d`), so no real email can go out
      BETTER_AUTH_SECRET: "vitest-only-secret-0123456789abcdef0123456789",
      BETTER_AUTH_URL: "http://localhost:3000",
      SMTP_URL: "smtp://localhost:1025",
    },
    globalSetup: ["./src/test/global-setup.ts"],
  },
});
