// Fills an empty contacts table with realistic test data.
// Usage: pnpm db:seed (on the server: node db/seed.ts inside the app image)
import { createRequire } from "node:module";
import { fakerRU as faker } from "@faker-js/faker";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  contacts,
  type ContactFrequency,
  type NewContact,
} from "./schema.ts";

// @next/env is CommonJS whose exports Node can't import by name; require
// loads it the same way under tsx and under Node's own TypeScript support
const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");

const SEED_COUNT = 1000;
const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const FREQUENCIES: { weight: number; value: ContactFrequency }[] = [
  { weight: 25, value: "week" },
  { weight: 40, value: "month" },
  { weight: 20, value: "quarter" },
  { weight: 15, value: "year" },
];

const ROLES = [
  "Коллега по прошлой работе",
  "Коллега, отдел маркетинга",
  "Бывший руководитель",
  "Однокурсник",
  "Одноклассник",
  "Сосед по дому",
  "Сосед по даче",
  "Друг детства",
  "Тренер в спортзале",
  "Стоматолог",
  "Семейный врач",
  "Юрист",
  "Бухгалтер",
  "Риелтор",
  "Автомеханик",
  "Мастер по ремонту",
  "Репетитор английского",
  "Фотограф",
  "Дизайнер интерьеров",
  "Предприниматель, своя кофейня",
  "Разработчик, фрилансер",
  "Преподаватель в университете",
  "Мама одноклассника сына",
  "Папа подруги дочери",
  "Друг семьи",
  "Знакомый по йоге",
  "Партнёр по теннису",
  "Организатор конференций",
  "HR в крупной компании",
  "Журналист",
  "Ветеринар",
  "Парикмахер",
  "Инструктор по вождению",
  "Знакомый музыкант",
  "Бывший сосед по общежитию",
];

const HOW_WE_MET = [
  "Учились вместе в университете",
  "Учились в одной школе",
  "Работали в одной компании",
  "Познакомились на конференции",
  "Познакомил общий друг",
  "Познакомились на дне рождения у друзей",
  "Соседи по подъезду",
  "Соседи по даче",
  "Ходим в один спортзал",
  "Познакомились в походе",
  "Встретились в отпуске",
  "Познакомились на свадьбе друзей",
  "Нашёл по рекомендации знакомых",
  "Дети ходят в один детский сад",
  "Познакомились на курсах английского",
  "Вместе волонтёрили",
  "Были в одной команде на хакатоне",
  "Познакомились в поезде",
  "Через рабочий чат",
  "На родительском собрании",
];

const NOTES = [
  "Договорились созвониться в начале следующего месяца.",
  "Обещал прислать контакты хорошего стоматолога.",
  "Попросила совета по поводу ремонта на кухне — скинуть ей номер мастера.",
  "Ищет работу в аналитике, обещал переслать вакансии.",
  "Любит настольные игры, позвать на следующую игротеку.",
  "Должен мне книгу «Мастер и Маргарита», не забыть забрать.",
  "Собирается переезжать в Казань, спросить, как устроился.",
  "Договорились вместе сходить на выставку в субботу.",
  "Поздравить с днём рождения, любит хороший чай.",
  "Обсуждали совместный проект, ждёт от меня предложение до пятницы.",
  "Дал контакт юриста, спросить, помог ли.",
  "Обещала посоветовать садик для ребёнка.",
  "Звонил по поводу машины — продаёт, если что, можно взять недорого.",
  "Договорились пробежать полумарафон вместе весной.",
  "Помог с переездом, нужно отблагодарить.",
  "Интересуется фотографией, скинуть ссылку на курс.",
  "Рассказал про новую работу, всё нравится.",
  "Договорились, что я пришлю презентацию после встречи.",
  "Спрашивал про аренду квартиры в нашем районе.",
  "Вернуть 2000 ₽ за билеты в театр.",
  "У сына скоро выпускной, спросить, как прошёл.",
  "Сделала скидку на услуги, порекомендовать её друзьям.",
  "Договорились встретиться на кофе, когда вернётся из командировки.",
  "Пригласил на свою свадьбу летом.",
  "Хочет собрать встречу выпускников, обещал помочь с организацией.",
];

