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
import { createTestUser, resetTestDb } from "./test-db";

// The user whose data most tests work with
let userId: string;

beforeEach(async () => {
  await resetTestDb();
  userId = await createTestUser("anna@example.com");
});

// Creates a group that must not fail and returns its id
async function makeGroup(name: string) {
  const result = await createGroup(userId, name);
  if (!result.ok) throw new Error(`Group "${name}" was not created`);
  return result.group.id;
}

async function makeContact(name: string, groupIds: number[]) {
  const [contact] = await getDb()
    .insert(contacts)
    .values({ userId, name })
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
    const result = await createGroup(userId, "Теннис");

    expect(result).toEqual({
      ok: true,
      group: { id: expect.any(Number), name: "Теннис" },
    });
    expect(await listGroups(userId)).toEqual([
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
      await createGroup(userId, existing);

      expect(await createGroup(userId, added)).toEqual({
        ok: false,
        reason: "duplicate",
      });
      expect(await listGroups(userId)).toHaveLength(1);
    },
  );
});

describe("listGroups", () => {
  it("lists groups alphabetically", async () => {
    await createGroup(userId, "Теннис");
    await createGroup(userId, "Аналитики");
    await createGroup(userId, "Семья");

    const groups = await listGroups(userId);
    expect(groups.map((group) => group.name)).toEqual([
      "Аналитики",
      "Семья",
      "Теннис",
    ]);
  });

  it("puts Ё where it belongs in the Russian alphabet", async () => {
    await createGroup(userId, "Ж");
    await createGroup(userId, "Ёжики");
    await createGroup(userId, "Е");

    const groups = await listGroups(userId);
    expect(groups.map((group) => group.name)).toEqual(["Е", "Ёжики", "Ж"]);
  });
});

