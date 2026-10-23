import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactAvatar } from "@/components/contact-avatar";
import { ContactForm } from "@/components/contact-form";
import { DeleteContactButton } from "@/components/delete-contact-button";
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
    <div className="mx-auto grid w-full max-w-3xl gap-5 lg:gap-6">
      <Link
        href="/"
        className="flex min-h-11 w-fit items-center rounded-field text-14 font-semibold text-ink-muted transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent lg:text-15"
      >
        ← Все контакты
      </Link>
      <div className="flex items-center gap-4 lg:gap-5">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="text-h2 font-extrabold wrap-break-word">{contact.name}</h1>
          <p className="text-14 text-ink-muted lg:text-15">
            Добавлен {dateFormat.format(contact.createdAt)} · изменён{" "}
            {dateFormat.format(contact.updatedAt)}
          </p>
        </div>
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
            secondaryAction={
              <DeleteContactButton id={contact.id} name={contact.name} />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
