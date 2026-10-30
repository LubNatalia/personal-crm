import { loadEnvConfig } from "@next/env";
import { e2eDatabaseUrl } from "../src/test/database-url.mts";

// The same env files as Next.js; run from the project root
loadEnvConfig(process.cwd(), true);
const workingUrl = process.env.DATABASE_URL;
if (!workingUrl) {
  throw new Error("DATABASE_URL is not set");
}

// The app under test and the setup use this database, never the working one
export const databaseUrl = e2eDatabaseUrl(workingUrl);

// Already in the database when the scenario starts
export const SEEDED_CONTACTS = [
  { name: "Анна Смирнова", about: "Соседка" },
  { name: "Борис Петров", about: "Коллега" },
];
