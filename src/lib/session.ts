import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type SessionUser = { id: string; email: string };

// The headers come first: they make the page wait for a request, so a build
// never gets as far as creating the auth object (it has no database or secret)
async function readSession() {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
}

// The signed-in user, or a redirect to the login page. This is the real lock
// on the app (the proxy only saves a trip): every page that reads data and
// every server action starts with it, and passes the id to the data layer.
// Called twice in one request (a page and its layout) it asks once
export const requireUser = cache(async (): Promise<SessionUser> => {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }
  return { id: session.user.id, email: session.user.email };
});

// The signed-in user, or null: for the login page, which sends signed-in
// visitors to the home page
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  return session ? { id: session.user.id, email: session.user.email } : null;
});