const EMAIL_DOMAINS = [
  "gmail.com",
  "yandex.ru",
  "mail.ru",
  "inbox.ru",
  "outlook.com",
  "bk.ru",
];

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(value: string) {
  return [...value.toLowerCase()]
    .map((char) => TRANSLIT[char] ?? (/[a-z0-9]/.test(char) ? char : ""))
    .join("");
}

function russianMobile() {
  const digits = faker.string.numeric(9);
  return `+7 9${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
}

function email(firstName: string, lastName: string) {
  const first = transliterate(firstName);
  const last = transliterate(lastName);
  const local = faker.helpers.arrayElement([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}${faker.number.int({ min: 1, max: 99 })}`,
    `${first}${last}`,
  ]);
  return `${local}@${faker.helpers.arrayElement(EMAIL_DOMAINS)}`;
}

function makeContact(now: Date): NewContact {
  const sex = faker.person.sexType();
  const firstName = faker.person.firstName(sex);
  const lastName = faker.person.lastName(sex);
  const hasNotes = faker.datatype.boolean(0.45);

  const createdAt = faker.date.past({ years: 3, refDate: now });
  const updatedAt = hasNotes
    ? faker.date.between({ from: createdAt, to: now })
    : createdAt;

  return {
    name: `${firstName} ${lastName}`,
    about: faker.datatype.boolean(0.9) ? faker.helpers.arrayElement(ROLES) : null,
    howWeMet: faker.datatype.boolean(0.85)
      ? faker.helpers.arrayElement(HOW_WE_MET)
      : null,
    phone: faker.datatype.boolean(0.85) ? russianMobile() : null,
    email: faker.datatype.boolean(0.65) ? email(firstName, lastName) : null,
    notes: hasNotes
      ? faker.helpers.arrayElements(NOTES, { min: 1, max: 3 }).join("\n")
      : null,
    createdAt,
    updatedAt,
  };
}

// About every tenth contact gets a keep-in-touch frequency with dates in the
// last months: some are already in the "time to get in touch" block, some
// not yet. Runs after all contacts are made, so they stay the same as before
function addKeepInTouch(rows: NewContact[], now: Date) {
  const recent = new Date(now.getTime() - 120 * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  let dueToday = 0;

  for (const row of rows) {
    if (!faker.datatype.boolean(0.1)) continue;
    const createdAt = row.createdAt as Date;

    // A couple of contacts are due exactly today: in touch a week ago
    if (dueToday < 2 && createdAt <= weekAgo) {
      dueToday++;
      row.contactFrequency = "week";
      row.frequencySetAt = weekAgo;
      row.lastContactedAt = weekAgo;
      continue;
    }

    const from = createdAt > recent ? createdAt : recent;
    row.contactFrequency = faker.helpers.weightedArrayElement(FREQUENCIES);
    row.frequencySetAt = faker.date.between({ from, to: now });
    // The rest have no known contact yet: counted from frequencySetAt
    row.lastContactedAt = faker.datatype.boolean(0.65)
      ? faker.date.between({ from, to: now })
      : null;
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts);
    if (existing > 0) {
      console.log(
        `Seed skipped: contacts table already has ${existing} rows.`,
      );
      return;
    }

    // Fixed seed: the same test data on every run
    faker.seed(20261014);
    const now = new Date();
    const rows = Array.from({ length: SEED_COUNT }, () => makeContact(now));
    addKeepInTouch(rows, now);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await db.insert(contacts).values(rows.slice(i, i + BATCH_SIZE));
    }
    console.log(`Seeded ${rows.length} contacts.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
