import { Cake, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { listBirthdayContacts } from "@/db/contacts";
import {
  formatBirthdayBadge,
  formatBirthdayDate,
  formatTurningAge,
  upcomingBirthdays,
} from "@/lib/birthdays";
import { cn } from "@/lib/utils";

type BirthdayContactsProps = {
  contacts: Awaited<ReturnType<typeof listBirthdayContacts>>;
};

const TITLE = "Скоро день рождения";

// The "birthdays soon" block on the home page: birthdays today and in the
// next 7 days. Nothing at all when there are none
export function BirthdayContacts({ contacts }: BirthdayContactsProps) {
  // Every row carries the same "today" from the database
  const today = contacts[0]?.today;
  const rows = today ? upcomingBirthdays(contacts, today) : [];
  if (rows.length === 0) {
    return null;
  }

  return (
    // Named by aria-label, not by the heading's id: hidden copies of the
    // page stay in the DOM, and ids must not repeat
    <section aria-label={TITLE}>
      <Card>
        <CardContent className="grid gap-2 lg:gap-3">
          <h2 className="text-20 font-extrabold tracking-h3 lg:text-24">
            {TITLE}
          </h2>
          <ul>
            {rows.map((row) => {
              const isToday = row.daysUntil === 0;
              return (
                // The name link stretches over the whole row
                <li
                  key={row.id}
                  className="relative grid grid-cols-[minmax(0,1fr)_1.25rem] items-center gap-x-2 gap-y-1 py-2.5 not-last:border-b not-last:border-lavender-line lg:grid-cols-[minmax(0,1fr)_8rem_10rem_minmax(0,12rem)_1.25rem] lg:gap-x-3 lg:py-3"
                >
                  <Link
                    href={`/contacts/${row.id}`}
                    className="col-start-1 row-start-1 min-w-0 text-16 font-bold wrap-break-word text-ink transition-colors outline-none after:absolute after:inset-0 after:rounded-field hover:text-accent focus-visible:after:outline-3 focus-visible:after:outline-accent lg:text-17"
                  >
                    {row.name}
                  </Link>
                  <p className="col-start-1 row-start-2 text-14 text-ink-muted lg:col-start-2 lg:row-start-1 lg:text-15">
                    {formatBirthdayDate(row.day)}
                  </p>
                  <div className="col-start-1 row-start-3 lg:col-start-3 lg:row-start-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-chip px-3 py-1 text-13 font-bold lg:text-14",
                        isToday
                          ? "bg-accent text-white"
                          : "bg-lavender-100 text-accent",
                      )}
                    >
                      <Cake
                        aria-hidden="true"
                        strokeWidth={2.4}
                        className="size-3.5 shrink-0"
                      />
                      {formatBirthdayBadge(row.daysUntil)}
                    </span>
                  </div>
                  {row.age !== null && (
                    <p className="col-start-1 row-start-4 text-14 text-ink-muted lg:col-start-4 lg:row-start-1 lg:text-15">
                      {formatTurningAge(row.age, isToday)}
                    </p>
                  )}
                  <ChevronRight
                    aria-hidden="true"
                    className="col-start-2 row-start-1 size-5 text-ink-muted lg:col-start-5"
                  />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
