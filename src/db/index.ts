import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(postgres(url), { schema });
}

// Created on first query, not on import: `next build` loads this module
// without DATABASE_URL. Kept on globalThis to survive hot reloads in development
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDb>;
};

export function getDb() {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
