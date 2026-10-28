import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { EMPTY_CONTACT_VALUES } from "@/lib/contact-form";
import { createContactAction } from "@/app/actions";
import { listGroups } from "@/db/groups";

export const metadata: Metadata = {
  title: "Новый контакт — Личная CRM",
};

export default async function NewContactPage() {
  const groups = await listGroups();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 lg:gap-6">
      <Link
        href="/"
        className="flex min-h-11 w-fit items-center rounded-field text-14 font-semibold text-ink-muted transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent lg:text-15"
      >
        ← Все контакты
      </Link>
      <div className="flex items-center gap-4 lg:gap-5">
        {/* The "add" circle from the landing's final call to action */}
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-white lg:size-19"
        >
          <Plus strokeWidth={2.4} className="size-6.5 lg:size-7.5" />
        </span>
        <h1 className="text-h2 font-extrabold">Новый контакт</h1>
      </div>
      <Card>
        <CardContent>
          <ContactForm
            action={createContactAction}
            groups={groups}
            initialValues={EMPTY_CONTACT_VALUES}
            submitLabel="Добавить контакт"
            autoFocusName
            resetOnLeave
          />
        </CardContent>
      </Card>
    </div>
  );
}
