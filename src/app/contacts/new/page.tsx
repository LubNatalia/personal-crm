import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { EMPTY_CONTACT_VALUES } from "@/lib/contact-form";
import { createContactAction } from "@/app/actions";

export const metadata: Metadata = {
  title: "Новый контакт — Личная CRM",
};

export default function NewContactPage() {
  return (
    <div className="grid max-w-3xl gap-5">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Все контакты
      </Link>
      <h1 className="text-2xl font-semibold">Новый контакт</h1>
      <Card>
        <CardContent>
          <ContactForm
            action={createContactAction}
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
