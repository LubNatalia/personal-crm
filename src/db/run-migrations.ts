// Applies the migrations of a folder to a database. Shared by the one-off
// migrate container and by the tests, so both run the migrations the same way.
// Runs with Node's built-in TypeScript support in the image: it may import
// only drizzle-orm and postgres (see the Dockerfile)
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export type RunMigrationsOptions = {
  // The folder with the .sql files and meta/_journal.json
  folder: string;
  // Email of the user who gets the data that is already in the database
  // (the contacts and groups made before there were users). Needed only
  // when there is such data; the migration fails without it
  ownerEmail?: string | null;
};

// Returns how many migrations the database has applied after the run
export async function runMigrations(
  url: string,
  { folder, ownerEmail }: RunMigrationsOptions,
) {
  // One connection: the setting below lives on it, and the migrator runs all
  // migrations on it in one transaction
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const owner = ownerEmail?.trim().toLowerCase();
    if (owner) {
      // Read by the migration with current_setting('app.owner_email')
      await sql`select set_config('app.owner_email', ${owner}, false)`;
    }
    await migrate(drizzle(sql), { migrationsFolder: folder });
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `;
    return count;
  } finally {
    await sql.end();
  }
}
