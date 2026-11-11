import { eq, sql, type SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContactInput } from "@/lib/contact-form";
import { APP_TIME_ZONE } from "@/lib/keep-in-touch";
import { addDays, addMonths } from "@/test/days";
import {
  countContacts,
  createContact,
  deleteContact,
  getContact,
  listBirthdayContacts,
  listContacts,
  listDueContacts,
  markContacted,
  unmarkContacted,
  updateContact,
} from "./contacts";
import { createGroup, deleteGroup } from "./groups";
import { getDb } from "./index";
import { contactGroups, contacts } from "./schema";
import { createTestUser, resetTestDb } from "./test-db";

// The user whose data most tests work with
let userId: string;

beforeEach(async () => {
  await resetTestDb();
  userId = await createTestUser("anna@example.com");
});

function contactInput(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    name: "Анна",
    about: null,
    howWeMet: null,
    phone: null,
    email: null,
    notes: null,
    contactFrequency: null,
    birthDate: null,
    groupIds: [],
    ...overrides,
  };
}

async function makeGroup(name: string) {
  const result = await createGroup(userId, name);
  if (!result.ok) throw new Error(`Group "${name}" was not created`);
  return result.group.id;
}

// Group ids of a contact, sorted so the order of rows doesn't matter
async function groupIdsOf(id: number, owner = userId) {
  const contact = await getContact(owner, id);
  return [...(contact?.groupIds ?? [])].sort((a, b) => a - b);
}

describe("createContact: groups", () => {
  it("puts a new contact in two groups", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");

    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends, tennis] }),
    );

    expect(await groupIdsOf(id)).toEqual([friends, tennis]);
  });

  it("creates a contact without groups", async () => {
    await makeGroup("Друзья");

    const id = await createContact(userId, contactInput());

    expect(await groupIdsOf(id)).toEqual([]);
  });

  it("skips a group that was deleted meanwhile and keeps the rest", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    await deleteGroup(userId, tennis);

    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends, tennis] }),
    );

    expect(await groupIdsOf(id)).toEqual([friends]);
  });

  it("saves frequency and notes as before", async () => {
    const id = await createContact(
      userId,
      contactInput({
        notes: "Договорились созвониться",
        contactFrequency: "month",
      }),
    );

    const contact = await getContact(userId, id);
    expect(contact?.notes).toBe("Договорились созвониться");
    expect(contact?.contactFrequency).toBe("month");
    expect(contact?.lastContactedDay).toBe(contact?.today);
    expect(contact?.dueDay).not.toBeNull();
  });
});

describe("updateContact: groups", () => {
  it("adds and removes groups", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends, tennis] }),
    );

    const updated = await updateContact(
      userId,
      id,
      contactInput({ groupIds: [tennis, family] }),
    );

    expect(updated).toBe(true);
    expect(await groupIdsOf(id)).toEqual([tennis, family]);
  });

  it("removes all groups when the list is empty", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends] }),
    );

    await updateContact(userId, id, contactInput({ groupIds: [] }));

    expect(await groupIdsOf(id)).toEqual([]);
  });

  it("keeps a group that stays ticked", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends] }),
    );

    await updateContact(userId, id, contactInput({ groupIds: [friends] }));

    expect(await groupIdsOf(id)).toEqual([friends]);
  });

  it("skips a group that was deleted meanwhile and keeps the rest", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    const id = await createContact(userId, contactInput());
    await deleteGroup(userId, tennis);

    await updateContact(
      userId,
      id,
      contactInput({ groupIds: [friends, tennis] }),
    );

    expect(await groupIdsOf(id)).toEqual([friends]);
  });

  it("does not touch other contacts' groups", async () => {
    const friends = await makeGroup("Друзья");
    const anna = await createContact(
      userId,
      contactInput({ groupIds: [friends] }),
    );
    const boris = await createContact(
      userId,
      contactInput({ name: "Борис", groupIds: [friends] }),
    );

    await updateContact(userId, anna, contactInput({ groupIds: [] }));

    expect(await groupIdsOf(boris)).toEqual([friends]);
  });

  it("returns false for a contact that does not exist, and adds no links", async () => {
    const friends = await makeGroup("Друзья");

    expect(
      await updateContact(userId, 999, contactInput({ groupIds: [friends] })),
    ).toBe(false);
    expect(await getDb().select().from(contactGroups)).toEqual([]);
  });

  it("saves frequency and notes as before", async () => {
    const id = await createContact(userId, contactInput());

    await updateContact(
      userId,
      id,
      contactInput({ notes: "Новая заметка", contactFrequency: "week" }),
    );

    const contact = await getContact(userId, id);
    expect(contact?.notes).toBe("Новая заметка");
    expect(contact?.contactFrequency).toBe("week");
    expect(contact?.lastContactedDay).toBe(contact?.today);
  });
});

