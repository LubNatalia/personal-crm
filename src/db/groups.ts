import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { contactGroups, groups } from "./schema";

const UNIQUE_VIOLATION = "23505";
const NAME_INDEX = "groups_user_id_name_lower_idx";

// True when Postgres refused the name because the same user already has a
// group with the same name (in any letter case). Drizzle wraps the driver error in `cause`
function isDuplicateNameError(error: unknown) {
  const cause = (error as { cause?: unknown } | null)?.cause ?? error;
  const { code, constraint_name } = (cause ?? {}) as {
    code?: string;
    constraint_name?: string;
  };
  return code === UNIQUE_VIOLATION && constraint_name === NAME_INDEX;
}

// Alphabetical, ICU Russian collation: correct order including "Ё"
const byName = [sql`${groups.name} collate "ru-x-icu"`, asc(groups.id)];

// Every function takes the user's id first and touches only that user's
// groups: another user's group id behaves like one that doesn't exist
export async function listGroups(userId: string) {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.userId, userId))
    .orderBy(...byName);
}

// Same list plus how many contacts each group holds (zero for an empty one)
export async function listGroupsWithCounts(userId: string) {
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contactGroups.contactId),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .where(eq(groups.userId, userId))
    .groupBy(groups.id)
    .orderBy(...byName);
}

export type CreateGroupResult =
  | { ok: true; group: { id: number; name: string } }
  | { ok: false; reason: "duplicate" };

// The name is expected to be checked already (parseGroupName). Uniqueness is
// left to the database: between a check and an insert another tab could
// have added the same name
export async function createGroup(
  userId: string,
  name: string,
): Promise<CreateGroupResult> {
  try {
    const [group] = await getDb()
      .insert(groups)
      .values({ userId, name })
      .returning({ id: groups.id, name: groups.name });
    return { ok: true, group };
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}

export type RenameGroupResult =
  { ok: true } | { ok: false; reason: "duplicate" | "not_found" };

// Renaming "теннис" to "Теннис" passes: the unique index compares the name
// with other groups, not with the same row
export async function renameGroup(
  userId: string,
  id: number,
  name: string,
): Promise<RenameGroupResult> {
  try {
    const [row] = await getDb()
      .update(groups)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(groups.id, id), eq(groups.userId, userId)))
      .returning({ id: groups.id });
    return row ? { ok: true } : { ok: false, reason: "not_found" };
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}

// Returns the deleted group's name, or null if it was already gone. The
// contacts stay: only their links to the group are removed (on delete cascade)
export async function deleteGroup(userId: string, id: number) {
  const [row] = await getDb()
    .delete(groups)
    .where(and(eq(groups.id, id), eq(groups.userId, userId)))
    .returning({ name: groups.name });
  return row?.name ?? null;
}
