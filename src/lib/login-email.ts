// The longest address email allows
export const LOGIN_EMAIL_MAX_LENGTH = 254;

export const LOGIN_EMAIL_ERROR = "Проверьте адрес почты";

type ParseLoginEmailResult =
  { ok: true; email: string } | { ok: false; error: string };

// Something before @, a dot-separated domain after it, no spaces. Whether the
// mailbox exists only the email itself can tell
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,.]+(\.[^\s@,.]+)+$/;

// The one place that decides what a login address is. Spaces at the edges are
// dropped and letters are lowered, so "Anna@Example.com " and
// "anna@example.com" are one user. The form and the server call it alike
export function parseLoginEmail(raw: string | null): ParseLoginEmailResult {
  const email = (raw ?? "").trim().toLowerCase();
  if (email.length > LOGIN_EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: LOGIN_EMAIL_ERROR };
  }
  return { ok: true, email };
}
