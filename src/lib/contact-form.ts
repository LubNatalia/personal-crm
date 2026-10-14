export const CONTACT_FIELDS = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "notes",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

// Raw form values as the user typed them
export type ContactValues = Record<ContactField, string>;

// Values ready to be stored: optional fields become null when empty
export type ContactInput = {
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
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
};

const MAX_LENGTH: Record<ContactField, number> = {
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

  for (const field of CONTACT_FIELDS) {
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
    },
  };
}
