import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres, { type Sql } from "postgres";
import { databaseName, withDatabase } from "./database-url.mts";

// Shared by Vitest and Playwright, so nothing here imports "server-only".
// No import.meta either: Playwright loads this file as CommonJS. Both run
// from the project root

const MIGRATIONS_FOLDER = path.resolve("drizzle");

// Creates the test database if it doesn't exist yet and applies the
// migrations to it
export async function prepareTestDatabase(url: string) {
  const name = databaseName(url);
  if (!name.endsWith("_test")) {
    throw new Error(`Test database "${name}" must end with _test`);
  }

  // A database can't be created from inside itself: connect to the
  // maintenance database of the same server
  const admin = postgres(withDatabase(url, "postgres"), {
    max: 1,
    onnotice: () => {},
  });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${name}`;
    if (existing.length === 0) {
      await admin.unsafe(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await sql.end();
  }
}

// Empties every table in the database and restarts the ids. The name check
// comes first: on any database not meant for tests nothing is deleted
export async function truncateAllTables(sql: Sql) {
  const [{ name }] = await sql<{ name: string }[]>`
    select current_database() as name
  `;
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to empty database "${name}": its name must end with _test`,
    );
  }

  const tables = await sql<{ name: string }[]>`
    select quote_ident(tablename) as name
    from pg_tables
    where schemaname = 'public'
  `;
  if (tables.length === 0) {
    return;
  }
  await sql.unsafe(
    `truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`,
  );
}