describe("deleteContact: groups", () => {
  it("removes the contact's links, the groups stay", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends] }),
    );

    expect(await deleteContact(userId, id)).toBe("Анна");

    expect(await getDb().select().from(contactGroups)).toEqual([]);
    const remaining = await getDb()
      .$client`select count(*)::int as count from groups`;
    expect(remaining[0].count).toBe(1);
  });
});

describe("getContact", () => {
  it("returns null for a contact that does not exist", async () => {
    expect(await getContact(userId, 999)).toBeNull();
  });

  it("returns the contact's own groups only", async () => {
    const friends = await makeGroup("Друзья");
    await makeGroup("Теннис");
    const id = await createContact(
      userId,
      contactInput({ groupIds: [friends] }),
    );

    expect(await groupIdsOf(id)).toEqual([friends]);
    expect(
      await getDb()
        .select()
        .from(contactGroups)
        .where(eq(contactGroups.contactId, id)),
    ).toHaveLength(1);
  });
});

describe("listContacts and countContacts: group filter", () => {
  // Анна и Борис играют в теннис, Анна ещё и в друзьях, Вера ни в чём
  async function seedTwoGroups() {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    await createContact(
      userId,
      contactInput({ name: "Борис", groupIds: [tennis] }),
    );
    await createContact(
      userId,
      contactInput({ name: "Анна", groupIds: [friends, tennis] }),
    );
    await createContact(userId, contactInput({ name: "Вера" }));
    return { friends, tennis };
  }

  const names = (rows: { name: string }[]) => rows.map((row) => row.name);

  it("lists only the group's contacts, alphabetically", async () => {
    const { tennis } = await seedTwoGroups();

    expect(names(await listContacts(userId, "", tennis))).toEqual([
      "Анна",
      "Борис",
    ]);
  });

  it("shows a contact from two groups in both", async () => {
    const { friends, tennis } = await seedTwoGroups();

    expect(names(await listContacts(userId, "", friends))).toEqual(["Анна"]);
    expect(names(await listContacts(userId, "", tennis))).toContain("Анна");
  });

  it("searches by name inside the group only", async () => {
    const { tennis } = await seedTwoGroups();
    await createContact(userId, contactInput({ name: "Анатолий" }));

    expect(names(await listContacts(userId, "Ан", tennis))).toEqual(["Анна"]);
    expect(await listContacts(userId, "Вер", tennis)).toEqual([]);
  });

  it("lists everyone, alphabetically, without a group", async () => {
    await seedTwoGroups();

    expect(names(await listContacts(userId, ""))).toEqual([
      "Анна",
      "Борис",
      "Вера",
    ]);
    expect(names(await listContacts(userId, "", null))).toEqual([
      "Анна",
      "Борис",
      "Вера",
    ]);
  });

  it("gives an empty list for an empty group", async () => {
    await seedTwoGroups();
    const analysts = await makeGroup("Аналитики");

    expect(await listContacts(userId, "", analysts)).toEqual([]);
  });

  it("gives every row the ids of its groups", async () => {
    const { friends, tennis } = await seedTwoGroups();

    const rows = await listContacts(userId, "");
    const byName = Object.fromEntries(
      rows.map((row) => [row.name, [...row.groupIds].sort((a, b) => a - b)]),
    );
    expect(byName).toEqual({
      Анна: [friends, tennis],
      Борис: [tennis],
      Вера: [],
    });
  });

  it("counts all contacts, or the group's", async () => {
    const { friends, tennis } = await seedTwoGroups();
    const analysts = await makeGroup("Аналитики");

    expect(await countContacts(userId)).toBe(3);
    expect(await countContacts(userId, null)).toBe(3);
    expect(await countContacts(userId, tennis)).toBe(2);
    expect(await countContacts(userId, friends)).toBe(1);
    expect(await countContacts(userId, analysts)).toBe(0);
  });
});

