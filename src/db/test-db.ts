import "server-only";
import { truncateAllTables } from "@/test/test-database";
import { getDb } from "./index";

// For `beforeEach` in tests that use the database
export async function resetTestDb() {
  await truncateAllTables(getDb().$client);
}
