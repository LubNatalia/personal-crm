import { describe, expect, it } from "vitest";
import {
  formatDay,
  formatLastContacted,
  formatOverdueBadge,
  formatOverdueNote,
} from "./keep-in-touch";

const TODAY = "2026-10-26";

describe("formatOverdueBadge", () => {
  it("says it's time today when the due day is today", () => {
    expect(formatOverdueBadge(0)).toBe("Пора сегодня");
  });

  it.each([
    [1, "Просрочено на 1 день"],
    [3, "Просрочено на 3 дня"],
    [5, "Просрочено на 5 дней"],
    [11, "Просрочено на 11 дней"],
    [17, "Просрочено на 17 дней"],
    [21, "Просрочено на 21 день"],
    [22, "Просрочено на 22 дня"],
  ])("%i -> %s", (days, text) => {
    expect(formatOverdueBadge(days)).toBe(text);
  });
});

describe("formatOverdueNote", () => {
  it("adds nothing while the due day is ahead", () => {
    expect(formatOverdueNote(-1)).toBeNull();
  });

  it("says it's time today when the due day is today", () => {
    expect(formatOverdueNote(0)).toBe("пора сегодня");
  });

  it("says how many days it's overdue", () => {
    expect(formatOverdueNote(17)).toBe("просрочено на 17 дней");
    expect(formatOverdueNote(21)).toBe("просрочено на 21 день");
  });
});

describe("formatDay", () => {
  it("shows the day without the year in the current year", () => {
    expect(formatDay("2026-10-02", TODAY)).toBe("2 октября");
  });

  it("adds the year when it's not the current one", () => {
    expect(formatDay("2025-09-10", TODAY)).toBe("10 сентября 2025");
    expect(formatDay("2027-01-15", TODAY)).toBe("15 января 2027");
  });
});

describe("formatLastContacted", () => {
  it("shows the day of the last contact", () => {
    expect(formatLastContacted("2026-10-02", TODAY)).toBe(
      "Последнее общение: 2 октября",
    );
    expect(formatLastContacted("2025-09-10", TODAY)).toBe(
      "Последнее общение: 10 сентября 2025",
    );
  });

  it("says it's not marked when the day is unknown", () => {
    expect(formatLastContacted(null, TODAY)).toBe(
      "Последнее общение: не отмечено",
    );
  });
});