// Keep in touch. Days are counted by the database from now(), so the tests
// put the last contact in the past instead of changing "today"

const NOTES = "Обсудили отпуск\nДоговорились созвониться";

async function setTimes(
  id: number,
  times: { lastContactedAt?: SQL | null; frequencySetAt?: SQL | null },
) {
  await getDb().update(contacts).set(times).where(eq(contacts.id, id));
}

function daysAgo(days: number) {
  return sql`now() - make_interval(days => ${days})`;
}

// A moment in Moscow time, e.g. "2026-10-02 23:30"
function moscowTime(value: string) {
  return sql`(${value}::timestamp at time zone ${APP_TIME_ZONE})`;
}

async function contactOf(id: number) {
  const contact = await getContact(userId, id);
  if (!contact) throw new Error(`Contact ${id} not found`);
  return contact;
}

async function dueNames() {
  return (await listDueContacts(userId)).map((contact) => contact.name);
}

// A contact to keep in touch with weekly, overdue by 17 days
async function makeOverdueContact(overrides: Partial<ContactInput> = {}) {
  const id = await createContact(
    userId,
    contactInput({ notes: NOTES, contactFrequency: "week", ...overrides }),
  );
  await setTimes(id, { lastContactedAt: daysAgo(24) });
  return id;
}

describe("keep in touch: frequency", () => {
  it("takes a contact out of the block when the frequency is removed", async () => {
    const id = await makeOverdueContact();
    expect(await dueNames()).toEqual(["Анна"]);

    await updateContact(userId, id, contactInput({ notes: NOTES }));

    const contact = await contactOf(id);
    expect(contact.contactFrequency).toBeNull();
    expect(contact.dueDay).toBeNull();
    expect(await dueNames()).toEqual([]);
  });

  it("never puts a contact without a frequency in the block", async () => {
    const id = await createContact(userId, contactInput({ notes: NOTES }));
    await setTimes(id, { lastContactedAt: sql`now() - interval '5 years'` });

    expect(await dueNames()).toEqual([]);
  });
});

describe("keep in touch: a new note", () => {
  it("takes an overdue contact out of the block, the due day is a week from today", async () => {
    const id = await makeOverdueContact();
    expect(await dueNames()).toEqual(["Анна"]);

    await updateContact(
      userId,
      id,
      contactInput({
        notes: `${NOTES}\nСозвонились`,
        contactFrequency: "week",
      }),
    );

    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBe(contact.today);
    expect(contact.dueDay).toBe(addDays(contact.today, 7));
    expect(contact.contactedToday).toBe(true);
    expect(await dueNames()).toEqual([]);
  });

  it.each([
    ["fixing a typo in a line", { notes: NOTES.replace("отпуск", "отпусск") }],
    ["adding to the end of a line", { notes: `${NOTES} в Сочи` }],
    ["deleting a line", { notes: "Обсудили отпуск" }],
    ["deleting all the notes", { notes: null }],
    [
      "fixing a line and adding a new one",
      { notes: `${NOTES.replace("отпуск", "отпусск")}\nСозвонились` },
    ],
    ["adding only blank lines", { notes: `${NOTES}\n\n   ` }],
    ["changing only the phone", { phone: "+7 900 123-45-67" }],
    ["saving without changes", {}],
  ])(
    "keeps the last contact when %s",
    async (_case, overrides: Partial<ContactInput>) => {
      const id = await makeOverdueContact();

      await updateContact(
        userId,
        id,
        contactInput({ notes: NOTES, contactFrequency: "week", ...overrides }),
      );

      const contact = await contactOf(id);
      expect(contact.lastContactedDay).toBe(addDays(contact.today, -24));
      expect(contact.overdueDays).toBe(17);
    },
  );

  it("counts notes on a new contact as being in touch on the day it's added", async () => {
    const id = await createContact(
      userId,
      contactInput({ notes: NOTES, contactFrequency: "month" }),
    );

    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBe(contact.today);
    expect(contact.dueDay).toBe(addMonths(contact.today, 1));
  });
});

