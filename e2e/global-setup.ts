import { prepareTestDatabase } from "../src/test/test-database";
import { databaseUrl, resetDatabase } from "./database";

// Runs once before all tests: the e2e database is created and migrated if
// needed, emptied and filled with a few known contacts
export default async function globalSetup() {
  await prepareTestDatabase(databaseUrl);
  await resetDatabase();
}
