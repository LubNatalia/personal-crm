import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContactInput } from "@/lib/contact-form";
import {
  countContacts,
  createContact,
  deleteContact,
  getContact,
  listContacts,
  updateContact,
} from "./contacts";
import { createGroup, deleteGroup } from "./groups";
import { getDb } from "./index";
import { contactGroups } from "./schema";
import { resetTestDb } from "./test-db";

beforeEach(resetTestDb);

function contactInput(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    name: "Анна",
    about: null,
    howWeMet: null,
    phone: null,
    email: null,
    notes: null,
    contactFrequency: null,
    groupIds: [],
    ...overrides,
  };
}

async function makeGroup(name: string) {
  const result = await createGroup(name);
  if (!result.ok) throw new Error(`Group "${name}" was not created`);
  return result.group.id;
}

// Group ids of a contact, sorted so the order of rows doesn't matter
async function groupIdsOf(id: number) {
  const contact = await getContact(id);
  return [...(contact?.groupIds ?? [])].sort((a, b) => a - b);
}

describe("createContact: groups", () => {
  it("puts a new contact in two groups", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");

    const id = await createContact(
      contactInput({ groupIds: [friends, tennis] }),
    );

    expect(await groupIdsOf(id)).toEqual([friends, tennis]);
  });

  it("creates a contact without groups", async () => {
    await makeGroup("Друзья");

    const id = await createContact(contactInput());

    expect(await groupIdsOf(id)).toEqual([]);
  });

  it("skips a group that was deleted meanwhile and keeps the rest", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    await deleteGroup(tennis);

    const id = await createContact(
      contactInput({ groupIds: [friends, tennis] }),
    );

    expect(await groupIdsOf(id)).toEqual([friends]);
  });

  it("saves frequency and notes as before", async () => {
    const id = await createContact(
      contactInput({
        notes: "Договорились созвониться",
        contactFrequency: "month",
      }),
    );

    const contact = await getContact(id);
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
      contactInput({ groupIds: [friends, tennis] }),
    );

    const updated = await updateContact(
      id,
      contactInput({ groupIds: [tennis, family] }),
    );

    expect(updated).toBe(true);
    expect(await groupIdsOf(id)).toEqual([tennis, family]);
  });

  it("removes all groups when the list is empty", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(contactInput({ groupIds: [friends] }));

    await updateContact(id, contactInput({ groupIds: [] }));

    expect(await groupIdsOf(id)).toEqual([]);
  });

  it("keeps a group that stays ticked", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(contactInput({ groupIds: [friends] }));

    await updateContact(id, contactInput({ groupIds: [friends] }));

    expect(await groupIdsOf(id)).toEqual([friends]);
  });

  it("skips a group that was deleted meanwhile and keeps the rest", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    const id = await createContact(contactInput());
    await deleteGroup(tennis);

    await updateContact(id, contactInput({ groupIds: [friends, tennis] }));

    expect(await groupIdsOf(id)).toEqual([friends]);
  });

  it("does not touch other contacts' groups", async () => {
    const friends = await makeGroup("Друзья");
    const anna = await createContact(contactInput({ groupIds: [friends] }));
    const boris = await createContact(
      contactInput({ name: "Борис", groupIds: [friends] }),
    );

    await updateContact(anna, contactInput({ groupIds: [] }));

    expect(await groupIdsOf(boris)).toEqual([friends]);
  });

  it("returns false for a contact that does not exist, and adds no links", async () => {
    const friends = await makeGroup("Друзья");

    expect(
      await updateContact(999, contactInput({ groupIds: [friends] })),
    ).toBe(false);
    expect(await getDb().select().from(contactGroups)).toEqual([]);
  });

  it("saves frequency and notes as before", async () => {
    const id = await createContact(contactInput());

    await updateContact(
      id,
      contactInput({ notes: "Новая заметка", contactFrequency: "week" }),
    );

    const contact = await getContact(id);
    expect(contact?.notes).toBe("Новая заметка");
    expect(contact?.contactFrequency).toBe("week");
    expect(contact?.lastContactedDay).toBe(contact?.today);
  });
});

describe("deleteContact: groups", () => {
  it("removes the contact's links, the groups stay", async () => {
    const friends = await makeGroup("Друзья");
    const id = await createContact(contactInput({ groupIds: [friends] }));

    expect(await deleteContact(id)).toBe("Анна");

    expect(await getDb().select().from(contactGroups)).toEqual([]);
    const remaining = await getDb()
      .$client`select count(*)::int as count from groups`;
    expect(remaining[0].count).toBe(1);
  });
});

describe("getContact", () => {
  it("returns null for a contact that does not exist", async () => {
    expect(await getContact(999)).toBeNull();
  });

  it("returns the contact's own groups only", async () => {
    const friends = await makeGroup("Друзья");
    await makeGroup("Теннис");
    const id = await createContact(contactInput({ groupIds: [friends] }));

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
    await createContact(contactInput({ name: "Борис", groupIds: [tennis] }));
    await createContact(
      contactInput({ name: "Анна", groupIds: [friends, tennis] }),
    );
    await createContact(contactInput({ name: "Вера" }));
    return { friends, tennis };
  }

  const names = (rows: { name: string }[]) => rows.map((row) => row.name);

  it("lists only the group's contacts, alphabetically", async () => {
    const { tennis } = await seedTwoGroups();

    expect(names(await listContacts("", tennis))).toEqual(["Анна", "Борис"]);
  });

  it("shows a contact from two groups in both", async () => {
    const { friends, tennis } = await seedTwoGroups();

    expect(names(await listContacts("", friends))).toEqual(["Анна"]);
    expect(names(await listContacts("", tennis))).toContain("Анна");
  });

  it("searches by name inside the group only", async () => {
    const { tennis } = await seedTwoGroups();
    await createContact(contactInput({ name: "Анатолий" }));

    expect(names(await listContacts("Ан", tennis))).toEqual(["Анна"]);
    expect(await listContacts("Вер", tennis)).toEqual([]);
  });

  it("lists everyone, alphabetically, without a group", async () => {
    await seedTwoGroups();

    expect(names(await listContacts(""))).toEqual(["Анна", "Борис", "Вера"]);
    expect(names(await listContacts("", null))).toEqual([
      "Анна",
      "Борис",
      "Вера",
    ]);
  });

  it("gives an empty list for an empty group", async () => {
    await seedTwoGroups();
    const analysts = await makeGroup("Аналитики");

    expect(await listContacts("", analysts)).toEqual([]);
  });

  it("gives every row the ids of its groups", async () => {
    const { friends, tennis } = await seedTwoGroups();

    const rows = await listContacts("");
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

    expect(await countContacts()).toBe(3);
    expect(await countContacts(null)).toBe(3);
    expect(await countContacts(tennis)).toBe(2);
    expect(await countContacts(friends)).toBe(1);
    expect(await countContacts(analysts)).toBe(0);
  });
});
