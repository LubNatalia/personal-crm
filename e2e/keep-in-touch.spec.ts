import { expect, test, type Page } from "@playwright/test";
import {
  APP_TIME_ZONE,
  formatDay,
  formatLastContacted,
} from "../src/lib/keep-in-touch";
import { addDays, addMonths } from "../src/test/days";
import { resetDatabase, withDatabase } from "./database";

// Main paths of keep in touch, from openspec/specs/keep-in-touch/spec.md.
// Days are counted by the database from now(), so the tests put the last
// contact in the past instead of changing "today". Selectors are by role or
// filtered by visibility: Next.js keeps visited pages in the DOM hidden

const NOTE = "Обсудили отпуск";
const NOTES_HINT = "Новая строка — новое общение: срок отсчитывается заново";

test.beforeEach(resetDatabase);

// Today in the app's time zone, taken from the database like the app does
async function getToday() {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ day: string }[]>`
      select to_char((now() at time zone ${APP_TIME_ZONE})::date, 'YYYY-MM-DD') as day
    `;
    return row.day;
  });
}

// Contacts to keep in touch with weekly, last in touch `daysAgo` days ago
async function addWeeklyContacts(
  rows: { name: string; daysAgo: number; notes?: string }[],
) {
  await withDatabase(async (sql) => {
    for (const { name, daysAgo, notes } of rows) {
      await sql`
        insert into contacts
          (name, notes, contact_frequency, frequency_set_at, last_contacted_at)
        values (
          ${name},
          ${notes ?? null},
          'week',
          now() - make_interval(days => ${daysAgo}),
          now() - make_interval(days => ${daysAgo})
        )
      `;
    }
  });
}

async function addGroup(name: string, memberNames: string[]) {
  await withDatabase(async (sql) => {
    const [group] = await sql<{ id: number }[]>`
      insert into groups (name) values (${name}) returning id
    `;
    await sql`
      insert into contact_groups (contact_id, group_id)
      select id, ${group.id} from contacts where name in ${sql(memberNames)}
    `;
  });
}

function dueBlock(page: Page) {
  return page.getByRole("region", { name: /^Пора связаться/ });
}

function dueHeading(page: Page) {
  return dueBlock(page).getByRole("heading");
}

