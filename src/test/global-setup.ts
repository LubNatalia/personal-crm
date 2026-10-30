import type { TestProject } from "vitest/node";
import { prepareTestDatabase } from "./test-database";

// Runs once before all tests: creates the test database if it doesn't exist
// yet and applies the migrations to it
export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set for tests");
  }
  await prepareTestDatabase(url);
}
