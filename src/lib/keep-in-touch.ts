import type { ContactFrequency } from "@/db/schema";

// Days are counted in Moscow time, both in SQL and when formatting dates:
// the server runs in UTC, so a note at 01:00 Moscow time would otherwise
// fall on the previous day
export const APP_TIME_ZONE = "Europe/Moscow";

// Order of the options in the "how often" field
export const CONTACT_FREQUENCIES = [
  "week",
  "month",
  "quarter",
  "year",
] as const satisfies readonly ContactFrequency[];

type FrequencyInfo = {
  // Option in the "how often" field
  optionLabel: string;
  // Inside a sentence or a row of the "time to get in touch" block
  rowLabel: string;
  // Postgres interval added to the start day to get the due day
  interval: string;
};

export const FREQUENCY_INFO: Record<ContactFrequency, FrequencyInfo> = {
  week: {
    optionLabel: "Раз в неделю",
    rowLabel: "раз в неделю",
    interval: "7 days",
  },
  month: {
    optionLabel: "Раз в месяц",
    rowLabel: "раз в месяц",
    interval: "1 month",
  },
  quarter: {
    optionLabel: "Раз в квартал",
    rowLabel: "раз в квартал",
    interval: "3 months",
  },
  year: {
    optionLabel: "Раз в год",
    rowLabel: "раз в год",
    interval: "1 year",
  },
};

export function isContactFrequency(value: string): value is ContactFrequency {
  return (CONTACT_FREQUENCIES as readonly string[]).includes(value);
}

export const CONTACTED_TODAY_LABEL = "Связались сегодня";

// Exact timestamps of a "contacted" tick, kept by the browser to undo it:
// 2026-10-26T09:15:42.123456Z. In this fixed format string order is time order
const EXACT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function isExactTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    EXACT_TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

// The previous last contact (null if unknown) can't be later than the tick
export function isValidContactedMark(markedAt: unknown, previous: unknown) {
  return (
    isExactTimestamp(markedAt) &&
    (previous === null || (isExactTimestamp(previous) && previous <= markedAt))
  );
}

// Days arrive from the database as "YYYY-MM-DD" strings in APP_TIME_ZONE.
// They are formatted as UTC dates so the day can't shift with the time zone
const dayMonthFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// "2 октября", or "10 сентября 2025" when the year is not the current one
export function formatDay(day: string, today: string) {
  const [year, month, date] = day.split("-").map(Number);
  const text = dayMonthFormat.format(new Date(Date.UTC(year, month - 1, date)));
  return day.slice(0, 4) === today.slice(0, 4) ? text : `${text} ${year}`;
}

const pluralRules = new Intl.PluralRules("ru-RU");
const DAY_FORMS: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "день",
  few: "дня",
};

// "1 день", "3 дня", "5 дней", "21 день"
export function formatDayCount(days: number) {
  return `${days} ${DAY_FORMS[pluralRules.select(days)] ?? "дней"}`;
}

// Badge in the block: "Пора сегодня" or "Просрочено на 17 дней"
export function formatOverdueBadge(overdueDays: number) {
  return overdueDays === 0
    ? "Пора сегодня"
    : `Просрочено на ${formatDayCount(overdueDays)}`;
}

// After the due day in the contact card: "пора сегодня" or
// "просрочено на 17 дней"; null while the due day is still ahead
export function formatOverdueNote(overdueDays: number) {
  if (overdueDays < 0) return null;
  return overdueDays === 0
    ? "пора сегодня"
    : `просрочено на ${formatDayCount(overdueDays)}`;
}

// "Последнее общение: 2 октября" or "Последнее общение: не отмечено"
export function formatLastContacted(
  lastContactedDay: string | null,
  today: string,
) {
  return `Последнее общение: ${
    lastContactedDay ? formatDay(lastContactedDay, today) : "не отмечено"
  }`;
}
