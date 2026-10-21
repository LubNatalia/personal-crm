import "server-only";
import { asc, count, eq, ilike, sql } from "drizzle-orm";
import type { ContactInput } from "@/lib/contact-form";
import { getDb } from "./index";
import { contacts } from "./schema";

// Escape LIKE wildcards so the user's text is matched literally
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listContacts(nameQuery: string) {
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(
      nameQuery
        ? ilike(contacts.name, `%${escapeLikePattern(nameQuery)}%`)
        : undefined,
    )
    // ICU Russian collation: correct alphabetical order including "Ё"
    .orderBy(sql`${contacts.name} collate "ru-x-icu"`, asc(contacts.id));
}

export async function countContacts() {
  const [row] = await getDb().select({ value: count() }).from(contacts);
  return row.value;
}

export async function getContact(id: number) {
  const [row] = await getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.id, id));
  return row ?? null;
}

export async function createContact(input: ContactInput) {
  const [row] = await getDb()
    .insert(contacts)
    .values(input)
    .returning({ id: contacts.id });
  return row.id;
}

export async function updateContact(id: number, input: ContactInput) {
  const [row] = await getDb()
    .update(contacts)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return row !== undefined;
}