describe("keep in touch: markContacted and unmarkContacted", () => {
  it("marks today, takes the contact out of the block and keeps the notes", async () => {
    const id = await makeOverdueContact();

    const mark = await markContacted(userId, id);

    expect(mark?.previous).not.toBeNull();
    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBe(contact.today);
    expect(contact.dueDay).toBe(addDays(contact.today, 7));
    expect(contact.contactedToday).toBe(true);
    expect(contact.notes).toBe(NOTES);
    expect(await dueNames()).toEqual([]);
  });

  it("counts a week from today when marked before the due day", async () => {
    const id = await makeOverdueContact();
    await setTimes(id, { lastContactedAt: daysAgo(6) });

    await markContacted(userId, id);

    const contact = await contactOf(id);
    expect(contact.dueDay).toBe(addDays(contact.today, 7));
  });

  it("puts back the previous last contact when undone", async () => {
    const id = await makeOverdueContact();
    const mark = await markContacted(userId, id);
    if (!mark) throw new Error("Not marked");

    expect(
      await unmarkContacted(userId, id, mark.markedAt, mark.previous),
    ).toBe(true);

    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBe(addDays(contact.today, -24));
    expect(contact.dueDay).toBe(addDays(contact.today, -17));
    expect(contact.overdueDays).toBe(17);
    expect(contact.contactedToday).toBe(false);
    expect(await dueNames()).toEqual(["Анна"]);
  });

  it("puts back an unknown last contact when undone", async () => {
    const id = await createContact(
      userId,
      contactInput({ contactFrequency: "week" }),
    );
    const mark = await markContacted(userId, id);
    if (!mark) throw new Error("Not marked");
    expect(mark.previous).toBeNull();

    await unmarkContacted(userId, id, mark.markedAt, mark.previous);

    expect((await contactOf(id)).lastContactedDay).toBeNull();
  });

  it("can't be undone after a new note the same day", async () => {
    const id = await makeOverdueContact();
    const mark = await markContacted(userId, id);
    if (!mark) throw new Error("Not marked");
    await updateContact(
      userId,
      id,
      contactInput({
        notes: `${NOTES}\nСозвонились`,
        contactFrequency: "week",
      }),
    );

    expect(
      await unmarkContacted(userId, id, mark.markedAt, mark.previous),
    ).toBe(false);
    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBe(contact.today);
    expect(contact.contactedToday).toBe(true);
  });

  it("marks nothing without a frequency", async () => {
    const id = await createContact(userId, contactInput({ notes: NOTES }));
    await setTimes(id, { lastContactedAt: null });

    expect(await markContacted(userId, id)).toBeNull();
    expect((await contactOf(id)).lastContactedDay).toBeNull();
  });
});

