import { expect, test, type Page } from "@playwright/test";
import { resetDatabase, SEEDED_CONTACTS } from "./database";

// The main scenario from specs/01-продуктовая-идея.md. Selectors are by role:
// Next.js keeps visited pages in the DOM hidden, and roles skip hidden copies

const NEW_CONTACT = {
  name: "Вера Козлова",
  about: "Учились вместе",
  phone: "+7 900 123-45-67",
};
const NOTE = "Созвонились: договорились встретиться в субботу";

function contactLink(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

function listSummary(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

// Other test files change the data: start from the known contacts
test.beforeAll(resetDatabase);

test("open the list, add a contact, find it and add a note", async ({
  page,
  browser,
}) => {
  const allNames = [
    ...SEEDED_CONTACTS.map((contact) => contact.name),
    NEW_CONTACT.name,
  ];

  await test.step("open: the list shows all contacts", async () => {
    await page.goto("/");
    await expect(
      listSummary(page, `Всего: ${SEEDED_CONTACTS.length}`),
    ).toBeVisible();
    for (const contact of SEEDED_CONTACTS) {
      await expect(contactLink(page, contact.name)).toBeVisible();
    }
  });

  await test.step("add a contact: it appears in the list", async () => {
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Новый контакт" }),
    ).toBeVisible();

    await page.getByRole("textbox", { name: "Имя" }).fill(NEW_CONTACT.name);
    await page
      .getByRole("textbox", { name: "Кто это" })
      .fill(NEW_CONTACT.about);
    await page
      .getByRole("textbox", { name: "Телефон" })
      .fill(NEW_CONTACT.phone);
    await page.getByRole("button", { name: "Добавить контакт" }).click();

    await expect(page).toHaveURL(/\/\?added=\d+$/);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Контакт «${NEW_CONTACT.name}» добавлен` }),
    ).toBeVisible();
    await expect(listSummary(page, `Всего: ${allNames.length}`)).toBeVisible();
    await expect(contactLink(page, NEW_CONTACT.name)).toBeVisible();
  });

  await test.step("find the contact by name and open the card", async () => {
    await page
      .getByRole("searchbox", { name: "Поиск по имени" })
      .fill("козлова");
    await page.getByRole("button", { name: "Найти" }).click();

    await expect(page).toHaveURL(/[?&]q=/);
    await expect(
      listSummary(page, `Найдено: 1 из ${allNames.length}`),
    ).toBeVisible();
    for (const contact of SEEDED_CONTACTS) {
      await expect(contactLink(page, contact.name)).toBeHidden();
    }

    await contactLink(page, NEW_CONTACT.name).click();
    await expect(
      page.getByRole("heading", { level: 1, name: NEW_CONTACT.name }),
    ).toBeVisible();
  });

  await test.step("add a note after a talk and save it", async () => {
    await page.getByRole("textbox", { name: "Заметки" }).fill(NOTE);
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Изменения сохранены" }),
    ).toBeVisible();
  });

  await test.step("the note is kept in the card after a reload", async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: NEW_CONTACT.name }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Заметки" })).toHaveValue(
      NOTE,
    );
    await expect(page.getByRole("textbox", { name: "Кто это" })).toHaveValue(
      NEW_CONTACT.about,
    );
  });

  await test.step("another browser at the same address sees the same contacts", async () => {
    // A separate context shares no cookies or storage with the first one,
    // like a different browser: everything it sees comes from the server
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto(new URL("/", page.url()).toString());

      await expect(
        listSummary(otherPage, `Всего: ${allNames.length}`),
      ).toBeVisible();
      for (const name of allNames) {
        await expect(contactLink(otherPage, name)).toBeVisible();
      }

      await contactLink(otherPage, NEW_CONTACT.name).click();
      await expect(
        otherPage.getByRole("textbox", { name: "Заметки" }),
      ).toHaveValue(NOTE);
    } finally {
      await other.close();
    }
  });
});
