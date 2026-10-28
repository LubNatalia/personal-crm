import "server-only";
import type { Sql } from "postgres";
import { getDb } from "./index";

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

// For `beforeEach` in tests that use the database
export async function resetTestDb() {
  await truncateAllTables(getDb().$client);
}