describe("keep in touch: where counting starts", () => {
  it("counts from the day the frequency is set for a contact without notes", async () => {
    const id = await createContact(userId, contactInput());

    await updateContact(
      userId,
      id,
      contactInput({ contactFrequency: "month" }),
    );

    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBeNull();
    expect(contact.dueDay).toBe(addMonths(contact.today, 1));
    expect(await dueNames()).toEqual([]);
  });

  it("counts from the day the frequency is set for a contact with old notes", async () => {
    // Notes written before keep in touch: the last contact is unknown
    const id = await createContact(userId, contactInput({ notes: NOTES }));
    await setTimes(id, { lastContactedAt: null });

    await updateContact(
      userId,
      id,
      contactInput({ notes: NOTES, contactFrequency: "week" }),
    );

    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBeNull();
    expect(contact.dueDay).toBe(addDays(contact.today, 7));
  });

  it("counts from a known last contact: overdue right away", async () => {
    const id = await createContact(userId, contactInput({ notes: NOTES }));
    await setTimes(id, { lastContactedAt: daysAgo(18) });

    await updateContact(
      userId,
      id,
      contactInput({ notes: NOTES, contactFrequency: "week" }),
    );

    expect(await listDueContacts(userId)).toMatchObject([
      { name: "Анна", overdueDays: 11 },
    ]);
  });

  it("keeps the last contact as the start when the frequency changes", async () => {
    const id = await makeOverdueContact();
    await setTimes(id, { lastContactedAt: moscowTime("2026-10-02 12:00") });

    await updateContact(
      userId,
      id,
      contactInput({ notes: NOTES, contactFrequency: "month" }),
    );

    expect((await contactOf(id)).dueDay).toBe("2026-11-02");
  });

  it("keeps the day the frequency was set as the start when it changes", async () => {
    const id = await createContact(
      userId,
      contactInput({ contactFrequency: "week" }),
    );
    await setTimes(id, { frequencySetAt: daysAgo(10) });

    await updateContact(
      userId,
      id,
      contactInput({ contactFrequency: "month" }),
    );

    const contact = await contactOf(id);
    expect(contact.dueDay).toBe(addMonths(addDays(contact.today, -10), 1));
  });

  it("counts from the new day when the frequency is removed and set again", async () => {
    const id = await createContact(
      userId,
      contactInput({ contactFrequency: "week" }),
    );
    await setTimes(id, { frequencySetAt: daysAgo(40) });

    await updateContact(userId, id, contactInput());
    await updateContact(userId, id, contactInput({ contactFrequency: "week" }));

    const contact = await contactOf(id);
    expect(contact.dueDay).toBe(addDays(contact.today, 7));
    expect(await dueNames()).toEqual([]);
  });
});

describe("keep in touch: the due day", () => {
  it.each([
    ["week", "2026-10-02", "2026-10-09"],
    ["month", "2026-10-02", "2026-11-02"],
    ["month", "2027-01-31", "2027-02-28"],
    ["quarter", "2026-10-15", "2027-01-15"],
    ["year", "2028-02-29", "2029-02-28"],
  ] as const)(
    "%s from %s is %s",
    async (contactFrequency, lastContacted, dueDay) => {
      const id = await createContact(
        userId,
        contactInput({ contactFrequency }),
      );
      await setTimes(id, {
        lastContactedAt: moscowTime(`${lastContacted} 12:00`),
      });

      const contact = await contactOf(id);
      expect(contact.lastContactedDay).toBe(lastContacted);
      expect(contact.dueDay).toBe(dueDay);
    },
  );

  it.each([
    ["late in the evening", "2026-10-02 23:30", "2026-10-02"],
    // 22:00 UTC of the day before
    ["early in the morning", "2026-10-03 01:00", "2026-10-03"],
  ])("counts days in Moscow time: %s", async (_case, moment, lastContacted) => {
    const id = await createContact(
      userId,
      contactInput({ contactFrequency: "week" }),
    );
    await setTimes(id, { lastContactedAt: moscowTime(moment) });

    const contact = await contactOf(id);
    expect(contact.lastContactedDay).toBe(lastContacted);
    expect(contact.dueDay).toBe(addDays(lastContacted, 7));
  });
});

describe("listDueContacts", () => {
  async function makeWeeklyContact(name: string, lastContactedDaysAgo: number) {
    const id = await createContact(
      userId,
      contactInput({ name, contactFrequency: "week" }),
    );
    await setTimes(id, { lastContactedAt: daysAgo(lastContactedDaysAgo) });
  }

  it("lists contacts due today and overdue, not the ones not yet due", async () => {
    await makeWeeklyContact("Анна", 24);
    await makeWeeklyContact("Борис", 7);
    await makeWeeklyContact("Вера", 6);

    expect(await listDueContacts(userId)).toMatchObject([
      { name: "Анна", overdueDays: 17 },
      { name: "Борис", overdueDays: 0 },
    ]);
  });

  it("puts the most overdue first", async () => {
    await makeWeeklyContact("Борис", 7);
    await makeWeeklyContact("Иван", 23);
    await makeWeeklyContact("Анна", 24);

    expect(await dueNames()).toEqual(["Анна", "Иван", "Борис"]);
  });

  it("puts equally overdue contacts alphabetically", async () => {
    await makeWeeklyContact("Яна", 12);
    await makeWeeklyContact("Вера", 12);

    expect(await dueNames()).toEqual(["Вера", "Яна"]);
  });
});

