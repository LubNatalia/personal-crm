import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./index";
import {
  createGroup,
  deleteGroup,
  listGroups,
  listGroupsWithCounts,
  renameGroup,
} from "./groups";
import { contactGroups, contacts } from "./schema";
import { resetTestDb } from "./test-db";

beforeEach(resetTestDb);

// Creates a group that must not fail and returns its id
async function makeGroup(name: string) {
  const result = await createGroup(name);
  if (!result.ok) throw new Error(`Group "${name}" was not created`);
  return result.group.id;
}

async function makeContact(name: string, groupIds: number[]) {
  const [contact] = await getDb()
    .insert(contacts)
    .values({ name })
    .returning({ id: contacts.id });
  if (groupIds.length > 0) {
    await getDb()
      .insert(contactGroups)
      .values(groupIds.map((groupId) => ({ contactId: contact.id, groupId })));
  }
  return contact.id;
}

async function groupIdsOf(contactId: number) {
  const rows = await getDb()
    .select({ groupId: contactGroups.groupId })
    .from(contactGroups)
    .where(eq(contactGroups.contactId, contactId));
  return rows.map((row) => row.groupId);
}

describe("createGroup", () => {
  it("creates a group", async () => {
    const result = await createGroup("Теннис");

    expect(result).toEqual({
      ok: true,
      group: { id: expect.any(Number), name: "Теннис" },
    });
    expect(await listGroups()).toEqual([
      { id: expect.any(Number), name: "Теннис" },
    ]);
  });

  it.each([
    ["Теннис", "теннис"],
    ["Теннис", "ТЕННИС"],
    ["Ёжики", "ёжики"],
    ["ёжики", "Ёжики"],
  ])(
    "says the group exists when %s is taken and %s is added",
    async (existing, added) => {
      await createGroup(existing);

      expect(await createGroup(added)).toEqual({
        ok: false,
        reason: "duplicate",
      });
      expect(await listGroups()).toHaveLength(1);
    },
  );
});

describe("listGroups", () => {
  it("lists groups alphabetically", async () => {
    await createGroup("Теннис");
    await createGroup("Аналитики");
    await createGroup("Семья");

    const groups = await listGroups();
    expect(groups.map((group) => group.name)).toEqual([
      "Аналитики",
      "Семья",
      "Теннис",
    ]);
  });

  it("puts Ё where it belongs in the Russian alphabet", async () => {
    await createGroup("Ж");
    await createGroup("Ёжики");
    await createGroup("Е");

    const groups = await listGroups();
    expect(groups.map((group) => group.name)).toEqual(["Е", "Ёжики", "Ж"]);
  });
});

describe("renameGroup", () => {
  it("changes the name, the contacts stay in the group", async () => {
    const tennis = await makeGroup("Теннис");
    const anna = await makeContact("Анна", [tennis]);

    expect(await renameGroup(tennis, "Большой теннис")).toEqual({ ok: true });

    expect((await listGroups()).map((group) => group.name)).toEqual([
      "Большой теннис",
    ]);
    expect(await groupIdsOf(anna)).toEqual([tennis]);
  });

  it("lets only the letter case change", async () => {
    const tennis = await makeGroup("теннис");

    expect(await renameGroup(tennis, "Теннис")).toEqual({ ok: true });
    expect((await listGroups()).map((group) => group.name)).toEqual(["Теннис"]);
  });

  it("refuses the name of another group, both groups stay as they were", async () => {
    await makeGroup("Теннис");
    const family = await makeGroup("Семья");

    expect(await renameGroup(family, "теннис")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect((await listGroups()).map((group) => group.name)).toEqual([
      "Семья",
      "Теннис",
    ]);
  });

  it("says not found for a group that does not exist, without throwing", async () => {
    expect(await renameGroup(12345, "Теннис")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("deleteGroup", () => {
  it("returns the name, the contacts stay, their links to the group go", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const anna = await makeContact("Анна", [tennis, family]);
    const boris = await makeContact("Борис", [tennis]);

    expect(await deleteGroup(tennis)).toBe("Теннис");

    expect(await getDb().select().from(contacts)).toHaveLength(2);
    expect(await groupIdsOf(anna)).toEqual([family]);
    expect(await groupIdsOf(boris)).toEqual([]);
    expect((await listGroups()).map((group) => group.name)).toEqual(["Семья"]);
  });

  it("returns null when the group is already gone", async () => {
    const tennis = await makeGroup("Теннис");

    await deleteGroup(tennis);
    expect(await deleteGroup(tennis)).toBeNull();
  });
});

describe("listGroupsWithCounts", () => {
  it("counts contacts in each group, zero included, alphabetically", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await makeGroup("Аналитики");
    await makeContact("Анна", [tennis, family]);
    await makeContact("Борис", [tennis]);

    const groups = await listGroupsWithCounts();
    expect(
      groups.map(({ name, contactCount }) => [name, contactCount]),
    ).toEqual([
      ["Аналитики", 0],
      ["Семья", 1],
      ["Теннис", 2],
    ]);
    expect(groups[0]).toHaveProperty("id");
  });

  it("does not count a deleted contact", async () => {
    const tennis = await makeGroup("Теннис");
    await makeContact("Анна", [tennis]);
    const boris = await makeContact("Борис", [tennis]);

    await getDb().delete(contacts).where(eq(contacts.id, boris));

    const [group] = await listGroupsWithCounts();
    expect(group.contactCount).toBe(1);
  });
});
