import Form from "next/form";
import Link from "next/link";
import { ScrollIntoViewRow } from "@/components/scroll-into-view-row";
import { Button, buttonVariants } from "@/components/ui/button";
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
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Контакты</h1>
        <Link href="/contacts/new" className={buttonVariants()}>
          Добавить контакт
        </Link>
      </div>

      {added && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          Контакт «{added.name}» добавлен. Он выделен в списке ниже.
        </p>
      )}

      <Form action="/" className="flex flex-wrap gap-2">
        <Input
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Поиск по имени"
          aria-label="Поиск по имени"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Найти
        </Button>
        {query && (
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            Сбросить
          </Link>
        )}
      </Form>

      <p className="text-sm text-muted-foreground">
        {query ? `Найдено: ${items.length} из ${total}` : `Всего: ${total}`}
      </p>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
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
                    isAdded ? "bg-emerald-50 dark:bg-emerald-950" : undefined
                  }
                >
                  <TableCell>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">
                    {contact.about}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {contact.email}
                  </TableCell>
                </Row>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
