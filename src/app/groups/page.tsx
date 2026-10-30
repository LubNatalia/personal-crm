import type { Metadata } from "next";
import Link from "next/link";
import { CreateGroupForm } from "@/components/create-group-form";
import { GroupRow } from "@/components/group-row";
import { StatusNotice } from "@/components/status-notice";
import { Card, CardContent } from "@/components/ui/card";
import { listGroupsWithCounts } from "@/db/groups";

export const metadata: Metadata = {
  title: "Группы — Личная CRM",
};

export default async function GroupsPage({
  searchParams,
}: PageProps<"/groups">) {
  const params = await searchParams;
  const deletedName =
    typeof params.deleted === "string" ? params.deleted : null;

  const groups = await listGroupsWithCounts();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 lg:gap-6">
      <Link
        href="/"
        className="flex min-h-11 w-fit items-center rounded-field text-14 font-semibold text-ink-muted transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent lg:text-15"
      >
        ← Все контакты
      </Link>
      <h1 className="text-h2 font-extrabold">Группы</h1>

      {deletedName && (
        <StatusNotice>Группа «{deletedName}» удалена.</StatusNotice>
      )}

      <Card>
        <CardContent className="grid gap-5 lg:gap-6">
          <CreateGroupForm />

          {groups.length === 0 ? (
            <p className="py-6 text-center text-16 leading-text text-ink-soft lg:text-17">
              Групп пока нет. Создайте первую — например, «Семья» или «Теннис».
            </p>
          ) : (
            <ul>
              {groups.map((group) => (
                <GroupRow
                  key={group.id}
                  id={group.id}
                  name={group.name}
                  contactCount={group.contactCount}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
