// Applies pending migrations from ./drizzle and exits.
// On the server it runs as a one-off container before a new app version starts.
// Usage (inside the image): node db/migrate.ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const [{ count }] = await sql`
    select count(*)::int as count from drizzle.__drizzle_migrations
  `;
  console.log(`Migrations are up to date: ${count} applied.`);
} finally {
  await sql.end();
}
