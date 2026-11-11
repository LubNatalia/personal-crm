import { describe, expect, it } from "vitest";
import { parseContactForm } from "./contact-form";

function form(fields: Record<string, string | string[]>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      formData.append(key, item);
    }
  }
  return formData;
}

// "Today" for the birth date checks
const TODAY = "2026-11-11";

describe("parseContactForm: groups", () => {
  it("gives an empty list when no group is ticked", () => {
    const result = parseContactForm(form({ name: "Анна" }), TODAY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.groupIds).toEqual([]);
      expect(result.values.groupIds).toEqual([]);
    }
  });

  it("reads ticked groups as numbers", () => {
    const result = parseContactForm(
      form({ name: "Анна", groupIds: ["3", "5"] }),
      TODAY,
    );

    expect(result.ok && result.data.groupIds).toEqual([3, 5]);
  });

  it("drops repeats", () => {
    const result = parseContactForm(
      form({ name: "Анна", groupIds: ["3", "5", "3"] }),
      TODAY,
    );

    expect(result.ok && result.data.groupIds).toEqual([3, 5]);
  });

  it.each(["abc", "0", "-1", "1.5", "", "99999999999"])(
    "rejects %j as a group id",
    (value) => {
      const result = parseContactForm(
        form({ name: "Анна", groupIds: ["3", value] }),
        TODAY,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.groupIds).toBe("Выберите группы из списка");
      }
    },
  );

  it("keeps ticked groups in the values when another field has an error", () => {
    const result = parseContactForm(
      form({ name: "", groupIds: ["3", "5"] }),
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBe("Укажите имя");
      expect(result.values.groupIds).toEqual(["3", "5"]);
    }
  });
});

describe("parseContactForm: birth date", () => {
  it("gives the date to store when it is right", () => {
    const result = parseContactForm(
      form({
        name: "Анна",
        birthDay: "14",
        birthMonth: "11",
        birthYear: "1990",
      }),
      TODAY,
    );

    expect(result.ok && result.data.birthDate).toEqual({
      day: 14,
      month: 11,
      year: 1990,
    });
  });

  it("gives a date without a year", () => {
    const result = parseContactForm(
      form({ name: "Анна", birthDay: "3", birthMonth: "3", birthYear: "" }),
      TODAY,
    );

    expect(result.ok && result.data.birthDate).toEqual({
      day: 3,
      month: 3,
      year: null,
    });
  });

  it("gives null when the field is empty", () => {
    const result = parseContactForm(
      form({ name: "Анна", birthDay: "", birthMonth: "", birthYear: "" }),
      TODAY,
    );

    expect(result.ok && result.data.birthDate).toBeNull();
  });

  it("gives null when the field is not in the form at all", () => {
    const result = parseContactForm(form({ name: "Анна" }), TODAY);

    expect(result.ok && result.data.birthDate).toBeNull();
    expect(result.values).toMatchObject({
      birthDay: "",
      birthMonth: "",
      birthYear: "",
    });
  });

  it("puts the error under the field and keeps every value", () => {
    const result = parseContactForm(
      form({
        name: "Анна",
        phone: "+7 900 111-22-33",
        groupIds: ["3"],
        birthDay: "31",
        birthMonth: "4",
        birthYear: "",
      }),
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({ birthDate: "Такой даты нет" });
      expect(result.values).toMatchObject({
        name: "Анна",
        phone: "+7 900 111-22-33",
        groupIds: ["3"],
        birthDay: "31",
        birthMonth: "4",
        birthYear: "",
      });
    }
  });

  it("checks the year against today", () => {
    const result = parseContactForm(
      form({
        name: "Анна",
        birthDay: "20",
        birthMonth: "11",
        birthYear: "2026",
      }),
      TODAY,
    );

    expect(!result.ok && result.errors.birthDate).toBe(
      "Эта дата ещё не наступила",
    );
  });

  it("shows the date error together with other errors", () => {
    const result = parseContactForm(
      form({ name: "", birthDay: "14", birthMonth: "", birthYear: "" }),
      TODAY,
    );

    expect(!result.ok && result.errors).toEqual({
      name: "Укажите имя",
      birthDate: "Укажите день и месяц",
    });
  });
});
