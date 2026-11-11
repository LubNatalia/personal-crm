import { expect, test, type Page } from "@playwright/test";
import { APP_TIME_ZONE } from "../src/lib/keep-in-touch";
import { signIn } from "./auth";
import { resetDatabase, withDatabase } from "./database";

// The success criterion of specs/02-пользователи-вход.md: two people use the
// app and neither sees the other's contacts or groups, in either direction.
// Each person has a browser context of their own, so no cookies are shared.
// Selectors are by role: Next.js keeps visited pages in the DOM hidden

const A = {
  email: "anna-a@example.com",
  contact: "Вера Козлова",
  group: "Аналитики",
};
const B = {
  email: "boris-b@example.com",
  contact: "Дмитрий Орлов",
  group: "Теннис",
};

test.beforeEach(resetDatabase);

function contactLink(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

function summary(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

function filterLink(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Фильтр по группе" })
    .getByRole("link", { name, exact: true });
}

// Creates a group on the "Группы" page
async function addGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.getByRole("textbox", { name: "Название группы" }).fill(name);
  await page.getByRole("button", { name: "Создать группу" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

// Adds a contact and returns the address of its page
async function addContact(page: Page, name: string, group: string) {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill(name);
  // The checkbox is visually hidden behind its label
  await page.getByRole("checkbox", { name: group }).check({ force: true });
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await contactLink(page, name).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url();
}

// What a person sees of the other one's data: nothing
async function expectNoTraceOf(
  page: Page,
  other: { contact: string; group: string },
  otherContactUrl: string,
  own: { contact: string; group: string },
) {
  await test.step("the list, the counter and the group filter", async () => {
    await page.goto("/");
    await expect(summary(page, "Всего: 1")).toBeVisible();
    await expect(contactLink(page, own.contact)).toBeVisible();
    await expect(contactLink(page, other.contact)).toBeHidden();
    await expect(filterLink(page, own.group)).toBeVisible();
    await expect(filterLink(page, other.group)).toBeHidden();
  });

  await test.step("search by the other's name finds nobody", async () => {
    await page.goto(`/?q=${encodeURIComponent(other.contact.split(" ")[1])}`);
    await expect(summary(page, "Найдено: 0 из 1")).toBeVisible();
    await expect(contactLink(page, other.contact)).toBeHidden();
  });

  await test.step("the groups page", async () => {
    await page.goto("/groups");
    await expect(page.getByText(own.group, { exact: true })).toBeVisible();
    await expect(page.getByText(other.group, { exact: true })).toBeHidden();
  });

  await test.step("the other's group in the address means «Все»", async () => {
    // Group numbers are small integers: try every one that is not ours
    await page.goto("/");
    const ownHref = await filterLink(page, own.group).getAttribute("href");
    const ownId = Number(
      new URL(ownHref!, "http://x").searchParams.get("group"),
    );
    for (const id of [ownId - 1, ownId + 1]) {
      if (id < 1) continue;
      await page.goto(`/?group=${id}`);
      await expect(summary(page, "Всего: 1")).toBeVisible();
      await expect(filterLink(page, "Все")).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  await test.step("the other's contact by a direct link: not found", async () => {
    await page.goto(otherContactUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: "Контакт не найден" }),
    ).toBeVisible();
    await expect(page.getByText(other.contact)).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Имя" })).toBeHidden();
    await expect(
      page.getByRole("link", { name: "К списку контактов" }),
    ).toBeVisible();
  });
}

test("two people do not see each other's contacts and groups", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    let contactUrlA = "";
    let contactUrlB = "";

    await test.step("A and B sign in by links from the mailbox", async () => {
      await signIn(pageA, A.email);
      await signIn(pageB, B.email);
      await expect(pageA.getByText(A.email)).toBeVisible();
      await expect(pageB.getByText(B.email)).toBeVisible();
    });

    await test.step("A adds a group and a contact", async () => {
      await addGroup(pageA, A.group);
      contactUrlA = await addContact(pageA, A.contact, A.group);
    });

    await test.step("B adds a group and a contact", async () => {
      await addGroup(pageB, B.group);
      contactUrlB = await addContact(pageB, B.contact, B.group);
    });

    await test.step("B sees nothing of A", async () => {
      await expectNoTraceOf(pageB, A, contactUrlA, B);
    });

    await test.step("A sees nothing of B", async () => {
      await expectNoTraceOf(pageA, B, contactUrlB, A);
    });

    await test.step("A's contact is in place and unchanged", async () => {
      await pageA.goto(contactUrlA);
      await expect(
        pageA.getByRole("heading", { level: 1, name: A.contact }),
      ).toBeVisible();
      await expect(pageA.getByRole("textbox", { name: "Имя" })).toHaveValue(
        A.contact,
      );
      await expect(
        pageA.getByRole("checkbox", { name: A.group }),
      ).toBeChecked();
    });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("another person's birthday is not in the «Скоро день рождения» block", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const birthdayBlock = (page: Page) =>
      page.getByRole("region", { name: "Скоро день рождения" });
    // Today in the app's time zone, from the database like the app does
    const [today] = await withDatabase(
      (sql) => sql<{ day: number; month: number }[]>`
        select extract(day from d)::int as day, extract(month from d)::int as month
        from (select (now() at time zone ${APP_TIME_ZONE})::date as d) as t
      `,
    );

    await test.step("A adds a contact whose birthday is today", async () => {
      await signIn(pageA, A.email);
      await pageA.goto("/contacts/new");
      await pageA.getByRole("textbox", { name: "Имя" }).fill(A.contact);
      await pageA
        .getByRole("combobox", { name: "День", exact: true })
        .selectOption(String(today.day));
      await pageA
        .getByRole("combobox", { name: "Месяц", exact: true })
        .selectOption(String(today.month));
      await pageA.getByRole("button", { name: "Добавить контакт" }).click();
      await expect(pageA).toHaveURL(/\/\?added=\d+$/);
      await expect(
        birthdayBlock(pageA).getByRole("link", { name: A.contact }),
      ).toBeVisible();
    });

    await test.step("B, a new user, has no block at all", async () => {
      await signIn(pageB, B.email);
      await expect(
        pageB.getByText("Контактов пока нет. Добавьте первый."),
      ).toBeVisible();
      await expect(birthdayBlock(pageB)).toBeHidden();
      await expect(
        pageB.getByRole("region", { name: /^Пора связаться/ }),
      ).toBeHidden();
      await expect(pageB.getByText(A.contact)).toBeHidden();
    });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("the same group name is allowed for two people", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await signIn(pageA, A.email);
    await signIn(pageB, B.email);

    await addGroup(pageA, "Друзья");
    await addGroup(pageB, "Друзья");

    // B has its own «Друзья» and no error
    await expect(pageB.getByText("Такая группа уже есть")).toBeHidden();
    await pageB.goto("/groups");
    await expect(pageB.getByText("Друзья", { exact: true })).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("a deleted contact opens as «Контакт не найден»", async ({ page }) => {
  await signIn(page, A.email);
  await addGroup(page, A.group);
  const url = await addContact(page, "Анна Удалённая", A.group);

  await page.getByRole("button", { name: "Удалить контакт" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить" })
    .click();
  await expect(page).toHaveURL(/\/\?deleted=/);

  await page.goto(url);

  await expect(
    page.getByRole("heading", { level: 1, name: "Контакт не найден" }),
  ).toBeVisible();
});
