import { describe, expect, it } from "vitest";
import {
  formatBirthdayBadge,
  formatBirthdayDate,
  formatTurningAge,
  parseBirthDate,
  todayInAppTimeZone,
  upcomingBirthdays,
} from "./birthdays";

const TODAY = "2026-11-11";

function parse(day: string, month: string, year: string) {
  return parseBirthDate({ day, month, year }, TODAY);
}

describe("parseBirthDate", () => {
  it("gives no date when all three are empty", () => {
    expect(parse("", "", "")).toEqual({ ok: true, value: null });
  });

  it("reads a date with a year", () => {
    expect(parse("14", "11", "1990")).toEqual({
      ok: true,
      value: { day: 14, month: 11, year: 1990 },
    });
  });

  it("reads a date without a year", () => {
    expect(parse("3", "3", "")).toEqual({
      ok: true,
      value: { day: 3, month: 3, year: null },
    });
  });

  it.each([
    ["only the day", "14", "", ""],
    ["only the month", "", "11", ""],
    ["only the year", "", "", "1990"],
    ["the day and the year", "14", "", "1990"],
  ])("asks for the day and the month with %s", (_, day, month, year) => {
    expect(parse(day, month, year)).toEqual({
      ok: false,
      error: "Укажите день и месяц",
    });
  });

  it.each([
    ["April 31", "31", "4", ""],
    ["February 30", "30", "2", ""],
    ["February 29, 2025", "29", "2", "2025"],
    ["day 0", "0", "11", ""],
    ["day abc", "abc", "11", ""],
    ["day 32", "32", "11", ""],
    ["day 1.5", "1.5", "11", ""],
    ["month 13", "14", "13", ""],
    ["month 0", "14", "0", ""],
    ["month abc", "14", "abc", ""],
  ])("rejects %s", (_, day, month, year) => {
    expect(parse(day, month, year)).toEqual({
      ok: false,
      error: "Такой даты нет",
    });
  });

  it("allows February 29 without a year", () => {
    expect(parse("29", "2", "")).toEqual({
      ok: true,
      value: { day: 29, month: 2, year: null },
    });
  });

  it("allows February 29 in a leap year", () => {
    expect(parse("29", "2", "1992")).toEqual({
      ok: true,
      value: { day: 29, month: 2, year: 1992 },
    });
  });

  it.each(["1899", "2027", "90", "abc", "19900", "1990.5"])(
    "rejects the year %j",
    (year) => {
      expect(parse("14", "11", year)).toEqual({
        ok: false,
        error: "Укажите год от 1900 до 2026",
      });
    },
  );

  it("allows the years 1900 and the current one", () => {
    expect(parse("1", "1", "1900").ok).toBe(true);
    expect(parse("1", "1", "2026").ok).toBe(true);
  });

  it("rejects a date that hasn't come yet", () => {
    expect(parse("20", "11", "2026")).toEqual({
      ok: false,
      error: "Эта дата ещё не наступила",
    });
  });

  it("allows today", () => {
    expect(parse("11", "11", "2026")).toEqual({
      ok: true,
      value: { day: 11, month: 11, year: 2026 },
    });
  });

  it("names the current year in the error", () => {
    expect(
      parseBirthDate({ day: "1", month: "1", year: "2030" }, "2029-03-01"),
    ).toEqual({ ok: false, error: "Укажите год от 1900 до 2029" });
  });
});

describe("todayInAppTimeZone", () => {
  it("is already the next day in Moscow late in the UTC evening", () => {
    expect(todayInAppTimeZone(new Date("2026-11-10T21:30:00Z"))).toBe(
      "2026-11-11",
    );
  });

  it("is still the same day an hour earlier", () => {
    expect(todayInAppTimeZone(new Date("2026-11-10T20:30:00Z"))).toBe(
      "2026-11-10",
    );
  });
});