describe("keep in touch: contacts from before it", () => {
  it("have no frequency and no known last contact, the notes stay", async () => {
    // A row as it was before keep in touch: the new columns are empty
    const [row] = await getDb()
      .insert(contacts)
      .values({ userId, name: "Анна", notes: NOTES })
      .returning({ id: contacts.id });

    const contact = await contactOf(row.id);
    expect(contact.contactFrequency).toBeNull();
    expect(contact.lastContactedDay).toBeNull();
    expect(contact.dueDay).toBeNull();
    expect(contact.notes).toBe(NOTES);
    expect(await dueNames()).toEqual([]);
  });
});

describe("birthdays: saving the date", () => {
  async function birthDateOf(id: number) {
    const contact = await getContact(userId, id);
    return contact && [contact.birthDay, contact.birthMonth, contact.birthYear];
  }

  it("saves a new contact with a date and a year", async () => {
    const id = await createContact(
      userId,
      contactInput({ birthDate: { day: 14, month: 11, year: 1990 } }),
    );

    expect(await birthDateOf(id)).toEqual([14, 11, 1990]);
  });

  it("saves a date without a year", async () => {
    const id = await createContact(
      userId,
      contactInput({ birthDate: { day: 29, month: 2, year: null } }),
    );

    expect(await birthDateOf(id)).toEqual([29, 2, null]);
  });

  it("saves a new contact without a date", async () => {
    const id = await createContact(userId, contactInput());

    expect(await birthDateOf(id)).toEqual([null, null, null]);
  });

  it("changes the date on update", async () => {
    const id = await createContact(
      userId,
      contactInput({ birthDate: { day: 14, month: 11, year: 1990 } }),
    );

    await updateContact(
      userId,
      id,
      contactInput({ birthDate: { day: 3, month: 3, year: null } }),
    );

    expect(await birthDateOf(id)).toEqual([3, 3, null]);
  });

  it("removes the date with null", async () => {
    const id = await createContact(
      userId,
      contactInput({ birthDate: { day: 14, month: 11, year: 1990 } }),
    );

    await updateContact(userId, id, contactInput({ birthDate: null }));

    expect(await birthDateOf(id)).toEqual([null, null, null]);
  });

  it("keeps frequency, last contact and groups as before", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(
      userId,
      contactInput({
        notes: NOTES,
        contactFrequency: "month",
        groupIds: [friends],
      }),
    );
    const before = await getContact(userId, id);

    await updateContact(
      userId,
      id,
      contactInput({
        notes: NOTES,
        contactFrequency: "month",
        groupIds: [friends],
        birthDate: { day: 14, month: 11, year: 1990 },
      }),
    );

    const after = await getContact(userId, id);
    expect(after?.contactFrequency).toBe("month");
    expect(after?.lastContactedAt).toEqual(before?.lastContactedAt);
    expect(after?.frequencySetAt).toEqual(before?.frequencySetAt);
    expect(after?.groupIds).toEqual([friends]);
    expect(await birthDateOf(id)).toEqual([14, 11, 1990]);
  });
});

