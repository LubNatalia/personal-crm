// Applies pending migrations from ./drizzle and exits.
// On the server it runs as a one-off container before a new app version starts
// (node db/migrate.ts inside the image); locally: pnpm db:migrate.
// OWNER_EMAIL: who gets the contacts and groups made before there were users.
// Needed only while the database holds such data
import { createRequire } from "node:module";
import { runMigrations } from "./run-migrations.ts";

// @next/env is CommonJS whose exports Node can't import by name; require
// loads it the same way under tsx and under Node's own TypeScript support.
// In the container the variables are already set and no env files exist
const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const count = await runMigrations(url, {
    folder: "./drizzle",
    ownerEmail: process.env.OWNER_EMAIL,
  });
  console.log(`Migrations are up to date: ${count} applied.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
