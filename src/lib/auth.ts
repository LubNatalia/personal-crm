import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { getDb } from "@/db";
import { recordLoginEmailSend } from "@/db/login-email-sends";
import * as schema from "@/db/schema";
import { buildLoginEmail, LOGIN_LINK_MINUTES } from "./login-email-message";
import { parseLoginEmail } from "./login-email";
import { sendMail } from "./mailer";

const DAY_SECONDS = 24 * 60 * 60;

export const TOO_MANY_LOGIN_EMAILS =
  "Слишком часто, попробуйте через несколько минут";

// Better Auth keeps a login link as a row of `verification`: the identifier
// holds the link's token, the value is JSON with the email it was sent to
const LINK_PREFIX = "magic-link:";

function createAuth() {
  return betterAuth({
    // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    session: {
      // Signed in for 30 days from the last visit: a visit moves the end
      // forward, at most once a day
      expiresIn: 30 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      // No session copy in a cookie: "Sign out" has to work at once
      cookieCache: { enabled: false },
    },
    advanced: {
      // The login cookie belongs only to the host it was set on (no Domain
      // attribute): a login on test-app.lyna.tech never reaches app.lyna.tech
      // or the other way round. This is Better Auth's default, kept explicit
      crossSubDomainCookies: { enabled: false },
    },
    hooks: {
      // The one place for the address rules, so a request that does not come
      // from the form passes the same checks as the form
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") {
          return;
        }
        const body = ctx.body as { email?: unknown } | undefined;
        const parsed = parseLoginEmail(
          typeof body?.email === "string" ? body.email : null,
        );
        if (!parsed.ok) {
          throw new APIError("BAD_REQUEST", { message: parsed.error });
        }
        return {
          context: { ...ctx, body: { ...ctx.body, email: parsed.email } },
        };
      }),
    },
    plugins: [
      magicLink({
        expiresIn: LOGIN_LINK_MINUTES * 60,
        // Better Auth's own limit counts requests per IP address (5 a minute
        // by default), not per email: the limit that matters is ours, in
        // sendMagicLink. Guessing a 32-letter code is hopeless anyway, and
        // the tests open many links from one address
        rateLimit: { window: 60, max: 60 },
        // A new address signs up with its first login: no form, no name
        disableSignUp: false,
        sendMagicLink: async ({ email, url, token }) => {
          const db = getDb();
          const thisLink = `${LINK_PREFIX}${token}`;
          const forgetThisLink = () =>
            db
              .delete(schema.verification)
              .where(eq(schema.verification.identifier, thisLink));

          // Over the limit: the link Better Auth has just made is useless
          if (!(await recordLoginEmailSend(email))) {
            await forgetThisLink();
            throw new APIError("TOO_MANY_REQUESTS", {
              message: TOO_MANY_LOGIN_EMAILS,
            });
          }

          // Only the newest link works: cancel the earlier ones of the address
          const sentTo = JSON.stringify({ type: "magic-link", email }).slice(
            0,
            -1,
          );
          await db.delete(schema.verification).where(
            and(
              sql`starts_with(${schema.verification.identifier}, ${LINK_PREFIX})`,
              sql`${schema.verification.identifier} <> ${thisLink}`,
              // The value starts with {"type":"magic-link","email":"<address>"
              // and goes on with "," or "}", so the address matches exactly
              sql`starts_with(${schema.verification.value}, ${sentTo})`,
            ),
          );

          try {
            await sendMail(buildLoginEmail(email, url));
          } catch (error) {
            // Not delivered: nobody can open this link, don't keep it
            await forgetThisLink();
            throw error;
          }
        },
      }),
      // Last: lets server actions set and clear the login cookie
      nextCookies(),
    ],
  });
}

// Created on first use, not on import: `next build` loads this module without
// DATABASE_URL and the secret. Kept on globalThis to survive hot reloads
const globalForAuth = globalThis as unknown as {
  auth?: ReturnType<typeof createAuth>;
};

export function getAuth() {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
