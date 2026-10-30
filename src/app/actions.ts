"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContact,
  deleteContact,
  markContacted,
  unmarkContacted,
  updateContact,
} from "@/db/contacts";
import { createGroup, deleteGroup, renameGroup } from "@/db/groups";
import { parseContactForm, type ContactFormState } from "@/lib/contact-form";
import { parseGroupName } from "@/lib/groups";
import { isValidContactedMark } from "@/lib/keep-in-touch";

export async function createContactAction(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = parseContactForm(formData);
  if (!parsed.ok) {
    return { status: "error", values: parsed.values, errors: parsed.errors };
  }

  const id = await createContact(parsed.data);
  revalidatePath("/");
  // Group counters are on this page
  revalidatePath("/groups");
  // Back to the list, where the new contact is highlighted
  redirect(`/?added=${id}`);
}

export async function updateContactAction(
  id: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid contact id: ${id}`);
  }

  const parsed = parseContactForm(formData);
  if (!parsed.ok) {
    return { status: "error", values: parsed.values, errors: parsed.errors };
  }

  const updated = await updateContact(id, parsed.data);
  if (!updated) {
    throw new Error(`Contact ${id} not found`);
  }

  revalidatePath("/");
  revalidatePath("/groups");
  revalidatePath(`/contacts/${id}`);
  return { status: "saved", values: parsed.values };
}

export async function deleteContactAction(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid contact id: ${id}`);
  }

  const name = await deleteContact(id);
  revalidatePath("/");
  revalidatePath("/groups");
  revalidatePath(`/contacts/${id}`);
  // Already deleted (e.g. in another tab): the goal is reached, just go back
  if (name === null) {
    redirect("/");
  }
  // Back to the list, which confirms the deletion by name
  redirect(`/?deleted=${encodeURIComponent(name)}`);
}

export type ContactedMark = { previous: string | null; markedAt: string };

// The "contacted today" tick. Returns what's needed to undo it, or null if
// there was nothing to mark (the contact has no frequency or is gone)
export async function markContactedAction(
  id: number,
): Promise<ContactedMark | null> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid contact id: ${id}`);
  }

  const mark = await markContacted(id);
  // Only the contact page: the block on the home page shows ticks itself
  revalidatePath(`/contacts/${id}`);
  return mark;
}

// Undoes the tick; returns false if the contact was marked again since
export async function unmarkContactedAction(
  id: number,
  markedAt: string,
  previous: string | null,
) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid contact id: ${id}`);
  }
  // The undo data comes from the browser, so it's checked
  if (!isValidContactedMark(markedAt, previous)) {
    throw new Error(`Invalid undo data: ${markedAt}, ${previous}`);
  }

  const undone = await unmarkContacted(id, markedAt, previous);
  revalidatePath(`/contacts/${id}`);
  return undone;
}

const GROUP_ALREADY_EXISTS = "Такая группа уже есть";

export type GroupActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

// Groups show up on the home page, in every contact form and on the groups
// page, so a change to a group refreshes everything under the root layout
function revalidateGroupPages() {
  revalidatePath("/", "layout");
}

function assertGroupId(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid group id: ${id}`);
  }
}

// Used by the groups page and by the "new group" field of the contact form
export async function createGroupAction(
  name: string,
): Promise<GroupActionResult<{ group: { id: number; name: string } }>> {
  const parsed = parseGroupName(name);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const result = await createGroup(parsed.name);
  if (!result.ok) {
    return { ok: false, error: GROUP_ALREADY_EXISTS };
  }

  revalidateGroupPages();
  return { ok: true, group: result.group };
}

export async function renameGroupAction(
  id: number,
  name: string,
): Promise<GroupActionResult> {
  assertGroupId(id);
  const parsed = parseGroupName(name);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const result = await renameGroup(id, parsed.name);
  revalidateGroupPages();
  if (result.ok) {
    return { ok: true };
  }
  if (result.reason === "duplicate") {
    return { ok: false, error: GROUP_ALREADY_EXISTS };
  }
  // Deleted in another tab: the list is already right, no error to show
  redirect("/groups");
}

export async function deleteGroupAction(id: number) {
  assertGroupId(id);

  const name = await deleteGroup(id);
  revalidateGroupPages();
  // Already deleted (e.g. in another tab): the goal is reached, just show the list
  if (name === null) {
    redirect("/groups");
  }
  // The groups page confirms the deletion by name
  redirect(`/groups?deleted=${encodeURIComponent(name)}`);
}