describe("listBirthdayContacts", () => {
  it("gives only contacts with a birth date", async () => {
    const anna = await createContact(
      userId,
      contactInput({ birthDate: { day: 14, month: 11, year: 1990 } }),
    );
    const boris = await createContact(
      userId,
      contactInput({
        name: "Борис",
        birthDate: { day: 3, month: 3, year: null },
      }),
    );
    await createContact(userId, contactInput({ name: "Вера" }));

    const rows = await listBirthdayContacts(userId);

    expect([...rows].sort((a, b) => a.id - b.id)).toMatchObject([
      { id: anna, name: "Анна", birthDay: 14, birthMonth: 11, birthYear: 1990 },
      { id: boris, name: "Борис", birthDay: 3, birthMonth: 3, birthYear: null },
    ]);
  });

  it("gives only the user's own contacts", async () => {
    const otherId = await createTestUser("boris@example.com");
    await createContact(
      otherId,
      contactInput({ birthDate: { day: 14, month: 11, year: 1990 } }),
    );

    expect(await listBirthdayContacts(userId)).toEqual([]);
  });

  it("gives today in the app's time zone", async () => {
    await createContact(
      userId,
      contactInput({ birthDate: { day: 14, month: 11, year: null } }),
    );
    const [{ today }] = await getDb().$client<{ today: string }[]>`
      select to_char((now() at time zone ${APP_TIME_ZONE})::date, 'YYYY-MM-DD') as today`;

    const [row] = await listBirthdayContacts(userId);

    expect(row.today).toBe(today);
  });
});

// The database itself refuses a birth date that can't be right, whatever
// the code sends
describe("birthdays: database checks", () => {
  type BirthColumns = {
    day: number | null;
    month: number | null;
    year: number | null;
  };

  // Plain SQL, bypassing the data layer, as a buggy query would do
  async function insertBirthDate({ day, month, year }: BirthColumns) {
    await getDb().$client`
      insert into contacts (user_id, name, birth_day, birth_month, birth_year)
      values (${userId}, 'Анна', ${day}, ${month}, ${year})`;
  }

  it.each([
    { day: 14, month: 11, year: 1990 },
    { day: 3, month: 3, year: null },
    { day: null, month: null, year: null },
  ])("accepts %o", async (columns) => {
    await expect(insertBirthDate(columns)).resolves.toBeUndefined();
  });

  it.each([
    { day: 14, month: null, year: null },
    { day: null, month: 11, year: null },
    { day: null, month: null, year: 1990 },
    { day: 14, month: 13, year: null },
    { day: 0, month: 11, year: null },
    { day: 32, month: 11, year: null },
    { day: 14, month: 11, year: 1899 },
  ])("rejects %o", async (columns) => {
    // 23514: a CHECK constraint is violated
    await expect(insertBirthDate(columns)).rejects.toMatchObject({
      code: "23514",
    });
  });
});

