import { expect, test, type Page } from "@playwright/test";
import { requestLoginLink, signIn, TEST_USER_EMAIL } from "./auth";
import { resetDatabase, withDatabase } from "./database";
import { listEmails, loginLinkOf, waitForEmail } from "./mailpit";

// Login by a link from an email, from openspec/specs/user-auth/spec.md. The
// emails are caught by Mailpit and read through its API; nothing is mocked.
// Selectors are by role: Next.js keeps visited pages in the DOM hidden

test.beforeEach(resetDatabase);

function loginHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: "Вход" });
}

function expiredHeading(page: Page) {
  return page.getByRole("heading", {
    level: 1,
    name: "Ссылка устарела, запросите новую",
  });
}

function homeHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: "Контакты" });
}

function sentNotice(page: Page, email: string) {
  return page
    .getByRole("status")
    .filter({ hasText: `Ссылка для входа отправлена на ${email}` });
}

// Asks for a link and returns it from the email, without opening it
async function takeLink(page: Page, email: string) {
  const seen = (await listEmails(email)).length;
  await requestLoginLink(page, email);
  await expect(sentNotice(page, email)).toBeVisible();
  return loginLinkOf(await waitForEmail(email, { seen }));
}

test.describe("closed without a login", () => {
  test("every page leads to the login page", async ({ page }) => {
    await test.step("the home page", async () => {
      await page.goto("/");
      await expect(loginHeading(page)).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Почта" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Получить ссылку" }),
      ).toBeVisible();
    });

    await test.step("the groups page", async () => {
      await page.goto("/groups");
      await expect(loginHeading(page)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Группы" })).toBeHidden();
    });

    await test.step("the page of a contact: no data on it", async () => {
      await page.goto("/contacts/1");
      await expect(loginHeading(page)).toBeVisible();
      await expect(page.getByText("Анна Смирнова")).toBeHidden();
    });

    await test.step("the page of a new contact", async () => {
      await page.goto("/contacts/new");
      await expect(loginHeading(page)).toBeVisible();
    });
  });

  test("the health check answers without a login", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  test("the login pages have no email and no «Выйти»", async ({ page }) => {
    await page.goto("/login");

    await expect(loginHeading(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeHidden();
  });

  test("a form sent after the login ended saves nothing", async ({ page }) => {
    await signIn(page);
    await page.goto("/contacts/new");
    await page
      .getByRole("textbox", { name: "Имя" })
      .fill("Не должен сохраниться");
    // The login ends meanwhile (a week of silence, another device...)
    await withDatabase((sql) => sql`delete from session`);

    await page.getByRole("button", { name: "Добавить контакт" }).click();

    await expect(loginHeading(page)).toBeVisible();
    const saved = await withDatabase(
      (sql) => sql`select 1 from contacts where name = 'Не должен сохраниться'`,
    );
    expect(saved).toHaveLength(0);
  });
});

test.describe("asking for a link", () => {
  test("a wrong address is refused under the field, no email", async ({
    page,
  }) => {
    await page.goto("/login");
    const field = page.getByRole("textbox", { name: "Почта" });

    await field.fill("anna@");
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText("Проверьте адрес почты")).toBeVisible();
    await expect(field).toHaveValue("anna@");
    await expect(page.getByRole("status")).toBeHidden();

    await field.fill("");
    await page.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(page.getByText("Проверьте адрес почты")).toBeVisible();

    expect(await listEmails()).toEqual([]);
  });

  test("the link is sent and the email has what the spec asks", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Почта" })
      .fill("  Anna@Example.COM  ");
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(sentNotice(page, "anna@example.com")).toBeVisible();
    // The form stays, to fix a typo or to ask again
    await expect(
      page.getByRole("button", { name: "Получить ссылку" }),
    ).toBeEnabled();

    const email = await waitForEmail("anna@example.com");
    expect(email.From).toMatchObject({
      Name: "Личная CRM",
      Address: "noreply@mail.crm.lyna.tech",
    });
    expect(email.Subject).toBe("Вход в Личную CRM");
    expect(email.HTML).toContain("Войти");
    expect(email.HTML).toContain("Ссылка работает 15 минут");
    expect(email.HTML).toContain(
      "Если вы не запрашивали вход - просто проигнорируйте письмо",
    );
    expect(email.Text).toContain(
      "Если вы не запрашивали вход - просто проигнорируйте письмо",
    );
    expect(loginLinkOf(email)).toMatch(/^http:\/\/localhost:3200\/api\/auth\//);
  });

  test("a known and a new address get the same answer", async ({ page }) => {
    await requestLoginLink(page, TEST_USER_EMAIL);
    await expect(sentNotice(page, TEST_USER_EMAIL)).toBeVisible();

    await requestLoginLink(page, "new-person@example.com");
    await expect(sentNotice(page, "new-person@example.com")).toBeVisible();
  });

  test("the fourth request in 10 minutes is refused, no fourth email", async ({
    page,
  }) => {
    const email = "anna@example.com";
    for (let i = 0; i < 3; i++) {
      await requestLoginLink(page, email);
      await expect(sentNotice(page, email)).toBeVisible();
    }
    expect(await listEmails(email)).toHaveLength(3);

    await requestLoginLink(page, "ANNA@example.com");

    await expect(
      page.getByText("Слишком часто, попробуйте через несколько минут"),
    ).toBeVisible();
    expect(await listEmails(email)).toHaveLength(3);

    // Another address is not affected
    await requestLoginLink(page, "boris@example.com");
    await expect(sentNotice(page, "boris@example.com")).toBeVisible();
  });
});

