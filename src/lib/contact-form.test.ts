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

describe("parseContactForm: groups", () => {
  it("gives an empty list when no group is ticked", () => {
    const result = parseContactForm(form({ name: "Анна" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.groupIds).toEqual([]);
      expect(result.values.groupIds).toEqual([]);
    }
  });

  it("reads ticked groups as numbers", () => {
    const result = parseContactForm(
      form({ name: "Анна", groupIds: ["3", "5"] }),
    );

    expect(result.ok && result.data.groupIds).toEqual([3, 5]);
  });

  it("drops repeats", () => {
    const result = parseContactForm(
      form({ name: "Анна", groupIds: ["3", "5", "3"] }),
    );

    expect(result.ok && result.data.groupIds).toEqual([3, 5]);
  });

  it.each(["abc", "0", "-1", "1.5", "", "99999999999"])(
    "rejects %j as a group id",
    (value) => {
      const result = parseContactForm(
        form({ name: "Анна", groupIds: ["3", value] }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.groupIds).toBe("Выберите группы из списка");
      }
    },
  );

  it("keeps ticked groups in the values when another field has an error", () => {
    const result = parseContactForm(form({ name: "", groupIds: ["3", "5"] }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBe("Укажите имя");
      expect(result.values.groupIds).toEqual(["3", "5"]);
    }
  });
});
