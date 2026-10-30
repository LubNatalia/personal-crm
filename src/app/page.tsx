import { Plus, Search, Tags } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContactAvatar } from "@/components/contact-avatar";
import { DueContacts } from "@/components/due-contacts";
import { ScrollIntoViewRow } from "@/components/scroll-into-view-row";
import { StatusNotice } from "@/components/status-notice";
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
import { countContacts, listContacts, listDueContacts } from "@/db/contacts";
import { listGroups } from "@/db/groups";
import { formatEmptyListMessage, formatListSummary } from "@/lib/contact-list";
import { cn } from "@/lib/utils";

// Group ids are Postgres integers; anything else in the address is no group
const GROUP_PARAM_PATTERN = /^[1-9][0-9]{0,9}$/;
const MAX_GROUP_ID = 2147483647;

function parseGroupParam(value: string | string[] | undefined) {
  if (typeof value !== "string" || !GROUP_PARAM_PATTERN.test(value)) {
    return null;
  }
  const id = Number(value);
  return id <= MAX_GROUP_ID ? id : null;
}

// Address of the home page with the given search and group
function homeHref(query: string, groupId: number | null) {
  const params = new URLSearchParams();
  if (groupId !== null) params.set("group", String(groupId));
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const addedId =
    typeof params.added === "string" ? Number(params.added) : null;
  const deletedName =
    typeof params.deleted === "string" ? params.deleted : null;

  // A group that is not there (deleted, an old bookmark) means "all"
  const groups = await listGroups();
  const requestedGroupId = parseGroupParam(params.group);
  const group = groups.find((item) => item.id === requestedGroupId) ?? null;
  const groupId = group?.id ?? null;

  const [items, total, dueContacts] = await Promise.all([
    listContacts(query, groupId),
    countContacts(groupId),
    // The "time to get in touch" block is hidden while searching and while
    // a group is chosen
    query || group ? null : listDueContacts(),
  ]);
  const added = items.find((contact) => contact.id === addedId);
  const view = { query, groupName: group?.name ?? null };

  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Контакты</h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/groups"
            className={buttonVariants({
              variant: "outline",
              className: "w-full sm:w-auto",
            })}
          >
            <Tags aria-hidden="true" />
            Группы
          </Link>
          <Link
            href="/contacts/new"
            className={buttonVariants({ className: "w-full sm:w-auto" })}
          >
            <Plus aria-hidden="true" strokeWidth={2.4} />
            Добавить контакт
          </Link>
        </div>
      </div>

      {added && (
        <StatusNotice>
          Контакт «{added.name}» добавлен. Он выделен в списке ниже.
        </StatusNotice>
      )}
      {deletedName && (
        <StatusNotice>Контакт «{deletedName}» удалён.</StatusNotice>
      )}

      {dueContacts && <DueContacts contacts={dueContacts} />}

      <Card>
        <CardContent className="grid gap-4 lg:gap-5">
          {groups.length > 0 && (
            <nav aria-label="Фильтр по группе">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <FilterLink href={homeHref(query, null)} active={!group}>
                    Все
                  </FilterLink>
                </li>
                {groups.map((item) => (
                  <li key={item.id} className="min-w-0 max-w-full">
                    <FilterLink
                      href={homeHref(query, item.id)}
                      active={item.id === groupId}
                    >
                      {item.name}
                    </FilterLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <Form action="/" className="flex flex-wrap gap-2.5">
            {group && <input type="hidden" name="group" value={group.id} />}
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
              <Link
                href={homeHref("", groupId)}
                className={buttonVariants({ variant: "ghost" })}
              >
                Сбросить
              </Link>
            )}
          </Form>

          <p className="text-14 text-ink-muted lg:text-15">
            {formatListSummary({ ...view, shown: items.length, total })}
          </p>

          {items.length === 0 ? (
            <p className="py-6 text-center text-16 leading-text text-ink-soft lg:text-17">
              {formatEmptyListMessage(view)}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Кто это
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Телефон
                  </TableHead>
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
                        isAdded
                          ? "bg-lavender-100 hover:bg-lavender-100"
                          : undefined
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
                        <GroupLabels
                          names={groups
                            .filter((item) =>
                              contact.groupIds.includes(item.id),
                            )
                            .map((item) => item.name)}
                        />
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

// A button of the filter row. A link, not a button: the choice is in the address
function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 max-w-full items-center rounded-chip border px-4 text-15 font-semibold wrap-break-word transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? "border-accent bg-accent text-white"
          : "border-lavender-200 bg-white text-ink hover:border-accent hover:text-accent",
      )}
    >
      {children}
    </Link>
  );
}

// Labels of the contact's groups under the name. Not links: the name is
// already one, to the contact's page
function GroupLabels({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5 whitespace-normal">
      {names.map((name) => (
        <li
          key={name}
          className="rounded-chip bg-lavender-100 px-2.5 py-0.5 text-12 text-ink-muted wrap-break-word lg:text-13"
        >
          {name}
        </li>
      ))}
    </ul>
  );
}
