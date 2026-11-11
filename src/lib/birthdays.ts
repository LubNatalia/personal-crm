import { APP_TIME_ZONE, formatDay, formatDayCount } from "@/lib/keep-in-touch";

// A birth date as stored: day and month always together, the year optional
export type BirthDate = { day: number; month: number; year: number | null };

// Raw values of the three parts of the field, as the form sends them
export type BirthDateValues = { day: string; month: string; year: string };

type BirthDateResult =
  { ok: true; value: BirthDate | null } | { ok: false; error: string };

const MIN_BIRTH_YEAR = 1900;
const DAY_OR_MONTH_PATTERN = /^[0-9]{1,2}$/;
const YEAR_PATTERN = /^[0-9]{4}$/;
// Any leap year: a date without a year may be February 29
const LEAP_YEAR = 2000;

// Number of days in the month; month is 1-12
function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isLeapYear(year: number) {
  return daysInMonth(year, 2) === 29;
}

function dayString(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Checks the birth date field. `today` is "YYYY-MM-DD" in APP_TIME_ZONE:
// the latest allowed date and the source of the current year
export function parseBirthDate(
  { day, month, year }: BirthDateValues,
  today: string,
): BirthDateResult {
  if (!day && !month && !year) {
    return { ok: true, value: null };
  }
  if (!day || !month) {
    return { ok: false, error: "Укажите день и месяц" };
  }

  // Not a number from the lists: only a forged request can send it
  const dayNumber = DAY_OR_MONTH_PATTERN.test(day) ? Number(day) : NaN;
  const monthNumber = DAY_OR_MONTH_PATTERN.test(month) ? Number(month) : NaN;
  if (
    !(dayNumber >= 1 && dayNumber <= 31) ||
    !(monthNumber >= 1 && monthNumber <= 12)
  ) {
    return { ok: false, error: "Такой даты нет" };
  }

  const currentYear = Number(today.slice(0, 4));
  let yearNumber: number | null = null;
  if (year) {
    yearNumber = YEAR_PATTERN.test(year) ? Number(year) : NaN;
    if (!(yearNumber >= MIN_BIRTH_YEAR && yearNumber <= currentYear)) {
      return {
        ok: false,
        error: `Укажите год от ${MIN_BIRTH_YEAR} до ${currentYear}`,
      };
    }
  }

  if (dayNumber > daysInMonth(yearNumber ?? LEAP_YEAR, monthNumber)) {
    return { ok: false, error: "Такой даты нет" };
  }
  // Same-length "YYYY-MM-DD" strings compare as dates
  if (
    yearNumber !== null &&
    dayString(yearNumber, monthNumber, dayNumber) > today
  ) {
    return { ok: false, error: "Эта дата ещё не наступила" };
  }

  return {
    ok: true,
    value: { day: dayNumber, month: monthNumber, year: yearNumber },
  };
}

const appDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Today as "YYYY-MM-DD" in APP_TIME_ZONE, the same day the database counts
export function todayInAppTimeZone(now = new Date()) {
  const parts = Object.fromEntries(
    appDayFormat.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Options of the "month" list, in the genitive: reads as a date, "14 ноября"
export const BIRTH_MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

// The block shows birthdays today and in this many days after it
const UPCOMING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BirthdayContact = {
  id: number;
  name: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
};

export type UpcomingBirthday = {
  id: number;
  name: string;
  // The day of the next birthday, "YYYY-MM-DD"
  day: string;
  // 0 is today
  daysUntil: number;
  // The age turned on that day; null when the year is unknown
  age: number | null;
};

const nameCollator = new Intl.Collator("ru-RU");

// Birthdays from today to UPCOMING_DAYS days ahead, the nearest first, one
// day by name. `today` is "YYYY-MM-DD" in APP_TIME_ZONE. February 29 is
// celebrated on February 28 in a common year
export function upcomingBirthdays(
  contacts: BirthdayContact[],
  today: string,
): UpcomingBirthday[] {
  const [todayYear, todayMonth, todayDate] = today.split("-").map(Number);
  const todayTime = Date.UTC(todayYear, todayMonth - 1, todayDate);

  const upcoming: UpcomingBirthday[] = [];
  for (const contact of contacts) {
    // This year's birthday, or next year's when this year's has passed
    for (const year of [todayYear, todayYear + 1]) {
      const date =
        contact.birthMonth === 2 && contact.birthDay === 29 && !isLeapYear(year)
          ? 28
          : contact.birthDay;
      const daysUntil = Math.round(
        (Date.UTC(year, contact.birthMonth - 1, date) - todayTime) / DAY_MS,
      );
      if (daysUntil < 0) continue;
      if (daysUntil <= UPCOMING_DAYS) {
        upcoming.push({
          id: contact.id,
          name: contact.name,
          day: dayString(year, contact.birthMonth, date),
          daysUntil,
          age: contact.birthYear === null ? null : year - contact.birthYear,
        });
      }
      break;
    }
  }

  return upcoming.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      nameCollator.compare(a.name, b.name) ||
      a.id - b.id,
  );
}

// "14 ноября": the year of the birthday is always this or the next one,
// so it is left out
export function formatBirthdayDate(day: string) {
  return formatDay(day, day);
}

// Badge in the block: "Сегодня", "Завтра", "Через 5 дней"
export function formatBirthdayBadge(daysUntil: number) {
  if (daysUntil === 0) return "Сегодня";
  if (daysUntil === 1) return "Завтра";
  return `Через ${formatDayCount(daysUntil)}`;
}

const pluralRules = new Intl.PluralRules("ru-RU");
const YEAR_FORMS: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "год",
  few: "года",
};

// "исполнится 35 лет", or "исполняется 21 год" on the birthday itself
export function formatTurningAge(age: number, isToday: boolean) {
  const verb = isToday ? "исполняется" : "исполнится";
  return `${verb} ${age} ${YEAR_FORMS[pluralRules.select(age)] ?? "лет"}`;
}
