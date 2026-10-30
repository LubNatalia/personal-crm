import postgres from "postgres";
import {
  prepareTestDatabase,
  truncateAllTables,
} from "../src/test/test-database";
import { databaseUrl, SEEDED_CONTACTS } from "./database";

// Runs once before all tests: the e2e database is created and migrated if
// needed, emptied and filled with a few known contacts
export default async function globalSetup() {
  await prepareTestDatabase(databaseUrl);

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await truncateAllTables(sql);
    await sql`insert into contacts ${sql(SEEDED_CONTACTS, "name", "about")}`;
  } finally {
    await sql.end();
  }
}