test.describe("signing in and out", () => {
  test("the link opens the home page with the email in the header", async ({
    page,
  }) => {
    const link = await takeLink(page, "anna@example.com");

    await page.goto(link);

    await expect(homeHeading(page)).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("anna@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
  });

  test("the first login of a new address makes a user with an empty list", async ({
    page,
  }) => {
    await signIn(page, "vera@example.com");

    await expect(
      page.getByText("Контактов пока нет. Добавьте первый."),
    ).toBeVisible();
    const users = await withDatabase(
      (sql) =>
        sql<{ email: string }[]>`select email from "user" order by email`,
    );
    expect(users.map((user) => user.email)).toEqual([
      "tester@example.com",
      "vera@example.com",
    ]);
  });

  test("the known user sees their contacts", async ({ page }) => {
    await signIn(page);

    await expect(
      page.getByText("Всего: 2").filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByText(TEST_USER_EMAIL)).toBeVisible();
  });

  test("a signed-in visitor of the login page goes to the home page", async ({
    page,
  }) => {
    await signIn(page);

    await page.goto("/login");

    await expect(homeHeading(page)).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("«Выйти» opens the login page and closes the app", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: "Выйти" }).click();

    await expect(loginHeading(page)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(loginHeading(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeHidden();
  });

  test("two devices: signing out on one keeps the other", async ({
    page,
    browser,
  }) => {
    await signIn(page);
    const phone = await browser.newContext();
    try {
      const phonePage = await phone.newPage();
      await signIn(phonePage);

      await phonePage.getByRole("button", { name: "Выйти" }).click();
      await expect(loginHeading(phonePage)).toBeVisible();

      // The laptop is still in the app
      await page.reload();
      await expect(homeHeading(page)).toBeVisible();
      await page.goto("/groups");
      await expect(page.getByRole("heading", { name: "Группы" })).toBeVisible();
    } finally {
      await phone.close();
    }
  });
});

test.describe("a link that does not work", () => {
  test("a link used once does not open again", async ({ page }) => {
    const link = await takeLink(page, "anna@example.com");
    await page.goto(link);
    await expect(homeHeading(page)).toBeVisible();
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(loginHeading(page)).toBeVisible();

    await page.goto(link);

    await expect(expiredHeading(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeHidden();
    // Not signed in: the home page still asks for a login
    await page.goto("/");
    await expect(loginHeading(page)).toBeVisible();
  });

  test("the button on the expired page leads to the login page", async ({
    page,
  }) => {
    const link = await takeLink(page, "anna@example.com");
    await page.goto(link);
    await page.getByRole("button", { name: "Выйти" }).click();
    await page.goto(link);
    await expect(expiredHeading(page)).toBeVisible();

    await page.getByRole("link", { name: "Войти снова" }).click();

    await expect(loginHeading(page)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Почта" })).toBeVisible();
  });

  test("a new link cancels the earlier one", async ({ page }) => {
    const first = await takeLink(page, "anna@example.com");
    const second = await takeLink(page, "anna@example.com");

    await page.goto(first);
    await expect(expiredHeading(page)).toBeVisible();

    await page.goto(second);
    await expect(homeHeading(page)).toBeVisible();
  });

  test("a link older than 15 minutes does not open", async ({ page }) => {
    const link = await takeLink(page, "anna@example.com");
    // The link was made 16 minutes ago: its end is 1 minute ago
    await withDatabase(
      (sql) =>
        sql`update verification set expires_at = now() - interval '1 minute'`,
    );

    await page.goto(link);

    await expect(expiredHeading(page)).toBeVisible();
    await page.goto("/");
    await expect(loginHeading(page)).toBeVisible();
  });

  test("a link with a made-up code does not open", async ({ page }) => {
    await page.goto(
      "/api/auth/magic-link/verify?token=made-up-code&callbackURL=%2F&errorCallbackURL=%2Flogin%2Fexpired",
    );

    await expect(expiredHeading(page)).toBeVisible();
  });

  test("a link with a changed code does not open", async ({ page }) => {
    const link = new URL(await takeLink(page, "anna@example.com"));
    link.searchParams.set("token", `${link.searchParams.get("token")}x`);

    await page.goto(link.toString());

    await expect(expiredHeading(page)).toBeVisible();
  });
});

test.describe("how long the login lasts", () => {
  test("a login with its end in the past shows the login page", async ({
    page,
  }) => {
    await signIn(page);
    await withDatabase(
      (sql) => sql`update session set expires_at = now() - interval '1 minute'`,
    );

    await page.goto("/");

    await expect(loginHeading(page)).toBeVisible();
  });

  test("a visit moves the end of the login 30 days forward", async ({
    page,
    context,
  }) => {
    await signIn(page);
    // Signed in 2 days ago, 5 days left: a visit now should extend it
    await withDatabase(
      (sql) => sql`
        update session
        set updated_at = now() - interval '2 days',
            expires_at = now() + interval '5 days'
      `,
    );

    await page.goto("/");
    await expect(homeHeading(page)).toBeVisible();

    const [{ days }] = await withDatabase(
      (sql) => sql<{ days: number }[]>`
        select extract(epoch from (expires_at - now())) / 86400 as days
        from session
      `,
    );
    expect(Number(days)).toBeGreaterThan(29);

    // The cookie lives as long: it is renewed on a visit too
    const cookie = (await context.cookies()).find((item) =>
      item.name.endsWith("session_token"),
    );
    expect(cookie?.expires).toBeGreaterThan(
      Date.now() / 1000 + 29 * 24 * 60 * 60,
    );
  });
});

test.describe("the header on a phone", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("a long email is cut and the page does not scroll sideways", async ({
    page,
  }) => {
    const email =
      "very.long.address.of.a.person.with.a.long.name@example-company.com";
    await signIn(page, email);

    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(sideways).toBe(false);
    // The full address stays available on hover
    await expect(page.getByText(email)).toHaveAttribute("title", email);
  });

  test("the login page fits too", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("button", { name: "Получить ссылку" }),
    ).toBeVisible();
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(sideways).toBe(false);
  });
});