describe("renameGroup", () => {
  it("changes the name, the contacts stay in the group", async () => {
    const tennis = await makeGroup("Теннис");
    const anna = await makeContact("Анна", [tennis]);

    expect(await renameGroup(userId, tennis, "Большой теннис")).toEqual({
      ok: true,
    });

    expect((await listGroups(userId)).map((group) => group.name)).toEqual([
      "Большой теннис",
    ]);
    expect(await groupIdsOf(anna)).toEqual([tennis]);
  });

  it("lets only the letter case change", async () => {
    const tennis = await makeGroup("теннис");

    expect(await renameGroup(userId, tennis, "Теннис")).toEqual({ ok: true });
    expect((await listGroups(userId)).map((group) => group.name)).toEqual([
      "Теннис",
    ]);
  });

  it("refuses the name of another group, both groups stay as they were", async () => {
    await makeGroup("Теннис");
    const family = await makeGroup("Семья");

    expect(await renameGroup(userId, family, "теннис")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect((await listGroups(userId)).map((group) => group.name)).toEqual([
      "Семья",
      "Теннис",
    ]);
  });

  it("says not found for a group that does not exist, without throwing", async () => {
    expect(await renameGroup(userId, 12345, "Теннис")).toEqual({
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

    expect(await deleteGroup(userId, tennis)).toBe("Теннис");

    expect(await getDb().select().from(contacts)).toHaveLength(2);
    expect(await groupIdsOf(anna)).toEqual([family]);
    expect(await groupIdsOf(boris)).toEqual([]);
    expect((await listGroups(userId)).map((group) => group.name)).toEqual([
      "Семья",
    ]);
  });

  it("returns null when the group is already gone", async () => {
    const tennis = await makeGroup("Теннис");

    await deleteGroup(userId, tennis);
    expect(await deleteGroup(userId, tennis)).toBeNull();
  });
});

describe("listGroupsWithCounts", () => {
  it("counts contacts in each group, zero included, alphabetically", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await makeGroup("Аналитики");
    await makeContact("Анна", [tennis, family]);
    await makeContact("Борис", [tennis]);

    const groups = await listGroupsWithCounts(userId);
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

    const [group] = await listGroupsWithCounts(userId);
    expect(group.contactCount).toBe(1);
  });
});

// Two users in one database: groups, names and counters are separate
describe("two users: groups are separate", () => {
  let otherId: string;

  beforeEach(async () => {
    otherId = await createTestUser("boris@example.com");
  });

  async function makeGroupFor(owner: string, name: string) {
    const result = await createGroup(owner, name);
    if (!result.ok) throw new Error(`Group "${name}" was not created`);
    return result.group.id;
  }

  async function makeContactFor(
    owner: string,
    name: string,
    groupIds: number[],
  ) {
    const [contact] = await getDb()
      .insert(contacts)
      .values({ userId: owner, name })
      .returning({ id: contacts.id });
    if (groupIds.length > 0) {
      await getDb()
        .insert(contactGroups)
        .values(
          groupIds.map((groupId) => ({ contactId: contact.id, groupId })),
        );
    }
    return contact.id;
  }

  it("lists only the user's own groups", async () => {
    await makeGroupFor(userId, "Теннис");
    await makeGroupFor(otherId, "Аналитики");

    expect((await listGroups(userId)).map((group) => group.name)).toEqual([
      "Теннис",
    ]);
    expect((await listGroups(otherId)).map((group) => group.name)).toEqual([
      "Аналитики",
    ]);
    expect(await listGroups(await createTestUser("vera@example.com"))).toEqual(
      [],
    );
  });

  it("counts only the user's own contacts in a group", async () => {
    const mine = await makeGroupFor(userId, "Друзья");
    const theirs = await makeGroupFor(otherId, "Друзья");
    await makeContactFor(userId, "Анна", [mine]);
    await makeContactFor(otherId, "Вера", [theirs]);
    await makeContactFor(otherId, "Дмитрий", [theirs]);

    expect(await listGroupsWithCounts(userId)).toEqual([
      { id: mine, name: "Друзья", contactCount: 1 },
    ]);
    expect(await listGroupsWithCounts(otherId)).toEqual([
      { id: theirs, name: "Друзья", contactCount: 2 },
    ]);
  });

  it("allows the same name for two users", async () => {
    const mine = await createGroup(userId, "Теннис");
    const theirs = await createGroup(otherId, "теннис");

    expect(mine.ok).toBe(true);
    expect(theirs.ok).toBe(true);
  });

  it("still refuses a repeated name for one user, in any letter case", async () => {
    await makeGroupFor(userId, "Теннис");
    await makeGroupFor(otherId, "Аналитики");

    expect(await createGroup(userId, "ТЕННИС")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    // Another user's name doesn't count as taken
    expect((await createGroup(userId, "Аналитики")).ok).toBe(true);
  });

  it("refuses to rename into a name the user already has, not into another user's", async () => {
    const mine = await makeGroupFor(userId, "Друзья");
    await makeGroupFor(userId, "Теннис");
    await makeGroupFor(otherId, "Семья");

    expect(await renameGroup(userId, mine, "теннис")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(await renameGroup(userId, mine, "Семья")).toEqual({ ok: true });
  });

  it("does not rename another user's group", async () => {
    const theirs = await makeGroupFor(otherId, "Аналитики");

    expect(await renameGroup(userId, theirs, "Взломана")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect((await listGroups(otherId)).map((group) => group.name)).toEqual([
      "Аналитики",
    ]);
  });

  it("does not delete another user's group or its links", async () => {
    const theirs = await makeGroupFor(otherId, "Аналитики");
    const contact = await makeContactFor(otherId, "Вера", [theirs]);

    expect(await deleteGroup(userId, theirs)).toBeNull();

    expect((await listGroups(otherId)).map((group) => group.name)).toEqual([
      "Аналитики",
    ]);
    expect(await groupIdsOf(contact)).toEqual([theirs]);
  });
});
