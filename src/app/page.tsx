import { Check, Plus, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { ContactAvatar } from "@/components/contact-avatar";
import { ScrollIntoViewRow } from "@/components/scroll-into-view-row";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countContacts, listContacts } from "@/db/contacts";

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const addedId = typeof params.added === "string" ? Number(params.added) : null;

  const [items, total] = await Promise.all([
    listContacts(query),
    countContacts(),
  ]);
  const added = items.find((contact) => contact.id === addedId);

  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Контакты</h1>
        <Link
          href="/contacts/new"
          className={buttonVariants({ className: "w-full sm:w-auto" })}
        >
          <Plus aria-hidden="true" strokeWidth={2.4} />
          Добавить контакт
        </Link>
      </div>

      {added && (
        <p
          role="status"
          className="flex items-start gap-3 rounded-tile bg-lavender-200 px-4.5 py-4 text-15 leading-text lg:items-center lg:gap-3.5 lg:rounded-card lg:px-6 lg:py-4.5 lg:text-17"
        >
          <Check
            aria-hidden="true"
            className="mt-0.5 size-5.5 shrink-0 text-accent lg:mt-0 lg:size-6"
          />
          Контакт «{added.name}» добавлен. Он выделен в списке ниже.
        </p>
      )}

      <Card>
        <CardContent className="grid gap-4 lg:gap-5">
          <Form action="/" className="flex flex-wrap gap-2.5">
            <div className="relative min-w-0 flex-[1_1_12rem] sm:max-w-md">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-ink-muted"
              />
              <Input
                key={query}
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Поиск по имени"
                aria-label="Поиск по имени"
                className="pl-10.5"
              />
            </div>
            <Button type="submit" variant="outline">
              Найти
            </Button>
            {query && (
              <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                Сбросить
              </Link>
            )}
          </Form>

          <p className="text-14 text-ink-muted lg:text-15">
            {query ? `Найдено: ${items.length} из ${total}` : `Всего: ${total}`}
          </p>

          {items.length === 0 ? (
            <p className="py-6 text-center text-16 leading-text text-ink-soft lg:text-17">
              {query
                ? `Никого не нашли по запросу «${query}».`
                : "Контактов пока нет. Добавьте первый."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead className="hidden md:table-cell">Кто это</TableHead>
                  <TableHead className="hidden sm:table-cell">Телефон</TableHead>
                  <TableHead className="hidden lg:table-cell">Почта</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((contact) => {
                  const isAdded = contact.id === addedId;
                  const Row = isAdded ? ScrollIntoViewRow : TableRow;
                  return (
                    <Row
                      key={contact.id}
                      className={
                        isAdded ? "bg-lavender-100 hover:bg-lavender-100" : undefined
                      }
                    >
                      <TableCell>
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="flex w-fit items-center gap-3 rounded-field font-semibold transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent lg:gap-3.5"
                        >
                          <ContactAvatar name={contact.name} />
                          {contact.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-64 truncate text-ink-muted md:table-cell">
                        {contact.about}
                      </TableCell>
                      <TableCell className="hidden text-ink-soft sm:table-cell">
                        {contact.phone}
                      </TableCell>
                      <TableCell className="hidden text-ink-soft lg:table-cell">
                        {contact.email}
                      </TableCell>
                    </Row>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
