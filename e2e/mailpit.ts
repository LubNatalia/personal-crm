// The emails the app sent to Mailpit: the helpers live in src/test, shared
// with the Vitest tests
export {
  clearMailbox,
  listEmails,
  loginLinkOf,
  waitForEmail,
  type CaughtEmail,
} from "../src/test/mailpit";
