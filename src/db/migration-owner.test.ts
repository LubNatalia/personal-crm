import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { databaseName, withDatabase } from "@/test/database-url.mts";
import { runMigrations } from "./run-migrations";

// The migration that gives every existing contact and group an owner, run on
// a database that holds data from the previous version of the app. It needs a
// database of its own: the shared test database is already fully migrated

const MIGRATIONS = path.resolve("drizzle");
// Migrations 0000-0002 are everything the app had before login
const OLD_MIGRATION_COUNT = 3;
const OWNER_EMAIL = "owner@example.com";

const adminUrl = withDatabase(process.env.DATABASE_URL!, "postgres");
// `crm_test` -> `crm_migration_test`: still ends with _test
const scratchName = `${databaseName(process.env.DATABASE_URL!).replace(/_test$/, "")}_migration_test`;
const scratchUrl = withDatabase(process.env.DATABASE_URL!, scratchName);

let oldMigrations: string;

// A copy of the migrations folder that stops after the last pre-login one
function copyOldMigrations() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "crm-old-migrations-"));
  fs.mkdirSync(path.join(folder, "meta"));
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  journal.entries = journal.entries.slice(0, OLD_MIGRATION_COUNT);
  fs.writeFileSync(
    path.join(folder, "meta", "_journal.json"),
    JSON.stringify(journal),
  );
  for (const { tag } of journal.entries) {
    fs.copyFileSync(
      path.join(MIGRATIONS, `${tag}.sql`),
      path.join(folder, `${tag}.sql`),
    );
  }
  return folder;
}

// Made once and kept, like the test database itself: creating and dropping
// a database is slow (Postgres waits for a checkpoint), and it would slow
// down the tests that run after this file
async function createScratchDatabase() {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const existing =
      await admin`select 1 from pg_database where datname = ${scratchName}`;
    if (existing.length === 0) {
      await admin.unsafe(`create database "${scratchName}"`);
    }
  } finally {
    await admin.end();
  }
}

// Back to an empty database: no tables, no record of applied migrations
async function emptyScratchDatabase() {
  await withScratch(async (sql) => {
    await sql.unsafe(
      "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public",
    );
  });
}

async function withScratch<T>(work: (sql: Sql) => Promise<T>) {
  const sql = postgres(scratchUrl, { max: 1, onnotice: () => {} });
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// Contacts, notes, groups and links as the previous version stored them
async function fillOldData(sql: Sql) {
  await sql`
    insert into contacts (name, notes, about) values
      ('Анна Смирнова', 'Созвонились в пятницу', 'Соседка'),
      ('Борис Петров', null, 'Коллега'),
      ('Вера Козлова', E'Первая заметка\nВторая заметка', null)
  `;
  await sql`insert into groups (name) values ('Друзья'), ('Теннис')`;
  await sql`
    insert into contact_groups (contact_id, group_id) values (1, 1), (1, 2), (3, 1)
  `;
}

async function counts(sql: Sql) {
  const [row] = await sql<
    { contacts: number; groups: number; links: number }[]
  >`
    select
      (select count(*) from contacts)::int as contacts,
      (select count(*) from groups)::int as groups,
      (select count(*) from contact_groups)::int as links
  `;
  return row;
}

beforeAll(async () => {
  oldMigrations = copyOldMigrations();
  await createScratchDatabase();
});

beforeEach(async () => {
  await emptyScratchDatabase();
  await runMigrations(scratchUrl, { folder: oldMigrations });
});

describe("migration with an owner: a database with data", () => {
  it("keeps every record and gives all of them to the owner", async () => {
    const before = await withScratch(async (sql) => {
      await fillOldData(sql);
      return counts(sql);
    });
    expect(before).toEqual({ contacts: 3, groups: 2, links: 3 });

    await runMigrations(scratchUrl, {
      folder: MIGRATIONS,
      ownerEmail: OWNER_EMAIL,
    });

    await withScratch(async (sql) => {
      expect(await counts(sql)).toEqual(before);

      const users = await sql<{ id: string; email: string }[]>`
        select id, email from "user"
      `;
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(OWNER_EMAIL);

      const [owned] = await sql<{ contacts: number; groups: number }[]>`
        select
          (select count(*) from contacts where user_id = ${users[0].id})::int as contacts,
          (select count(*) from groups where user_id = ${users[0].id})::int as groups
      `;
      expect(owned).toEqual({ contacts: 3, groups: 2 });

      const [vera] = await sql<{ notes: string }[]>`
        select notes from contacts where name = 'Вера Козлова'
      `;
      expect(vera.notes).toBe("Первая заметка\nВторая заметка");
    });
  });

  it("writes the owner's email in lower case without spaces", async () => {
    await withScratch(fillOldData);

    await runMigrations(scratchUrl, {
      folder: MIGRATIONS,
      ownerEmail: "  Owner@Example.COM ",
    });

    await withScratch(async (sql) => {
      const users = await sql<{ email: string; email_verified: boolean }[]>`
        select email, email_verified from "user"
      `;
      expect(users).toEqual([{ email: OWNER_EMAIL, email_verified: true }]);
    });
  });

  it("fails without the owner's email and changes nothing", async () => {
    const before = await withScratch(async (sql) => {
      await fillOldData(sql);
      return counts(sql);
    });

    await expect(
      runMigrations(scratchUrl, { folder: MIGRATIONS }),
    ).rejects.toThrow(/OWNER_EMAIL/);

    await withScratch(async (sql) => {
      expect(await counts(sql)).toEqual(before);
      const columns = await sql`
        select 1 from information_schema.columns
        where table_name = 'contacts' and column_name = 'user_id'
      `;
      expect(columns).toHaveLength(0);
      const tables = await sql`
        select 1 from information_schema.tables where table_name = 'user'
      `;
      expect(tables).toHaveLength(0);
      const [{ applied }] = await sql<{ applied: number }[]>`
        select count(*)::int as applied from drizzle.__drizzle_migrations
      `;
      expect(applied).toBe(OLD_MIGRATION_COUNT);
    });
  });

  it("fails on an empty email string like on a missing one", async () => {
    await withScratch(fillOldData);

    await expect(
      runMigrations(scratchUrl, { folder: MIGRATIONS, ownerEmail: "   " }),
    ).rejects.toThrow(/OWNER_EMAIL/);
  });
});

describe("migration with an owner: an empty database", () => {
  it("passes without the owner's email and creates no user", async () => {
    await runMigrations(scratchUrl, { folder: MIGRATIONS });

    await withScratch(async (sql) => {
      const users = await sql`select 1 from "user"`;
      expect(users).toHaveLength(0);
    });
  });

  it("creates no user even when the email is given", async () => {
    await runMigrations(scratchUrl, {
      folder: MIGRATIONS,
      ownerEmail: OWNER_EMAIL,
    });

    await withScratch(async (sql) => {
      const users = await sql`select 1 from "user"`;
      expect(users).toHaveLength(0);
    });
  });
});
