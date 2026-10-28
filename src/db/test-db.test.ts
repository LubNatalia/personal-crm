import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { withDatabase } from "@/test/database-url.mts";
import { getDb } from "./index";
import { contacts } from "./schema";
import { resetTestDb, truncateAllTables } from "./test-db";

const url = process.env.DATABASE_URL as string;

describe("test database", () => {
  beforeEach(resetTestDb);

  it("is the database whose name ends with _test", async () => {
    const [{ name }] = await getDb().$client`select current_database() as name`;
    expect(name).toMatch(/_test$/);
  });

  it("is emptied before each test, ids start from 1 again", async () => {
    await getDb().insert(contacts).values({ name: "Анна" });
    await resetTestDb();

    const [contact] = await getDb()
      .insert(contacts)
      .values({ name: "Борис" })
      .returning({ id: contacts.id });
    expect(await getDb().select().from(contacts)).toHaveLength(1);
    expect(contact.id).toBe(1);
  });

  it("refuses to empty a database whose name does not end with _test", async () => {
    // A throwaway database stands in for the working one: the guard must be
    // checked without risking real data
    const [{ name }] = await getDb().$client`select current_database() as name`;
    const probeName = `${name.replace(/_test$/, "")}_guard_probe`;
    const admin = postgres(withDatabase(url, "postgres"), {
      max: 1,
      onnotice: () => {},
    });
    try {
      await admin.unsafe(`drop database if exists "${probeName}"`);
      await admin.unsafe(`create database "${probeName}"`);

      const probe = postgres(withDatabase(url, probeName), { max: 1 });
      try {
        await probe`create table keep (id int)`;
        await probe`insert into keep values (1)`;

        await expect(truncateAllTables(probe)).rejects.toThrow("_test");

        const [{ count }] = await probe`select count(*)::int as count from keep`;
        expect(count).toBe(1);
      } finally {
        await probe.end();
      }
    } finally {
      await admin.unsafe(`drop database if exists "${probeName}"`);
      await admin.end();
    }
  });
});
