import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { databaseName, withDatabase } from "./database-url.mts";

// Runs once before all tests: creates the test database if it doesn't exist
// yet and applies the migrations to it
export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set for tests");
  }
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
    await migrate(drizzle(sql), {
      migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
    });
  } finally {
    await sql.end();
  }
}
