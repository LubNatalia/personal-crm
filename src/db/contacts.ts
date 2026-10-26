import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { ContactInput } from "@/lib/contact-form";
import {
  APP_TIME_ZONE,
  CONTACT_FREQUENCIES,
  FREQUENCY_INFO,
} from "@/lib/keep-in-touch";
import { hasNewNoteLines } from "@/lib/notes";
import { getDb } from "./index";
import { contacts, type ContactFrequency } from "./schema";

// Escape LIKE wildcards so the user's text is matched literally
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// When it's time to get in touch: one set of expressions for the block on
// the home page and for the contact page. Days are in APP_TIME_ZONE
const today = sql`(now() at time zone ${APP_TIME_ZONE})::date`;
const lastContactedDay = sql`(${contacts.lastContactedAt} at time zone ${APP_TIME_ZONE})::date`;
// Counting starts at the last contact, or, while it's unknown, at the day
// the frequency was set
const startDay = sql`(coalesce(${contacts.lastContactedAt}, ${contacts.frequencySetAt}) at time zone ${APP_TIME_ZONE})::date`;
const frequencyInterval = sql`case ${contacts.contactFrequency} ${sql.join(
  CONTACT_FREQUENCIES.map(
    (frequency) =>
      sql`when ${frequency} then ${FREQUENCY_INFO[frequency].interval}::interval`,
  ),
  sql` `,
)} end`;
// Postgres clamps to the end of the month: Jan 31 + 1 month = Feb 28
const dueDay = sql`(${startDay} + ${frequencyInterval})::date`;
// 0: due today, above 0: overdue, below 0: not yet; null without a frequency
const overdueDays = sql`(${today} - ${dueDay})`;

// Days go out as "YYYY-MM-DD" strings so they can't shift with the time
// zone when parsed in JavaScript
function dayString(day: SQL) {
  return sql<string | null>`to_char(${day}, 'YYYY-MM-DD')`;
}

const dueFields = {
  today: sql<string>`to_char(${today}, 'YYYY-MM-DD')`,
  lastContactedDay: dayString(lastContactedDay),
  dueDay: dayString(dueDay),
  overdueDays: sql<number | null>`${overdueDays}`,
  contactedToday: sql<boolean>`coalesce(${lastContactedDay} = ${today}, false)`,
};

// Contacts it's time to get in touch with: the most overdue first, then by name
export async function listDueContacts() {
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      // Both are never null here: the filter below keeps only contacts with
      // a frequency
      contactFrequency: sql<ContactFrequency>`${contacts.contactFrequency}`,
      ...dueFields,
      overdueDays: sql<number>`${overdueDays}`,
    })
    .from(contacts)
    .where(
      and(isNotNull(contacts.contactFrequency), sql`${overdueDays} >= 0`),
    )
    .orderBy(
      desc(overdueDays),
      sql`${contacts.name} collate "ru-x-icu"`,
      asc(contacts.id),
    );
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
    .select({ ...getTableColumns(contacts), ...dueFields })
    .from(contacts)
    .where(eq(contacts.id, id));
  return row ?? null;
}

export async function createContact(input: ContactInput) {
  const [row] = await getDb()
    .insert(contacts)
    .values({
      ...input,
      // Notes on a new contact count as being in touch on the day it's added
      lastContactedAt: input.notes ? sql`now()` : null,
      frequencySetAt: input.contactFrequency ? sql`now()` : null,
    })
    .returning({ id: contacts.id });
  return row.id;
}

export async function updateContact(id: number, input: ContactInput) {
  return getDb().transaction(async (tx) => {
    // Locks the row until the end of the transaction, so a save from
    // another tab can't slip in between reading and writing
    const [previous] = await tx
      .select({
        notes: contacts.notes,
        contactFrequency: contacts.contactFrequency,
      })
      .from(contacts)
      .where(eq(contacts.id, id))
      .for("update");
    if (!previous) {
      return false;
    }

    // Counting starts anew only when the frequency goes from "not set" to
    // a value; switching between values keeps the start
    let frequencySetAt: SQL | null | undefined;
    if (input.contactFrequency === null) {
      frequencySetAt = null;
    } else if (previous.contactFrequency === null) {
      frequencySetAt = sql`now()`;
    }

    await tx
      .update(contacts)
      .set({
        ...input,
        updatedAt: new Date(),
        // Undefined leaves the column as it is
        lastContactedAt: hasNewNoteLines(previous.notes, input.notes)
          ? sql`now()`
          : undefined,
        frequencySetAt,
      })
      .where(eq(contacts.id, id));
    return true;
  });
}

// Exact timestamp for undoing a mark: microseconds are lost in a JS Date
function exactTimestamp(column: typeof contacts.lastContactedAt) {
  return sql<string | null>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

// Marks that we were in touch today. Returns what's needed to undo it, or
// null when there's nothing to mark: no such contact or no frequency set
export async function markContacted(id: number) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({
        contactFrequency: contacts.contactFrequency,
        previous: exactTimestamp(contacts.lastContactedAt),
      })
      .from(contacts)
      .where(eq(contacts.id, id))
      .for("update");
    if (!row || row.contactFrequency === null) {
      return null;
    }

    // updated_at stays: "changed" in the card header is about editing fields
    const [marked] = await tx
      .update(contacts)
      .set({ lastContactedAt: sql`now()` })
      .where(eq(contacts.id, id))
      .returning({ markedAt: exactTimestamp(contacts.lastContactedAt) });
    return { previous: row.previous, markedAt: marked.markedAt as string };
  });
}

// Puts back the previous last contact. Does nothing if the contact was
// marked again since (e.g. a new note from another tab); returns whether
// the mark was undone
export async function unmarkContacted(
  id: number,
  markedAt: string,
  previous: string | null,
) {
  const [row] = await getDb()
    .update(contacts)
    .set({ lastContactedAt: sql`${previous}::timestamptz` })
    .where(
      and(
        eq(contacts.id, id),
        sql`${contacts.lastContactedAt} = ${markedAt}::timestamptz`,
      ),
    )
    .returning({ id: contacts.id });
  return row !== undefined;
}

// Returns the deleted contact's name, or null if it was already gone
export async function deleteContact(id: number) {
  const [row] = await getDb()
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ name: contacts.name });
  return row?.name ?? null;
}