describe("upcomingBirthdays", () => {
  let nextId = 1;
  function person(
    name: string,
    birthDay: number,
    birthMonth: number,
    birthYear: number | null = null,
  ) {
    return { id: nextId++, name, birthDay, birthMonth, birthYear };
  }

  function names(result: ReturnType<typeof upcomingBirthdays>) {
    return result.map((row) => row.name);
  }

  it("counts today as 0 days", () => {
    const [row] = upcomingBirthdays([person("Анна", 11, 11)], TODAY);

    expect(row).toMatchObject({ day: "2026-11-11", daysUntil: 0 });
  });

  it("keeps a birthday exactly a week away", () => {
    const [row] = upcomingBirthdays([person("Иван", 18, 11)], TODAY);

    expect(row).toMatchObject({ day: "2026-11-18", daysUntil: 7 });
  });

  it("leaves out 8 days away and yesterday", () => {
    expect(
      upcomingBirthdays(
        [person("Борис", 19, 11), person("Вера", 10, 11)],
        TODAY,
      ),
    ).toEqual([]);
  });

  it("goes over the New Year, with the age by the year of the birthday", () => {
    const [row] = upcomingBirthdays([person("Яна", 2, 1, 1990)], "2026-12-28");

    expect(row).toMatchObject({ day: "2027-01-02", daysUntil: 5, age: 37 });
  });

  it("moves February 29 to February 28 in a common year", () => {
    const [row] = upcomingBirthdays([person("Анна", 29, 2)], "2027-02-25");

    expect(row).toMatchObject({ day: "2027-02-28", daysUntil: 3 });
  });

  it("keeps February 29 in a leap year", () => {
    const [row] = upcomingBirthdays([person("Анна", 29, 2)], "2028-02-25");

    expect(row).toMatchObject({ day: "2028-02-29", daysUntil: 4 });
  });

  it("counts the age when the year is known", () => {
    const [row] = upcomingBirthdays([person("Анна", 14, 11, 1990)], TODAY);

    expect(row).toMatchObject({ daysUntil: 3, age: 36 });
  });

  it("has no age without a year", () => {
    const [row] = upcomingBirthdays([person("Борис", 12, 11)], TODAY);

    expect(row.age).toBeNull();
  });

  it("puts the nearest first", () => {
    const result = upcomingBirthdays(
      [person("Анна", 16, 11), person("Иван", 11, 11), person("Борис", 12, 11)],
      TODAY,
    );

    expect(names(result)).toEqual(["Иван", "Борис", "Анна"]);
  });

  it("orders one day by name", () => {
    const result = upcomingBirthdays(
      [person("Яна", 13, 11), person("Вера", 13, 11)],
      TODAY,
    );

    expect(names(result)).toEqual(["Вера", "Яна"]);
  });
});

describe("formatBirthdayBadge", () => {
  it.each([
    [0, "Сегодня"],
    [1, "Завтра"],
    [2, "Через 2 дня"],
    [5, "Через 5 дней"],
    [7, "Через 7 дней"],
  ])("%i days → %s", (days, text) => {
    expect(formatBirthdayBadge(days)).toBe(text);
  });
});

describe("formatTurningAge", () => {
  it.each([
    [1, "исполнится 1 год"],
    [22, "исполнится 22 года"],
    [35, "исполнится 35 лет"],
    [41, "исполнится 41 год"],
    [11, "исполнится 11 лет"],
  ])("%i → %s", (age, text) => {
    expect(formatTurningAge(age, false)).toBe(text);
  });

  it("says «исполняется» on the birthday itself", () => {
    expect(formatTurningAge(21, true)).toBe("исполняется 21 год");
  });
});

describe("formatBirthdayDate", () => {
  it("shows the day and the month without the year", () => {
    expect(formatBirthdayDate("2027-01-02")).toBe("2 января");
    expect(formatBirthdayDate("2026-11-14")).toBe("14 ноября");
  });
});
