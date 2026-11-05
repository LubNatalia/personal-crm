import { NextResponse, type NextRequest } from "next/server";

// Pages and addresses open without signing in: the login page, the "link is
// out of date" page, the addresses Better Auth works on (following the link
// from the email) and the deploy's health check
const OPEN_PATHS = ["/login", "/login/expired", "/health"];
const OPEN_PREFIXES = ["/api/auth/"];

const SESSION_COOKIE_SUFFIX = "better-auth.session_token";
// Same as the session lifetime in auth.ts
const SESSION_DAYS = 30;

function isOpen(pathname: string) {
  return (
    OPEN_PATHS.includes(pathname) ||
    OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

// A shortcut, not the lock: someone without a login cookie is sent to the
// login page before any page is built. Whether the cookie is good is checked
// by requireUser() in every page and server action
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.cookies
    .getAll()
    .find(({ name }) => name.endsWith(SESSION_COOKIE_SUFFIX));

  if (!cookie && !isOpen(pathname)) {
    // The address of the app comes from the setting, not from the request:
    // behind nginx the host of request.url may be the server's inner one
    const base = process.env.BETTER_AUTH_URL ?? request.url;
    return NextResponse.redirect(new URL("/login", base));
  }

  const response = NextResponse.next();
  // "Signed in for 30 days from the last visit": the database moves the end
  // of the session on a visit, but a cookie made at login would still expire
  // 30 days after it. Every page visit gives it another 30 days. Not on
  // POST: signing out is a POST, and its cleared cookie must stay cleared
  if (cookie && request.method === "GET") {
    response.cookies.set(cookie.name, cookie.value, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookie.name.startsWith("__Secure-"),
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  }
  return response;
}

export const config = {
  // Everything except Next.js's own files and the static files in public/
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|.*\\.(?:svg|png|jpg|jpeg|ico|webp|css|js)$).*)",
  ],
};
