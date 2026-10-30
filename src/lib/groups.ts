// Short enough for a label to fit in a row on a phone
export const GROUP_NAME_MAX_LENGTH = 50;

type ParseGroupNameResult =
  { ok: true; name: string } | { ok: false; error: string };

// Spaces at the edges are dropped, the ones inside stay
export function parseGroupName(raw: string | null): ParseGroupNameResult {
  const name = (raw ?? "").trim();
  if (!name) {
    return { ok: false, error: "Укажите название" };
  }
  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Слишком длинно: максимум ${GROUP_NAME_MAX_LENGTH} символов`,
    };
  }
  return { ok: true, name };
}

const pluralRules = new Intl.PluralRules("ru-RU");
const CONTACT_FORMS: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "контакт",
  few: "контакта",
};

// "1 контакт", "3 контакта", "5 контактов", "21 контакт"
export function formatContactCount(count: number) {
  return `${count} ${CONTACT_FORMS[pluralRules.select(count)] ?? "контактов"}`;
}
