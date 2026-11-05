// Reads the emails the app sent to Mailpit (the mail catcher from
// docker-compose.yml), through its HTTP API. Shared by Vitest and Playwright,
// so no "server-only" and no import.meta here

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Address = { Name: string; Address: string };

type MessageSummary = {
  ID: string;
  From: Address;
  To: Address[];
  Subject: string;
  Created: string;
};

export type CaughtEmail = MessageSummary & { Text: string; HTML: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  } catch (error) {
    throw new Error(
      `Mailpit is not reachable at ${MAILPIT_URL}: start it with "docker compose up -d"`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(`Mailpit ${path} answered ${response.status}`);
  }
  // Deleting answers with the plain text "ok", reading with JSON
  const body = await response.text();
  return (body.startsWith("{") ? JSON.parse(body) : body) as T;
}

// Empties the inbox, so a test sees only its own emails
export async function clearMailbox() {
  await api("/messages", { method: "DELETE" });
}

// Newest first
export async function listEmails(to?: string) {
  const { messages } = await api<{ messages: MessageSummary[] }>(
    to ? `/search?query=${encodeURIComponent(`to:${to}`)}` : "/messages",
  );
  return messages;
}

async function readEmail(id: string) {
  return api<CaughtEmail>(`/message/${id}`);
}

// Waits for the newest email to the address and returns it with its body.
// Messages already counted by `seen` don't count: pass how many emails the
// address had before the step that should send a new one
export async function waitForEmail(
  to: string,
  { seen = 0, timeoutMs = 10_000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const messages = await listEmails(to);
    if (messages.length > seen) {
      return readEmail(messages[0].ID);
    }
    if (Date.now() > deadline) {
      throw new Error(`No new email to ${to} in ${timeoutMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

// The login link from the plain-text version of the email
export function loginLinkOf(email: Pick<CaughtEmail, "Text">) {
  const match = email.Text.match(/https?:\/\/\S+/);
  if (!match) {
    throw new Error(`No link in the email:\n${email.Text}`);
  }
  return match[0];
}
