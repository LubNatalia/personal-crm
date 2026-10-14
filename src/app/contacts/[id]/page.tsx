import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { getContact } from "@/db/contacts";
import { updateContactAction } from "@/app/actions";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function ContactPage({
  params,
}: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const contactId = Number(id);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    notFound();
  }

  const contact = await getContact(contactId);
  if (!contact) {
    notFound();
  }

  return (
    <div className="grid max-w-3xl gap-5">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Все контакты
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{contact.name}</h1>
        <p className="text-sm text-muted-foreground">
          Добавлен {dateFormat.format(contact.createdAt)} · изменён{" "}
          {dateFormat.format(contact.updatedAt)}
        </p>
      </div>
      <Card>
        <CardContent>
          <ContactForm
            action={updateContactAction.bind(null, contact.id)}
            initialValues={{
              name: contact.name,
              about: contact.about ?? "",
              howWeMet: contact.howWeMet ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
              notes: contact.notes ?? "",
            }}
            submitLabel="Сохранить"
          />
        </CardContent>
      </Card>
    </div>
  );
}
