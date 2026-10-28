import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  notInArray,
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
import {
  contactGroups,
  contacts,
  groups,
  type ContactFrequency,
} from "./schema";

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

// Ids of the groups the contact is in, as an array in one column
const groupIdsField = sql<number[]>`array(
  select ${contactGroups.groupId} from ${contactGroups}
  where ${contactGroups.contactId} = ${contacts.id}
)`;

// Only the contacts of one group; no condition when there is no group
function inGroup(groupId: number | null | undefined) {
  return groupId == null
    ? undefined
    : sql`exists (
        select 1 from ${contactGroups}
        where ${contactGroups.contactId} = ${contacts.id}
          and ${contactGroups.groupId} = ${groupId}
      )`;
}

// Group names are put on the labels by the page, from the list of groups:
// a row carries only ids
export async function listContacts(
  nameQuery: string,
  groupId?: number | null,
) {
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
      groupIds: groupIdsField,
    })
    .from(contacts)
    .where(
      and(
        nameQuery
          ? ilike(contacts.name, `%${escapeLikePattern(nameQuery)}%`)
          : undefined,
        inGroup(groupId),
      ),
    )
    // ICU Russian collation: correct alphabetical order including "Ё"
    .orderBy(sql`${contacts.name} collate "ru-x-icu"`, asc(contacts.id));
}

// All contacts, or the ones in a group
export async function countContacts(groupId?: number | null) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(contacts)
    .where(inGroup(groupId));
  return row.value;
}

export async function getContact(id: number) {
  const [row] = await getDb()
    .select({
      ...getTableColumns(contacts),
      ...dueFields,
      groupIds: groupIdsField,
    })
    .from(contacts)
    .where(eq(contacts.id, id));
  return row ?? null;
}

type Transaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

// Makes the contact's groups exactly `groupIds`: links not in the list are
// removed, new ones added. A group deleted meanwhile (e.g. in another tab) is
// skipped without an error, the rest is saved
async function saveContactGroups(
  tx: Transaction,
  contactId: number,
  groupIds: number[],
) {
  await tx
    .delete(contactGroups)
    .where(
      and(
        eq(contactGroups.contactId, contactId),
        groupIds.length > 0
          ? notInArray(contactGroups.groupId, groupIds)
          : undefined,
      ),
    );
  if (groupIds.length === 0) {
    return;
  }
  await tx
    .insert(contactGroups)
    .select(
      tx
        .select({
          contactId: sql<number>`${contactId}::integer`.as("contact_id"),
          groupId: groups.id,
        })
        .from(groups)
        .where(inArray(groups.id, groupIds))
        // Keeps the groups from being deleted until this transaction ends
        .for("key share"),
    )
    .onConflictDoNothing();
}

export async function createContact({ groupIds, ...input }: ContactInput) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(contacts)
      .values({
        ...input,
        // Notes on a new contact count as being in touch on the day it's added
        lastContactedAt: input.notes ? sql`now()` : null,
        frequencySetAt: input.contactFrequency ? sql`now()` : null,
      })
      .returning({ id: contacts.id });
    await saveContactGroups(tx, row.id, groupIds);
    return row.id;
  });
}

export async function updateContact(
  id: number,
  { groupIds, ...input }: ContactInput,
) {
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
    await saveContactGroups(tx, id, groupIds);
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
