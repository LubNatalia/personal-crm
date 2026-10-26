import type { ContactFrequency } from "@/db/schema";
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

export const CONTACT_FIELDS = [...TEXT_FIELDS, "contactFrequency"] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

// Raw form values as the user typed them; an empty frequency is "not set"
export type ContactValues = Record<ContactField, string>;

// Values ready to be stored: optional fields become null when empty
export type ContactInput = {
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  contactFrequency: ContactFrequency | null;
};

export type ContactFormState = {
  status: "idle" | "error" | "saved";
  values?: ContactValues;
  errors?: Partial<Record<ContactField, string>>;
};

export const EMPTY_CONTACT_VALUES: ContactValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  notes: "",
  contactFrequency: "",
};

const MAX_LENGTH: Record<TextField, number> = {
  name: 200,
  about: 500,
  howWeMet: 500,
  phone: 50,
  email: 254,
  notes: 20000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]+$/;

type ParseResult =
  | { ok: true; values: ContactValues; data: ContactInput }
  | {
      ok: false;
      values: ContactValues;
      errors: Partial<Record<ContactField, string>>;
    };

export function parseContactForm(formData: FormData): ParseResult {
  const values = Object.fromEntries(
    CONTACT_FIELDS.map((field) => {
      const raw = formData.get(field);
      return [field, typeof raw === "string" ? raw.trim() : ""];
    }),
  ) as ContactValues;

  const errors: Partial<Record<ContactField, string>> = {};

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

  if (Object.keys(errors).length > 0) {
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
    },
  };
}
