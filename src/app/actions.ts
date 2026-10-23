"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createContact, deleteContact, updateContact } from "@/db/contacts";
import { parseContactForm, type ContactFormState } from "@/lib/contact-form";

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
