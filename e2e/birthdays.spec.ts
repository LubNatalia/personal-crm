import { expect, test, type Page } from "@playwright/test";
import {
  formatBirthdayBadge,
  formatBirthdayDate,
  formatTurningAge,
} from "../src/lib/birthdays";
import { APP_TIME_ZONE } from "../src/lib/keep-in-touch";
import { addDays } from "../src/test/days";
import { signIn } from "./auth";
import { resetDatabase, TEST_USER_ID, withDatabase } from "./database";

// Main paths of birthdays, from openspec/specs/birthdays/spec.md. Days are
// counted by the database from now(), so the tests put birthdays at days
// relative to the database's today instead of changing "today". Selectors
// are by role or filtered by visibility: Next.js keeps visited pages in the
// DOM hidden

// A leap year: a birthday that falls on February 29 is still a real date
const BIRTH_YEAR = 1992;

test.beforeEach(resetDatabase);
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// Today in the app's time zone, taken from the database like the app does
async function getToday() {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ day: string }[]>`
      select to_char((now() at time zone ${APP_TIME_ZONE})::date, 'YYYY-MM-DD') as day
    `;
    return row.day;
  });
}

// Contacts whose birthday is `inDays` days from today, born in BIRTH_YEAR
async function addBirthdayContacts(
  today: string,
  rows: { name: string; inDays: number }[],
) {
  await withDatabase(async (sql) => {
    for (const { name, inDays } of rows) {
      const [, month, day] = addDays(today, inDays).split("-").map(Number);
      await sql`
        insert into contacts (user_id, name, birth_day, birth_month, birth_year)
        values (${TEST_USER_ID}, ${name}, ${day}, ${month}, ${BIRTH_YEAR})
      `;
    }
  });
}

// A contact due to be in touch with today: weekly, last in touch a week ago
async function addDueContact(name: string) {
  await withDatabase(async (sql) => {
    await sql`
      insert into contacts
        (user_id, name, contact_frequency, frequency_set_at, last_contacted_at)
      values (${TEST_USER_ID}, ${name}, 'week', now() - interval '7 days', now() - interval '7 days')
    `;
  });
}

async function addGroup(name: string, memberNames: string[]) {
  await withDatabase(async (sql) => {
    const [group] = await sql<{ id: number }[]>`
      insert into groups (user_id, name)
      values (${TEST_USER_ID}, ${name}) returning id
    `;
    await sql`
      insert into contact_groups (contact_id, group_id)
      select id, ${group.id} from contacts where name in ${sql(memberNames)}
    `;
  });
}

function birthdayBlock(page: Page) {
  return page.getByRole("region", { name: "Скоро день рождения" });
}

function birthdayRows(page: Page) {
  return birthdayBlock(page).getByRole("listitem");
}

function dueBlock(page: Page) {
  return page.getByRole("region", { name: /^Пора связаться/ });
}

function daySelect(page: Page) {
  return page.getByRole("combobox", { name: "День", exact: true });
}

function monthSelect(page: Page) {
  return page.getByRole("combobox", { name: "Месяц", exact: true });
}

function yearInput(page: Page) {
  return page.getByRole("textbox", { name: "Год", exact: true });
}

// What the birth date field shows: day, month and year
async function expectBirthDate(
  page: Page,
  day: string,
  month: string,
  year: string,
) {
  await expect(daySelect(page).locator("option:checked")).toHaveText(day);
  await expect(monthSelect(page).locator("option:checked")).toHaveText(month);
  await expect(yearInput(page)).toHaveValue(year);
}

