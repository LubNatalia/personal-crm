import "server-only";
import nodemailer from "nodemailer";
import type { LoginEmail } from "./login-email-message";

// Where mail goes is decided by SMTP_URL, not by code: Mailpit on a laptop and
// in tests (smtp://localhost:1025), Resend on the server. Read when an email
// is sent, not on import: `next build` runs without the settings. A transport
// per email is fine for a message that is sent a few times a day
function createTransport() {
  const url = process.env.SMTP_URL;
  if (!url) {
    throw new Error("SMTP_URL is not set");
  }
  return nodemailer.createTransport(url);
}

// Resolves when the mail server has accepted the message; throws otherwise
export async function sendMail(message: LoginEmail) {
  await createTransport().sendMail(message);
}
