import "server-only";
import { and, count, eq, gt, lte, sql } from "drizzle-orm";
import { getDb } from "./index";
import { loginEmailSends } from "./schema";

// At most this many login emails to one address within the window
export const LOGIN_EMAIL_LIMIT = 3;
const WINDOW = sql`interval '10 minutes'`;

// Asks to send one more login email to the address. Returns true and records
// the send when the limit allows it, false (and records nothing) when the
// address already got LOGIN_EMAIL_LIMIT emails in the last 10 minutes.
// The address is counted in lower case without spaces
export async function recordLoginEmailSend(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();

  return getDb().transaction(async (tx) => {
    // Requests for one address wait for each other: without it two
    // simultaneous requests would both count the same sends and both pass.
    // The lock is released when the transaction ends
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

    // Old sends are of no use: drop them while we are here
    await tx
      .delete(loginEmailSends)
      .where(
        and(
          eq(loginEmailSends.email, email),
          lte(loginEmailSends.sentAt, sql`now() - ${WINDOW}`),
        ),
      );

    const [{ value: recent }] = await tx
      .select({ value: count() })
      .from(loginEmailSends)
      .where(
        and(
          eq(loginEmailSends.email, email),
          gt(loginEmailSends.sentAt, sql`now() - ${WINDOW}`),
        ),
      );
    if (recent >= LOGIN_EMAIL_LIMIT) {
      return false;
    }

    await tx.insert(loginEmailSends).values({ email });
    return true;
  });
}
