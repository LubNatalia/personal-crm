import { inspect } from "node:util";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { DatabaseError, toSafeError, withSafeDbErrors } from "./safe-errors";

// A real database client pointed at a port nobody listens on: every query
// fails the way it does when the database is down
const client = postgres("postgres://crm:crm@127.0.0.1:1/crm", {
  max: 1,
  connect_timeout: 5,
});
const downDb = drizzle(client);

afterAll(() => client.end({ timeout: 1 }));

const SECRET = "Секретная Персона";

// A failed query with something the user typed among its parameters
async function failedQueryError() {
  return downDb.execute(sql`select ${SECRET}::text`).then(
    () => {
      throw new Error("The query was expected to fail");
    },
    (thrown: unknown) => thrown,
  );
}

describe("withSafeDbErrors", () => {
  it("names the function and the failure, not the query's values", async () => {
    const loadContact = withSafeDbErrors(async function loadContact() {
      await downDb.execute(sql`select ${SECRET}::text`);
    });

    const error = await loadContact().then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(DatabaseError);
    // What Node.js prints for an uncaught error
    const logged = inspect(error, { depth: null });
    expect(logged).toContain("loadContact");
    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain(SECRET);
  });

  it("passes the result through when nothing fails", async () => {
    const double = withSafeDbErrors(async (n: number) => n * 2);
    expect(await double(21)).toBe(42);
  });
});

describe("toSafeError", () => {
  it("leaves errors that are not database errors as they are", () => {
    const error = new Error("Invalid contact id: 5");
    expect(toSafeError(error)).toBe(error);
    expect(toSafeError("plain text")).toBe("plain text");
  });

  it("makes a database error deeper in the chain safe too", async () => {
    const queryError = await failedQueryError();
    // A library that wraps the error and copies its text into its own
    const wrapped = new Error(`Login failed: ${String(queryError)}`, {
      cause: new Error("Adapter error", { cause: queryError }),
    });

    const safe = toSafeError(wrapped);

    expect(safe).toBeInstanceOf(DatabaseError);
    const logged = inspect(safe, { depth: null });
    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain(SECRET);
  });
});
