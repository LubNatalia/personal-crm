import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";

// Smoke test for deploys: the app is up and can reach the database
export async function GET() {
  // Answer at request time, never from a build-time prerender
  await connection();

  const version = process.env.APP_VERSION ?? "dev";
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", version });
  } catch (error) {
    console.error("Health check failed: database is unreachable", error);
    return Response.json({ status: "error", version }, { status: 503 });
  }
}
