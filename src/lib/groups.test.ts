import { describe, expect, it } from "vitest";
import { formatContactCount, parseGroupName } from "./groups";

describe("parseGroupName", () => {
  it("asks for a name when it is empty or only spaces", () => {
    expect(parseGroupName("")).toEqual({
      ok: false,
      error: "Укажите название",
    });
    expect(parseGroupName("   ")).toEqual({
      ok: false,
      error: "Укажите название",
    });
  });

  it("trims spaces at the edges and keeps the ones inside", () => {
    expect(parseGroupName("  Большой  теннис  ")).toEqual({
      ok: true,
      name: "Большой  теннис",
    });
  });

  it("accepts 50 characters and rejects 51", () => {
    expect(parseGroupName("а".repeat(50))).toEqual({
      ok: true,
      name: "а".repeat(50),
    });
    expect(parseGroupName("а".repeat(51))).toEqual({
      ok: false,
      error: "Слишком длинно: максимум 50 символов",
    });
  });

  it("counts the length after trimming", () => {
    expect(parseGroupName(` ${"а".repeat(50)} `).ok).toBe(true);
  });

  it("treats a missing value as empty", () => {
    expect(parseGroupName(null)).toEqual({
      ok: false,
      error: "Укажите название",
    });
  });
});

describe("formatContactCount", () => {
  it.each([
    [0, "0 контактов"],
    [1, "1 контакт"],
    [3, "3 контакта"],
    [5, "5 контактов"],
    [11, "11 контактов"],
    [21, "21 контакт"],
    [22, "22 контакта"],
  ])("%i -> %s", (count, text) => {
    expect(formatContactCount(count)).toBe(text);
  });
});
