import { expect, type Page } from "@playwright/test";
import { listEmails, loginLinkOf, waitForEmail } from "./mailpit";

// The user every test starts with (see resetDatabase)
export const TEST_USER_EMAIL = "tester@example.com";

// Types the address in the login form and presses "Получить ссылку"
export async function requestLoginLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Почта" }).fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

// Signs in the way a person does: asks for a link on the login page, takes
// it from the email in Mailpit and opens it. Ends on the home page
export async function signIn(page: Page, email = TEST_USER_EMAIL) {
  const seen = (await listEmails(email.toLowerCase())).length;

  await requestLoginLink(page, email);
  await expect(
    page.getByRole("status").filter({ hasText: "Ссылка для входа отправлена" }),
  ).toBeVisible();

  const letter = await waitForEmail(email.toLowerCase(), { seen });
  await page.goto(loginLinkOf(letter));

  await expect(
    page.getByRole("heading", { level: 1, name: "Контакты" }),
  ).toBeVisible();
}
