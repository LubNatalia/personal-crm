import { describe, expect, it } from "vitest";
import { formatEmptyListMessage, formatListSummary } from "./contact-list";

describe("formatListSummary", () => {
  it("shows the total without a group and a search", () => {
    expect(
      formatListSummary({
        query: "",
        groupName: null,
        shown: 1000,
        total: 1000,
      }),
    ).toBe("Всего: 1000");
  });

  it("shows found of total when searching without a group", () => {
    expect(
      formatListSummary({
        query: "Ан",
        groupName: null,
        shown: 12,
        total: 1000,
      }),
    ).toBe("Найдено: 12 из 1000");
  });

  it("shows the group and its size when a group is chosen", () => {
    expect(
      formatListSummary({ query: "", groupName: "Теннис", shown: 6, total: 6 }),
    ).toBe("В группе «Теннис»: 6");
  });

  it("shows found of the group's size when searching in a group", () => {
    expect(
      formatListSummary({
        query: "Ан",
        groupName: "Теннис",
        shown: 2,
        total: 6,
      }),
    ).toBe("Найдено: 2 из 6");
  });
});

describe("formatEmptyListMessage", () => {
  it("invites to add the first contact when there are none", () => {
    expect(formatEmptyListMessage({ query: "", groupName: null })).toBe(
      "Контактов пока нет. Добавьте первый.",
    );
  });

  it("says nobody was found for a search", () => {
    expect(formatEmptyListMessage({ query: "Зоя", groupName: null })).toBe(
      "Никого не нашли по запросу «Зоя».",
    );
  });

  it("says the group is empty", () => {
    expect(formatEmptyListMessage({ query: "", groupName: "Аналитики" })).toBe(
      "В группе «Аналитики» пока никого нет.",
    );
  });

  it("says nobody was found for a search in a group", () => {
    expect(formatEmptyListMessage({ query: "Зоя", groupName: "Теннис" })).toBe(
      "Никого не нашли по запросу «Зоя» в группе «Теннис».",
    );
  });
});