// Two users in one database: nobody sees or changes the other's data. A
// foreign id behaves like one that doesn't exist
describe("two users: contacts are separate", () => {
  let otherId: string;

  beforeEach(async () => {
    otherId = await createTestUser("boris@example.com");
  });

  async function makeGroupFor(owner: string, name: string) {
    const result = await createGroup(owner, name);
    if (!result.ok) throw new Error(`Group "${name}" was not created`);
    return result.group.id;
  }

  const names = (rows: { name: string }[]) => rows.map((row) => row.name);

  it("lists, searches and counts only the user's own contacts", async () => {
    await createContact(userId, contactInput({ name: "Анна Козлова" }));
    await createContact(otherId, contactInput({ name: "Вера Козлова" }));
    await createContact(otherId, contactInput({ name: "Дмитрий" }));

    expect(names(await listContacts(userId, ""))).toEqual(["Анна Козлова"]);
    expect(names(await listContacts(userId, "Козлова"))).toEqual([
      "Анна Козлова",
    ]);
    expect(await listContacts(userId, "Дмитрий")).toEqual([]);
    expect(await countContacts(userId)).toBe(1);
    expect(names(await listContacts(otherId, ""))).toEqual([
      "Вера Козлова",
      "Дмитрий",
    ]);
    expect(await countContacts(otherId)).toBe(2);
  });

  it("shows nothing to a user who has no contacts", async () => {
    await createContact(userId, contactInput());
    const newcomer = await createTestUser("vera@example.com");

    expect(await listContacts(newcomer, "")).toEqual([]);
    expect(await countContacts(newcomer)).toBe(0);
    expect(await listDueContacts(newcomer)).toEqual([]);
  });

  it("lists only the user's own contacts in the time-to-get-in-touch block", async () => {
    const mine = await makeOverdueContact({ name: "Моя" });
    const theirs = await createContact(
      otherId,
      contactInput({ name: "Чужая", notes: NOTES, contactFrequency: "week" }),
    );
    await setTimes(theirs, { lastContactedAt: daysAgo(24) });

    expect(await dueNames()).toEqual(["Моя"]);
    expect(names(await listDueContacts(otherId))).toEqual(["Чужая"]);
    expect(mine).not.toBe(theirs);
  });

  it("filters by the user's own group only", async () => {
    const theirGroup = await makeGroupFor(otherId, "Друзья");
    await createContact(otherId, contactInput({ groupIds: [theirGroup] }));
    await createContact(userId, contactInput({ name: "Моя" }));

    expect(await listContacts(userId, "", theirGroup)).toEqual([]);
    expect(await countContacts(userId, theirGroup)).toBe(0);
  });

  it("gives another user's contact as not found", async () => {
    const id = await createContact(otherId, contactInput({ name: "Чужая" }));

    expect(await getContact(userId, id)).toBeNull();
    expect((await getContact(otherId, id))?.name).toBe("Чужая");
  });

  it("does not update another user's contact", async () => {
    const id = await createContact(
      otherId,
      contactInput({ name: "Чужая", notes: "Заметка" }),
    );

    const updated = await updateContact(
      userId,
      id,
      contactInput({ name: "Взломана", notes: "Другая заметка" }),
    );

    expect(updated).toBe(false);
    const contact = await getContact(otherId, id);
    expect(contact?.name).toBe("Чужая");
    expect(contact?.notes).toBe("Заметка");
  });

  it("does not delete another user's contact", async () => {
    const id = await createContact(otherId, contactInput({ name: "Чужая" }));

    expect(await deleteContact(userId, id)).toBeNull();

    expect((await getContact(otherId, id))?.name).toBe("Чужая");
  });

  it("does not mark another user's contact as contacted", async () => {
    const id = await createContact(
      otherId,
      contactInput({ notes: NOTES, contactFrequency: "week" }),
    );
    await setTimes(id, { lastContactedAt: daysAgo(24) });

    expect(await markContacted(userId, id)).toBeNull();

    const contact = await getContact(otherId, id);
    expect(contact?.lastContactedDay).toBe(addDays(contact!.today, -24));
  });

  it("does not undo another user's mark", async () => {
    const id = await createContact(
      otherId,
      contactInput({ notes: NOTES, contactFrequency: "week" }),
    );
    await setTimes(id, { lastContactedAt: daysAgo(24) });
    const mark = await markContacted(otherId, id);
    if (!mark) throw new Error("Not marked");

    expect(
      await unmarkContacted(userId, id, mark.markedAt, mark.previous),
    ).toBe(false);

    const contact = await getContact(otherId, id);
    expect(contact?.contactedToday).toBe(true);
  });

  it("saves a new contact without another user's group", async () => {
    const mine = await makeGroupFor(userId, "Моя");
    const theirs = await makeGroupFor(otherId, "Чужая");

    const id = await createContact(
      userId,
      contactInput({ groupIds: [mine, theirs] }),
    );

    expect(await groupIdsOf(id)).toEqual([mine]);
    const links = await getDb()
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.groupId, theirs));
    expect(links).toEqual([]);
  });

  it("saves a contact without another user's group on update", async () => {
    const mine = await makeGroupFor(userId, "Моя");
    const theirs = await makeGroupFor(otherId, "Чужая");
    const id = await createContact(userId, contactInput({ groupIds: [mine] }));

    await updateContact(userId, id, contactInput({ groupIds: [theirs] }));

    // Mine is unticked, the foreign one is skipped
    expect(await groupIdsOf(id)).toEqual([]);
    expect(await getDb().select().from(contactGroups)).toEqual([]);
  });

  it("does not change another user's group links when saving a contact", async () => {
    const theirs = await makeGroupFor(otherId, "Чужая");
    const theirContact = await createContact(
      otherId,
      contactInput({ groupIds: [theirs] }),
    );

    // The foreign contact's id with the user's own save: nothing happens
    const updated = await updateContact(
      userId,
      theirContact,
      contactInput({ groupIds: [] }),
    );

    expect(updated).toBe(false);
    expect(await groupIdsOf(theirContact, otherId)).toEqual([theirs]);
  });
});
