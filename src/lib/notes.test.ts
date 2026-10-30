import { describe, expect, it } from "vitest";
import { hasNewNoteLines } from "./notes";

const NOTES = "Обсудили отпуск\nДоговорились созвониться";

describe("hasNewNoteLines: counts as being in touch", () => {
  it("a new line under the previous ones", () => {
    expect(hasNewNoteLines(NOTES, `${NOTES}\nПоздравил с днём рождения`)).toBe(
      true,
    );
  });

  it("a new line above the previous ones", () => {
    expect(hasNewNoteLines(NOTES, `Поздравил с днём рождения\n${NOTES}`)).toBe(
      true,
    );
  });

  it("a new line between the previous ones", () => {
    expect(
      hasNewNoteLines(
        NOTES,
        "Обсудили отпуск\nПоздравил с днём рождения\nДоговорились созвониться",
      ),
    ).toBe(true);
  });

  it("the first note in empty notes", () => {
    expect(hasNewNoteLines(null, "Обсудили отпуск")).toBe(true);
    expect(hasNewNoteLines("", "Обсудили отпуск")).toBe(true);
  });

  it("a new line next to blank lines and spaces at the edges", () => {
    expect(
      hasNewNoteLines(NOTES, `  ${NOTES}\n\n  Поздравил с днём рождения  \n`),
    ).toBe(true);
  });
});

describe("hasNewNoteLines: does not count", () => {
  it("fixing a typo in a previous line", () => {
    expect(
      hasNewNoteLines(NOTES, "Обсудили отпуск\nДоговорились созвонится"),
    ).toBe(false);
  });

  it("adding to the end of a previous line", () => {
    expect(
      hasNewNoteLines(
        NOTES,
        "Обсудили отпуск в Сочи\nДоговорились созвониться",
      ),
    ).toBe(false);
  });

  it("deleting a line", () => {
    expect(hasNewNoteLines(NOTES, "Договорились созвониться")).toBe(false);
  });

  it("deleting all the notes", () => {
    expect(hasNewNoteLines(NOTES, "")).toBe(false);
    expect(hasNewNoteLines(NOTES, null)).toBe(false);
  });

  it("fixing a line and adding a new one in one save", () => {
    expect(
      hasNewNoteLines(
        NOTES,
        "Обсудили отпуск в Сочи\nДоговорились созвониться\nПоздравил с днём рождения",
      ),
    ).toBe(false);
  });

  it("adding only blank lines and spaces", () => {
    expect(hasNewNoteLines(NOTES, `${NOTES}\n\n   \n`)).toBe(false);
    expect(hasNewNoteLines(null, "  \n\n")).toBe(false);
  });

  it("saving without changes", () => {
    expect(hasNewNoteLines(NOTES, NOTES)).toBe(false);
    expect(hasNewNoteLines(null, null)).toBe(false);
  });
});
