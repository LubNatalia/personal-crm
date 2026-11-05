import { eq, like } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { loginEmailSends, verification } from "@/db/schema";
import { resetTestDb } from "@/db/test-db";
import {
  clearMailbox,
  listEmails,
  loginLinkOf,
  waitForEmail,
} from "@/test/mailpit";
import { getAuth } from "./auth";

// Better Auth with the real database and Mailpit, no mocks. The browser part
// of the login is covered by the end-to-end tests; here the server rules:
// which addresses are accepted, what happens to old links and the limit

beforeEach(async () => {
  await resetTestDb();
  await clearMailbox();
});

function requestLink(email: string) {
  return getAuth().api.signInMagicLink({
    body: { email, callbackURL: "/", errorCallbackURL: "/login/expired" },
    headers: new Headers(),
  });
}

async function storedTokens() {
  const rows = await getDb()
    .select()
    .from(verification)
    .where(like(verification.identifier, "magic-link:%"));
  return rows.map((row) => row.identifier.replace("magic-link:", ""));
}

// What a failed request says: Better Auth's error with its HTTP status
async function failureOf(work: Promise<unknown>) {
  try {
    await work;
  } catch (error) {
    return error as { statusCode: number; body?: { message?: string } };
  }
  throw new Error("The request did not fail");
}

describe("requesting a login link", () => {
  it("sends an email with a link to the address", async () => {
    await requestLink("anna@example.com");

    const email = await waitForEmail("anna@example.com");
    expect(email.Subject).toBe("Вход в Личную CRM");
    expect(email.From.Address).toBe("noreply@mail.crm.lyna.tech");
    const [token] = await storedTokens();
    expect(loginLinkOf(email)).toContain(`token=${token}`);
  });

  it("writes the address in lower case without spaces", async () => {
    await requestLink("  Anna@Example.COM ");

    const email = await waitForEmail("anna@example.com");
    expect(email.To[0].Address).toBe("anna@example.com");
    const [row] = await getDb().select().from(verification);
    expect(JSON.parse(row.value).email).toBe("anna@example.com");
  });

  it.each(["anna@", "", "   ", "anna", "an na@example.com"])(
    "refuses %j: an error, no email, no link",
    async (email) => {
      const error = await failureOf(requestLink(email));

      expect(error.statusCode).toBe(400);
      expect(await listEmails()).toEqual([]);
      expect(await storedTokens()).toEqual([]);
      expect(await getDb().select().from(loginEmailSends)).toEqual([]);
    },
  );

  it("cancels the earlier link when a new one is asked for", async () => {
    await requestLink("anna@example.com");
    const [first] = await storedTokens();

    await requestLink("anna@example.com");

    const tokens = await storedTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens).not.toContain(first);
  });

  it("keeps the links of other addresses when one asks for a new link", async () => {
    await requestLink("anna@example.com");
    await requestLink("boris@example.com");
    await requestLink("anna@example.com");

    const emails = (await getDb().select().from(verification)).map(
      (row) => JSON.parse(row.value).email,
    );
    expect(emails.sort()).toEqual(["anna@example.com", "boris@example.com"]);
  });

  it("refuses the fourth request in 10 minutes with 429 and leaves no link", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");
    const [thirdToken] = await storedTokens();

    const error = await failureOf(requestLink("anna@example.com"));

    expect(error.statusCode).toBe(429);
    expect(await listEmails("anna@example.com")).toHaveLength(3);
    // The refused request's own link is gone; the third one still works
    expect(await storedTokens()).toEqual([thirdToken]);
  });

  it("counts another letter case as the same address", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");

    const error = await failureOf(requestLink("ANNA@example.com"));

    expect(error.statusCode).toBe(429);
  });

  it("does not stop another address", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");

    await requestLink("boris@example.com");

    expect(await listEmails("boris@example.com")).toHaveLength(1);
  });

  it("sends nothing and keeps no link when the mail server is down", async () => {
    // Nothing listens on this port
    const original = process.env.SMTP_URL;
    process.env.SMTP_URL = "smtp://localhost:1";
    try {
      await expect(requestLink("anna@example.com")).rejects.toThrow();

      expect(await storedTokens()).toEqual([]);
    } finally {
      process.env.SMTP_URL = original;
    }
  });
});

describe("a login link is used", () => {
  it("creates the user in lower case on the first login and a session", async () => {
    await requestLink("  Vera@Example.com ");
    const email = await waitForEmail("vera@example.com");
    const token = new URL(loginLinkOf(email)).searchParams.get("token")!;

    const result = await getAuth().api.magicLinkVerify({
      query: { token },
      headers: new Headers(),
    });

    expect(result.user.email).toBe("vera@example.com");
    expect(await storedTokens()).toEqual([]);
  });

  it("is single-use", async () => {
    await requestLink("vera@example.com");
    const token = (await storedTokens())[0];
    await getAuth().api.magicLinkVerify({
      query: { token },
      headers: new Headers(),
    });

    await expect(
      getAuth().api.magicLinkVerify({
        query: { token },
        headers: new Headers(),
      }),
    ).rejects.toThrow();
  });

  it("does not open with an expired link", async () => {
    await requestLink("vera@example.com");
    const token = (await storedTokens())[0];
    // The link is older than 15 minutes
    await getDb()
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(verification.identifier, `magic-link:${token}`));

    await expect(
      getAuth().api.magicLinkVerify({
        query: { token },
        headers: new Headers(),
      }),
    ).rejects.toThrow();
  });
});
