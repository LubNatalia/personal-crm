import "server-only";
import { truncateAllTables } from "@/test/test-database";
import { getDb } from "./index";
import { user } from "./schema";

// For `beforeEach` in tests that use the database
export async function resetTestDb() {
  await truncateAllTables(getDb().$client);
}

// A user for a test: returns the id that data-layer functions take. The
// email is stored as given, so pass it in lower case
export async function createTestUser(email: string) {
  const [row] = await getDb()
    .insert(user)
    .values({ id: crypto.randomUUID(), name: "", email, emailVerified: true })
    .returning({ id: user.id });
  return row.id;
}
