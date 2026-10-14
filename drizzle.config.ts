import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load DATABASE_URL from the same env files Next.js uses
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
