import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./index";
import { LOGIN_EMAIL_LIMIT, recordLoginEmailSend } from "./login-email-sends";
import { loginEmailSends } from "./schema";
import { resetTestDb } from "./test-db";

beforeEach(resetTestDb);

// Moves the sends of an address back in time. The database counts the window
// from its own clock, so the tests change the stored time, not the clock
async function ageSends(email: string, minutes: number) {
  await getDb()
    .update(loginEmailSends)
    .set({ sentAt: sql`now() - make_interval(mins => ${minutes})` })
    .where(eq(loginEmailSends.email, email));
}

async function storedEmails() {
  const rows = await getDb().select().from(loginEmailSends);
  return rows.map((row) => row.email);
}

describe("recordLoginEmailSend", () => {
  it("lets three emails in a row go, not the fourth", async () => {
    expect(LOGIN_EMAIL_LIMIT).toBe(3);

    expect(await recordLoginEmailSend("anna@example.com")).toBe(true);
    expect(await recordLoginEmailSend("anna@example.com")).toBe(true);
    expect(await recordLoginEmailSend("anna@example.com")).toBe(true);
    expect(await recordLoginEmailSend("anna@example.com")).toBe(false);
  });

  it("does not record a refused send", async () => {
    for (let i = 0; i < 3; i++) await recordLoginEmailSend("anna@example.com");

    await recordLoginEmailSend("anna@example.com");

    expect(await storedEmails()).toHaveLength(3);
  });

  it("counts another letter case and spaces as the same address", async () => {
    await recordLoginEmailSend("anna@example.com");
    await recordLoginEmailSend("Anna@Example.com");
    await recordLoginEmailSend("  ANNA@example.com ");

    expect(await recordLoginEmailSend("anna@example.com")).toBe(false);
    expect(await recordLoginEmailSend("ANNA@EXAMPLE.COM")).toBe(false);
    expect(new Set(await storedEmails())).toEqual(
      new Set(["anna@example.com"]),
    );
  });

  it("does not let one address use up another's limit", async () => {
    for (let i = 0; i < 3; i++) await recordLoginEmailSend("anna@example.com");

    expect(await recordLoginEmailSend("boris@example.com")).toBe(true);
  });

  it("lets an email go again when the first is older than 10 minutes", async () => {
    for (let i = 0; i < 3; i++) await recordLoginEmailSend("anna@example.com");
    await ageSends("anna@example.com", 11);

    expect(await recordLoginEmailSend("anna@example.com")).toBe(true);
  });

  it("still refuses when the oldest of three is 9 minutes old", async () => {
    for (let i = 0; i < 3; i++) await recordLoginEmailSend("anna@example.com");
    await ageSends("anna@example.com", 9);

    expect(await recordLoginEmailSend("anna@example.com")).toBe(false);
  });

  it("counts only the sends from the last 10 minutes", async () => {
    await recordLoginEmailSend("anna@example.com");
    await recordLoginEmailSend("anna@example.com");
    await ageSends("anna@example.com", 30);
    await recordLoginEmailSend("anna@example.com");
    await recordLoginEmailSend("anna@example.com");

    // Two recent ones: a third and then no more
    expect(await recordLoginEmailSend("anna@example.com")).toBe(true);
    expect(await recordLoginEmailSend("anna@example.com")).toBe(false);
  });

  it("deletes the old sends of the address, and only its own", async () => {
    await recordLoginEmailSend("anna@example.com");
    await recordLoginEmailSend("boris@example.com");
    await ageSends("anna@example.com", 30);
    await ageSends("boris@example.com", 30);

    await recordLoginEmailSend("anna@example.com");

    const rows = await getDb().select().from(loginEmailSends);
    expect(rows.map((row) => row.email).sort()).toEqual([
      "anna@example.com",
      "boris@example.com",
    ]);
    // Boris's old row is not touched until he asks for a link himself
    const [boris] = rows.filter((row) => row.email === "boris@example.com");
    expect(Date.now() - boris.sentAt.getTime()).toBeGreaterThan(20 * 60 * 1000);
  });

  it("lets only three of ten simultaneous requests through", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        recordLoginEmailSend("anna@example.com"),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await storedEmails()).toHaveLength(3);
  });
});
