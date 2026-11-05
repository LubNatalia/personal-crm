import { loadEnvConfig } from "@next/env";
import postgres, { type Sql } from "postgres";
import { e2eDatabaseUrl } from "../src/test/database-url.mts";
import { truncateAllTables } from "../src/test/test-database";
import { TEST_USER_EMAIL } from "./auth";
import { clearMailbox } from "./mailpit";

// The same env files as Next.js; run from the project root
loadEnvConfig(process.cwd(), true);
const workingUrl = process.env.DATABASE_URL;
if (!workingUrl) {
  throw new Error("DATABASE_URL is not set");
}

// The app under test and the setup use this database, never the working one
export const databaseUrl = e2eDatabaseUrl(workingUrl);

// The user the seeded data belongs to; tests sign in as them (e2e/auth.ts)
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

// Already in the database when the scenario starts
export const SEEDED_CONTACTS = [
  { name: "Анна Смирнова", about: "Соседка" },
  { name: "Борис Петров", about: "Коллега" },
];

// Runs `work` with a connection to the e2e database
export async function withDatabase<T>(work: (sql: Sql) => Promise<T>) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// Empties the database and the mailbox, then puts back the test user with
// the known contacts, so every test starts from the same data
export async function resetDatabase() {
  await withDatabase(async (sql) => {
    await truncateAllTables(sql);
    await sql`
      insert into "user" (id, name, email, email_verified)
      values (${TEST_USER_ID}, '', ${TEST_USER_EMAIL}, true)
    `;
    const contacts = SEEDED_CONTACTS.map((contact) => ({
      ...contact,
      user_id: TEST_USER_ID,
    }));
    await sql`insert into contacts ${sql(contacts, "user_id", "name", "about")}`;
  });
  await clearMailbox();
}