function dueRow(page: Page, name: string) {
  return dueBlock(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
}

function blockTick(page: Page, name: string) {
  return dueBlock(page).getByRole("checkbox", { name: `Связались: ${name}` });
}

function cardTick(page: Page) {
  return page.getByRole("checkbox", { name: "Связались сегодня" });
}

function frequencyOption(page: Page) {
  return page
    .getByRole("combobox", { name: "Как часто общаться" })
    .locator("option:checked");
}

// The lines under "how often" in the contact card
function lastContactedLine(page: Page) {
  return page.getByText(/^Последнее общение:/).filter({ visible: true });
}

function dueLine(page: Page) {
  return page.getByText(/^Связаться до:/).filter({ visible: true });
}

function notesHint(page: Page) {
  return page.getByText(NOTES_HINT).filter({ visible: true });
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

test("set how often to keep in touch and see when to get in touch", async ({
  page,
  browser,
}) => {
  const today = await getToday();
  const name = "Вера Козлова";

  await test.step("a new contact: not set, no tick, no hint", async () => {
    await page.goto("/contacts/new");
    await expect(frequencyOption(page)).toHaveText("Не задано");
    await expect(cardTick(page)).toBeHidden();
    await expect(notesHint(page)).toBeHidden();

    await page.getByRole("textbox", { name: "Имя" }).fill(name);
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    await expect(page).toHaveURL(/\/\?added=\d+$/);
  });

  await test.step("its card without a frequency has no due lines", async () => {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(frequencyOption(page)).toHaveText("Не задано");
    await expect(lastContactedLine(page)).toBeHidden();
    await expect(dueLine(page)).toBeHidden();
    await expect(cardTick(page)).toBeHidden();
    await expect(notesHint(page)).toBeHidden();
  });

  await test.step("once a month: the lines, the tick and the hint appear", async () => {
    await page
      .getByRole("combobox", { name: "Как часто общаться" })
      .selectOption("month");
    await saveCard(page);

    await expect(lastContactedLine(page)).toHaveText(
      "Последнее общение: не отмечено",
    );
    await expect(dueLine(page)).toHaveText(
      `Связаться до: ${formatDay(addMonths(today, 1), today)}`,
    );
    await expect(cardTick(page)).not.toBeChecked();
    await expect(notesHint(page)).toBeVisible();
  });

  await test.step("the frequency is kept after a reload", async () => {
    await page.reload();
    await expect(frequencyOption(page)).toHaveText("Раз в месяц");
  });

  await test.step("another browser sees the same frequency", async () => {
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto(page.url());
      await expect(frequencyOption(otherPage)).toHaveText("Раз в месяц");
    } finally {
      await other.close();
    }
  });
});

test("tick a contact in the block on the home page", async ({ page }) => {
  const today = await getToday();
  await addWeeklyContacts([
    { name: "Анна", daysAgo: 24, notes: NOTE },
    { name: "Иван", daysAgo: 7 },
  ]);
  const anna = dueRow(page, "Анна");
  const tick = blockTick(page, "Анна");

  await test.step("Анна is overdue by 17 days", async () => {
    await page.goto("/");
    await expect(dueHeading(page)).toHaveText("Пора связаться (2)");
    await expect(anna).toContainText("раз в неделю");
    await expect(anna).toContainText("Просрочено на 17 дней");
    await expect(anna).toContainText(
      formatLastContacted(addDays(today, -24), today),
    );
    await expect(dueRow(page, "Иван")).toContainText("Пора сегодня");
  });

  await test.step("the tick: the row stays, faded, the count goes down", async () => {
    await tick.click();
    await expect(tick).toBeChecked();
    await expect(anna).toContainText("Связались сегодня");
    await expect(anna).not.toContainText("Просрочено");
    await expect(anna).toContainText(formatLastContacted(today, today));
    await expect(
      anna.getByRole("link", { name: "Анна", exact: true }),
    ).toHaveCSS("opacity", "0.5");
    await expect(dueHeading(page)).toHaveText("Пора связаться (1)");
    // The tick doesn't open the card
    await expect(page).toHaveURL(/\/$/);
  });

  await test.step("the tick again: everything is as before", async () => {
    // Waits for the mark to be saved: the tick is disabled until then
    await tick.click();
    await expect(tick).not.toBeChecked();
    await expect(anna).toContainText("Просрочено на 17 дней");
    await expect(dueHeading(page)).toHaveText("Пора связаться (2)");

    await expect(tick).toBeEnabled();
    await page.reload();
    await expect(anna).toContainText("Просрочено на 17 дней");
    await expect(dueHeading(page)).toHaveText("Пора связаться (2)");
  });

  await test.step("ticked and reloaded: Анна leaves the block", async () => {
    await tick.click();
    await expect(tick).toBeChecked();
    await expect(tick).toBeEnabled();
    await page.reload();
    await expect(dueHeading(page)).toHaveText("Пора связаться (1)");
    await expect(anna).toBeHidden();
  });

  await test.step("her card: in touch today, the notes are the same", async () => {
    await page.getByRole("link", { name: "Анна", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Анна" }),
    ).toBeVisible();
    await expect(lastContactedLine(page)).toHaveText(
      formatLastContacted(today, today),
    );
    await expect(dueLine(page)).toHaveText(
      `Связаться до: ${formatDay(addDays(today, 7), today)}`,
    );
    await expect(page.getByRole("textbox", { name: "Заметки" })).toHaveValue(
      NOTE,
    );
  });
});

test("a new note takes a contact out of the block", async ({ page }) => {
  const today = await getToday();
  await addWeeklyContacts([
    { name: "Анна", daysAgo: 24 },
    { name: "Иван", daysAgo: 10, notes: NOTE },
  ]);

  await test.step("a click on the row outside the name opens the card", async () => {
    await page.goto("/");
    // The name link covers the whole row, so Playwright can't click the
    // badge itself: click where it is
    const badge = dueRow(page, "Иван").getByText("Просрочено на 3 дня");
    const box = await badge.boundingBox();
    if (!box) throw new Error("The badge is not on the screen");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(
      page.getByRole("heading", { level: 1, name: "Иван" }),
    ).toBeVisible();
  });

  await test.step("a new line in the notes: due in a week", async () => {
    await page
      .getByRole("textbox", { name: "Заметки" })
      .fill(`${NOTE}\nСозвонились, всё хорошо`);
    await saveCard(page);
    await expect(lastContactedLine(page)).toHaveText(
      formatLastContacted(today, today),
    );
    await expect(dueLine(page)).toHaveText(
      `Связаться до: ${formatDay(addDays(today, 7), today)}`,
    );
  });

  await test.step("after a reload the tick is on and can't be taken off", async () => {
    await page.reload();
    await expect(cardTick(page)).toBeChecked();
    await expect(cardTick(page)).toBeDisabled();
    await cardTick(page).click({ force: true });
    await expect(cardTick(page)).toBeChecked();
  });

  await test.step("Иван is not in the block", async () => {
    await page.getByRole("link", { name: "← Все контакты" }).click();
    await expect(dueHeading(page)).toHaveText("Пора связаться (1)");
    await expect(dueRow(page, "Анна")).toBeVisible();
    await expect(dueRow(page, "Иван")).toBeHidden();
  });
});

test("tick in the contact card", async ({ page }) => {
  const today = await getToday();
  await addWeeklyContacts([{ name: "Анна", daysAgo: 24 }]);
  const phone = page.getByRole("textbox", { name: "Телефон" });
  const newPhone = "+7 900 111-22-33";
  const overdue = {
    lastContacted: formatLastContacted(addDays(today, -24), today),
    due: `Связаться до: ${formatDay(addDays(today, -17), today)} · просрочено на 17 дней`,
  };

  await test.step("the card of an overdue contact", async () => {
    await page.goto("/");
    await dueRow(page, "Анна")
      .getByRole("link", { name: "Анна", exact: true })
      .click();
    await expect(lastContactedLine(page)).toHaveText(overdue.lastContacted);
    await expect(dueLine(page)).toHaveText(overdue.due);
  });

  await test.step("the tick with an unsaved phone: the lines change, the phone stays", async () => {
    await phone.fill(newPhone);
    await cardTick(page).click();
    await expect(cardTick(page)).toBeChecked();
    await expect(lastContactedLine(page)).toHaveText(
      formatLastContacted(today, today),
    );
    await expect(dueLine(page)).toHaveText(
      `Связаться до: ${formatDay(addDays(today, 7), today)}`,
    );
    await expect(phone).toHaveValue(newPhone);
  });

  await test.step("the tick again: the previous lines are back", async () => {
    // Waits for the mark to be saved: the tick is disabled until then
    await cardTick(page).click();
    await expect(cardTick(page)).not.toBeChecked();
    await expect(lastContactedLine(page)).toHaveText(overdue.lastContacted);
    await expect(dueLine(page)).toHaveText(overdue.due);
  });

  await test.step("ticked again and saved: the new phone is kept", async () => {
    await cardTick(page).click();
    await expect(cardTick(page)).toBeChecked();
    await expect(cardTick(page)).toBeEnabled();
    await expect(phone).toHaveValue(newPhone);
    await saveCard(page);

    await page.reload();
    await expect(phone).toHaveValue(newPhone);
    await expect(cardTick(page)).toBeChecked();
    await expect(cardTick(page)).toBeDisabled();
  });
});

test.describe("the length of the block", () => {
  // Overdue by 13 days down to 2: the reverse of the alphabetical order
  const NAMES = [
    "Яна",
    "Юлия",
    "Элла",
    "Шамиль",
    "Фёдор",
    "Ульяна",
    "Тимур",
    "Светлана",
    "Роман",
    "Полина",
    "Олег",
    "Нина",
  ];

  function blockNames(page: Page) {
    return dueBlock(page).getByRole("link");
  }

  test("shows the 5 most overdue, the rest on demand", async ({ page }) => {
    await addWeeklyContacts(
      NAMES.map((name, index) => ({ name, daysAgo: 20 - index })),
    );
    const showAll = dueBlock(page).getByRole("button", {
      name: "Показать всех",
    });
    const collapse = dueBlock(page).getByRole("button", { name: "Свернуть" });

    await page.goto("/");
    await expect(dueHeading(page)).toHaveText("Пора связаться (12)");
    await expect(blockNames(page)).toHaveText(NAMES.slice(0, 5));

    await showAll.click();
    await expect(blockNames(page)).toHaveText(NAMES);
    await expect(showAll).toBeHidden();

    await collapse.click();
    await expect(blockNames(page)).toHaveText(NAMES.slice(0, 5));
    await expect(collapse).toBeHidden();

    await showAll.click();
    await expect(blockNames(page)).toHaveText(NAMES);
    await page.reload();
    await expect(blockNames(page)).toHaveText(NAMES.slice(0, 5));
    await expect(showAll).toBeVisible();
  });

  test("shows 5 contacts without the button", async ({ page }) => {
    await addWeeklyContacts(
      NAMES.slice(0, 5).map((name, index) => ({ name, daysAgo: 20 - index })),
    );

    await page.goto("/");
    await expect(dueHeading(page)).toHaveText("Пора связаться (5)");
    await expect(blockNames(page)).toHaveText(NAMES.slice(0, 5));
    await expect(
      dueBlock(page).getByRole("button", { name: "Показать всех" }),
    ).toBeHidden();
  });

  test("the only contact ticked: 0, and no block after a reload", async ({
    page,
  }) => {
    await addWeeklyContacts([{ name: "Анна", daysAgo: 24 }]);
    const tick = blockTick(page, "Анна");

    await page.goto("/");
    await tick.click();
    await expect(tick).toBeChecked();
    await expect(dueHeading(page)).toHaveText("Пора связаться (0)");
    await expect(dueRow(page, "Анна")).toBeVisible();

    await expect(tick).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Контакты" }),
    ).toBeVisible();
    await expect(dueBlock(page)).toBeHidden();
  });
});

test.describe("when the block is hidden", () => {
  test("while searching and while a group is chosen", async ({ page }) => {
    await addWeeklyContacts([
      { name: "Анна", daysAgo: 24 },
      { name: "Иван", daysAgo: 10 },
    ]);
    await addGroup("Теннис", ["Анна"]);
    const tennis = page.getByRole("link", { name: "Теннис", exact: true });

    await page.goto("/");
    await expect(dueBlock(page)).toBeVisible();

    await search(page, "Иван");
    await expect(dueBlock(page)).toBeHidden();

    await page.getByRole("link", { name: "Сбросить" }).click();
    await expect(dueBlock(page)).toBeVisible();

    // Hidden even though Анна from "Теннис" is due
    await tennis.click();
    await expect(tennis).toHaveAttribute("aria-current", "page");
    await expect(dueBlock(page)).toBeHidden();

    await search(page, "Анна");
    await page.getByRole("link", { name: "Сбросить" }).click();
    await expect(
      page.getByText("В группе «Теннис»: 1").filter({ visible: true }),
    ).toBeVisible();
    await expect(dueBlock(page)).toBeHidden();

    await page.getByRole("link", { name: "Все", exact: true }).click();
    await expect(dueBlock(page)).toBeVisible();
  });

  test("when nobody is due", async ({ page }) => {
    await addWeeklyContacts([{ name: "Анна", daysAgo: 3 }]);

    await page.goto("/");
    await expect(
      page.getByText("Всего: 3").filter({ visible: true }),
    ).toBeVisible();
    await expect(dueBlock(page)).toBeHidden();
  });
});
