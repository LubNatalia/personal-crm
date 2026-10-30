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
    // Tests get the address of the test database, not the working one
    env: { DATABASE_URL: testDatabaseUrl(workingUrl) },
    globalSetup: ["./src/test/global-setup.ts"],
  },
});
