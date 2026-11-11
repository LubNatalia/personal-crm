import type { ContactFrequency } from "@/db/schema";
import { parseBirthDate, type BirthDate } from "@/lib/birthdays";
import { isContactFrequency } from "@/lib/keep-in-touch";

const TEXT_FIELDS = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "notes",
] as const;

type TextField = (typeof TEXT_FIELDS)[number];

// The three parts of the "birth date" field: day and month lists, year input
const BIRTH_DATE_FIELDS = ["birthDay", "birthMonth", "birthYear"] as const;

export const CONTACT_FIELDS = [
  ...TEXT_FIELDS,
  "contactFrequency",
  ...BIRTH_DATE_FIELDS,
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

// Raw form values as the user typed them; an empty frequency is "not set".
// groupIds are the ticked groups as they came from the form
export type ContactValues = Record<ContactField, string> & {
  groupIds: string[];
};

// The birth date has one error for its three parts
export type ContactErrors = Partial<
  Record<ContactField | "groupIds" | "birthDate", string>
>;

// Values ready to be stored: optional fields become null when empty
export type ContactInput = {
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  contactFrequency: ContactFrequency | null;
  birthDate: BirthDate | null;
  // Ids of the groups the contact is in, without repeats
  groupIds: number[];
};

export type ContactFormState = {
  status: "idle" | "error" | "saved";
  values?: ContactValues;
  errors?: ContactErrors;
};

export const EMPTY_CONTACT_VALUES: ContactValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  notes: "",
  contactFrequency: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  groupIds: [],
};

const MAX_LENGTH: Record<TextField, number> = {
  name: 200,
  about: 500,
  howWeMet: 500,
  phone: 50,
  email: 254,
  notes: 20000,
};

// Group ids are Postgres integers: positive, at most 2^31 - 1
const GROUP_ID_PATTERN = /^[1-9][0-9]{0,9}$/;
const MAX_GROUP_ID = 2147483647;

function isGroupId(value: string) {
  return GROUP_ID_PATTERN.test(value) && Number(value) <= MAX_GROUP_ID;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]+$/;

type ParseResult =
  | { ok: true; values: ContactValues; data: ContactInput }
  | { ok: false; values: ContactValues; errors: ContactErrors };

// `today` is "YYYY-MM-DD" in APP_TIME_ZONE, for the birth date checks
export function parseContactForm(
  formData: FormData,
  today: string,
): ParseResult {
  const values = {
    ...Object.fromEntries(
      CONTACT_FIELDS.map((field) => {
        const raw = formData.get(field);
        return [field, typeof raw === "string" ? raw.trim() : ""];
      }),
    ),
    groupIds: formData
      .getAll("groupIds")
      .map((raw) => (typeof raw === "string" ? raw.trim() : "")),
  } as ContactValues;

  const errors: ContactErrors = {};

  for (const field of TEXT_FIELDS) {
    if (values[field].length > MAX_LENGTH[field]) {
      errors[field] = `Слишком длинно: максимум ${MAX_LENGTH[field]} символов`;
    }
  }
  if (!values.name) {
    errors.name = "Укажите имя";
  }
  if (values.phone && !errors.phone && !PHONE_PATTERN.test(values.phone)) {
    errors.phone = "Только цифры, пробелы и символы + - ( )";
  }
  if (values.email && !errors.email && !EMAIL_PATTERN.test(values.email)) {
    errors.email = "Похоже, в адресе почты ошибка";
  }
  // Can't happen through the select, only in a forged request
  const { contactFrequency } = values;
  if (contactFrequency && !isContactFrequency(contactFrequency)) {
    errors.contactFrequency = "Выберите вариант из списка";
  }

  // Can't happen through the checkboxes, only in a forged request
  if (!values.groupIds.every(isGroupId)) {
    errors.groupIds = "Выберите группы из списка";
  }

  const birthDate = parseBirthDate(
    { day: values.birthDay, month: values.birthMonth, year: values.birthYear },
    today,
  );
  if (!birthDate.ok) {
    errors.birthDate = birthDate.error;
  }

  if (Object.keys(errors).length > 0 || !birthDate.ok) {
    return { ok: false, values, errors };
  }

  return {
    ok: true,
    values,
    data: {
      name: values.name,
      about: values.about || null,
      howWeMet: values.howWeMet || null,
      phone: values.phone || null,
      email: values.email || null,
      notes: values.notes || null,
      contactFrequency: isContactFrequency(contactFrequency)
        ? contactFrequency
        : null,
      birthDate: birthDate.value,
      groupIds: [...new Set(values.groupIds.map(Number))],
    },
  };
}
