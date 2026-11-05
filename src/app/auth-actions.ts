"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, TOO_MANY_LOGIN_EMAILS } from "@/lib/auth";
import { parseLoginEmail } from "@/lib/login-email";

// What the login form shows after a try
export type LoginFormState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; email: string; error: string };

const LOGIN_FAILED = "Не получилось отправить письмо, попробуйте ещё раз";

// "Get the link": the same address rules as the server applies to any
// request (parseLoginEmail), then Better Auth makes the link and sends the
// email. The answer does not depend on whether the address is known
export async function requestLoginLinkAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const raw = formData.get("email");
  const typed = typeof raw === "string" ? raw : "";

  const parsed = parseLoginEmail(typed);
  if (!parsed.ok) {
    return { status: "error", email: typed, error: parsed.error };
  }

  try {
    await getAuth().api.signInMagicLink({
      body: {
        email: parsed.email,
        callbackURL: "/",
        errorCallbackURL: "/login/expired",
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 429) {
      return { status: "error", email: typed, error: TOO_MANY_LOGIN_EMAILS };
    }
    console.error("Could not send the login email", error);
    return { status: "error", email: typed, error: LOGIN_FAILED };
  }
  return { status: "sent", email: parsed.email };
}

// Ends the login on this device only and opens the login page
export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
