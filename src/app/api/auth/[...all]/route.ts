import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Everything under /api/auth: following the link from the email, signing out.
// The auth object is made per request, not on import: `next build` loads this
// file without the database and the secret
export function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