function openContact(page: Page, name: string) {
  return test.step(`open the card of ${name}`, async () => {
    await page.goto("/");
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
}

function saveCard(page: Page) {
  return test.step("save the card", async () => {
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Изменения сохранены" }),
    ).toBeVisible();
  });
}

function search(page: Page, text: string) {
  return test.step(`search for "${text}"`, async () => {
    await page.getByRole("searchbox", { name: "Поиск по имени" }).fill(text);
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(
      page.getByText(/^Найдено:/).filter({ visible: true }),
    ).toBeVisible();
  });
}

test("set a birth date, see it after a reload, then clear it", async ({
  page,
}) => {
  await openContact(page, "Анна Смирнова");

  await test.step("the field is empty at first", async () => {
    await expectBirthDate(page, "День", "Месяц", "");
  });

  await test.step("14 ноября 1990 is kept after a reload", async () => {
    await daySelect(page).selectOption("14");
    await monthSelect(page).selectOption({ label: "ноября" });
    await yearInput(page).fill("1990");
    await saveCard(page);
    // The lists keep the saved values right after saving
    await expectBirthDate(page, "14", "ноября", "1990");

    await page.reload();
    await expectBirthDate(page, "14", "ноября", "1990");
  });

  await test.step("cleared, the field is empty after a reload", async () => {
    await daySelect(page).selectOption("");
    await monthSelect(page).selectOption("");
    await yearInput(page).fill("");
    await saveCard(page);

    await page.reload();
    await expectBirthDate(page, "День", "Месяц", "");
  });
});

test("a date that doesn't exist is not saved, the input stays", async ({
  page,
}) => {
  await openContact(page, "Анна Смирнова");
  const phone = page.getByRole("textbox", { name: "Телефон" });

  await phone.fill("+7 900 111-22-33");
  await daySelect(page).selectOption("31");
  await monthSelect(page).selectOption({ label: "апреля" });
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(
    page.getByText("Такой даты нет").filter({ visible: true }),
  ).toBeVisible();
  await expect(phone).toHaveValue("+7 900 111-22-33");
  await expectBirthDate(page, "31", "апреля", "");

  await test.step("nothing was saved", async () => {
    await page.reload();
    await expect(phone).toHaveValue("");
    await expectBirthDate(page, "День", "Месяц", "");
  });
});

test("the block shows birthdays of the coming week above «Пора связаться»", async ({
  page,
}) => {
  const today = await getToday();
  await addBirthdayContacts(today, [
    { name: "Ирина", inDays: 7 },
    { name: "Олег", inDays: 8 },
    { name: "Борис", inDays: 1 },
    { name: "Анна", inDays: 0 },
  ]);
  await addDueContact("Пётр");
  const rows = birthdayRows(page);

  await page.goto("/");

  await test.step("today, tomorrow and in 7 days, nearest first", async () => {
    await expect(rows).toHaveCount(3);
    const expected = [
      { name: "Анна", inDays: 0 },
      { name: "Борис", inDays: 1 },
      { name: "Ирина", inDays: 7 },
    ];
    for (const [index, { name, inDays }] of expected.entries()) {
      const day = addDays(today, inDays);
      const age = Number(day.slice(0, 4)) - BIRTH_YEAR;
      const row = rows.nth(index);
      await expect(row.getByRole("link")).toHaveText(name);
      await expect(row).toContainText(formatBirthdayDate(day));
      await expect(row).toContainText(formatBirthdayBadge(inDays));
      await expect(row).toContainText(formatTurningAge(age, inDays === 0));
    }
    await expect(birthdayBlock(page)).not.toContainText("Олег");
  });

  await test.step("the block is above «Пора связаться»", async () => {
    await expect(dueBlock(page)).toBeVisible();
    const birthdayBox = await birthdayBlock(page).boundingBox();
    const dueBox = await dueBlock(page).boundingBox();
    expect(birthdayBox!.y).toBeLessThan(dueBox!.y);
  });

  await test.step("a row opens the contact's card", async () => {
    // The name link stretches over the row: a click on the date opens it
    // too. Forced, as Playwright won't click an element covered by the link
    await rows
      .nth(1)
      .getByText(formatBirthdayDate(addDays(today, 1)))
      .click({ force: true });
    await expect(
      page.getByRole("heading", { level: 1, name: "Борис" }),
    ).toBeVisible();
  });
});

test.describe("when the block is hidden", () => {
  test("while searching and while a group is chosen", async ({ page }) => {
    const today = await getToday();
    await addBirthdayContacts(today, [
      { name: "Анна", inDays: 0 },
      { name: "Иван", inDays: 3 },
    ]);
    await addGroup("Теннис", ["Анна"]);
    const tennis = page.getByRole("link", { name: "Теннис", exact: true });

    await page.goto("/");
    await expect(birthdayBlock(page)).toBeVisible();

    await search(page, "Иван");
    await expect(birthdayBlock(page)).toBeHidden();

    await page.getByRole("link", { name: "Сбросить" }).click();
    await expect(birthdayBlock(page)).toBeVisible();

    // Hidden even though Анна from "Теннис" has a birthday today
    await tennis.click();
    await expect(tennis).toHaveAttribute("aria-current", "page");
    await expect(birthdayBlock(page)).toBeHidden();

    await page.getByRole("link", { name: "Все", exact: true }).click();
    await expect(birthdayBlock(page)).toBeVisible();
  });

  test("when no birthday falls on the coming week", async ({ page }) => {
    const today = await getToday();
    await addBirthdayContacts(today, [
      { name: "Олег", inDays: 8 },
      { name: "Вера", inDays: -1 },
    ]);

    await page.goto("/");
    await expect(
      page.getByText("Всего: 4").filter({ visible: true }),
    ).toBeVisible();
    await expect(birthdayBlock(page)).toBeHidden();
  });
});
