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
import { parseContactForm, type ContactFormState } from "@/lib/contact-form";
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
  revalidatePath(`/contacts/${id}`);
  return { status: "saved", values: parsed.values };
}

export async function deleteContactAction(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid contact id: ${id}`);
  }

  const name = await deleteContact(id);
  revalidatePath("/");
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
