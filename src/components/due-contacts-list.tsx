"use client";

import { Check, ChevronDown, ChevronRight, ChevronUp, Clock } from "lucide-react";
import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";
import {
  markContactedAction,
  unmarkContactedAction,
  type ContactedMark,
} from "@/app/actions";
import { ContactedCircle } from "@/components/contacted-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONTACTED_TODAY_LABEL } from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";

export type DueContactRow = {
  id: number;
  name: string;
  // "раз в неделю"
  frequency: string;
  // 0: due today, above 0: overdue
  overdueDays: number;
  // "Пора сегодня" or "Просрочено на 17 дней"
  dueBadge: string;
  // "Последнее общение: 2 октября"
  lastContacted: string;
};

// A row ticked on this page. It keeps its place in the block until the page
// is reloaded, ticked or not
type TickedRow = {
  row: DueContactRow;
  checked: boolean;
  // What's needed to undo the tick; null while it's being saved, or when it
  // can't be undone
  mark: ContactedMark | null;
  // "Последнее общение: 26 октября", shown while ticked
  lastContactedToday: string;
};
type TickedRows = ReadonlyMap<number, TickedRow>;

const VISIBLE_ROWS = 5;

const nameCollator = new Intl.Collator("ru-RU");

// The block's order: the most overdue first, then by name
function compareRows(a: DueContactRow, b: DueContactRow) {
  return (
    b.overdueDays - a.overdueDays ||
    nameCollator.compare(a.name, b.name) ||
    a.id - b.id
  );
}

// Page data may refresh before a reload (a server action re-renders the
// current page) and no longer include the ticked rows, so they are put back
// in their place
function withTickedRows(rows: DueContactRow[], ticked: TickedRows) {
  const result = [...rows];
  for (const { row } of ticked.values()) {
    if (result.some((other) => other.id === row.id)) continue;
    const index = result.findIndex((other) => compareRows(row, other) < 0);
    result.splice(index === -1 ? result.length : index, 0, row);
  }
  return result;
}

function withEntry(ticked: TickedRows, entry: TickedRow) {
  return new Map(ticked).set(entry.row.id, entry);
}

type DueContactsListProps = {
  rows: DueContactRow[];
  // "Последнее общение: 26 октября"
  lastContactedToday: string;
};

export function DueContactsList({
  rows,
  lastContactedToday,
}: DueContactsListProps) {
  const [ticked, setTicked] = useState<TickedRows>(() => new Map());
  // Shows the change right away, before the server confirms it
  const [shownTicked, showEntry] = useOptimistic(ticked, withEntry);
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const listId = useId();

  const allRows = withTickedRows(rows, shownTicked);
  if (allRows.length === 0) {
    return null;
  }
  const dueCount = allRows.filter(
    (row) => !shownTicked.get(row.id)?.checked,
  ).length;
  const visibleRows = expanded ? allRows : allRows.slice(0, VISIBLE_ROWS);

  // Runs inside the row's transition
  async function toggle(row: DueContactRow) {
    const entry = ticked.get(row.id);
    if (entry?.checked) {
      if (!entry.mark) return;
      showEntry({ ...entry, checked: false });
      const undone = await unmarkContactedAction(
        row.id,
        entry.mark.markedAt,
        entry.mark.previous,
      );
      // Not undone: marked again from elsewhere, the tick stays for good
      setTicked((current) =>
        withEntry(current, { ...entry, checked: !undone, mark: null }),
      );
    } else {
      const base = {
        row,
        mark: null,
        lastContactedToday: entry?.lastContactedToday || lastContactedToday,
      };
      showEntry({ ...base, checked: true });
      const mark = await markContactedAction(row.id);
      // No mark: the contact lost its frequency or is gone
      setTicked((current) =>
        withEntry(current, { ...base, checked: mark !== null, mark }),
      );
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardContent className="grid gap-2 lg:gap-3">
          <h2
            id={headingId}
            className="text-20 font-extrabold tracking-h3 lg:text-24"
          >
            Пора связаться ({dueCount})
          </h2>
          <ul id={listId}>
            {visibleRows.map((row) => (
              <DueContactItem
                key={row.id}
                row={row}
                ticked={shownTicked.get(row.id)}
                onToggle={toggle}
              />
            ))}
          </ul>
          {allRows.length > VISIBLE_ROWS && (
            <div className="border-t border-lavender-line pt-4">
              <Button
                variant="outline"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setExpanded((value) => !value)}
                className="w-full text-accent sm:w-auto"
              >
                {expanded ? "Свернуть" : "Показать всех"}
                {expanded ? (
                  <ChevronUp aria-hidden="true" />
                ) : (
                  <ChevronDown aria-hidden="true" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

type DueContactItemProps = {
  row: DueContactRow;
  ticked: TickedRow | undefined;
  onToggle: (row: DueContactRow) => Promise<void>;
};

function DueContactItem({ row, ticked, onToggle }: DueContactItemProps) {
  const [pending, startTransition] = useTransition();
  const isMarked = ticked?.checked ?? false;
  const locked = isMarked && ticked?.mark === null && !pending;
  const faded = isMarked && "opacity-50";

  return (
    // The name link stretches over the whole row; the tick sits above it
    <li className="relative grid grid-cols-[2.75rem_minmax(0,1fr)_1.25rem] items-center gap-x-2 gap-y-1 py-2.5 not-last:border-b not-last:border-lavender-line lg:grid-cols-[2.75rem_minmax(0,1fr)_8rem_13.5rem_minmax(0,15rem)_1.25rem] lg:gap-x-3 lg:py-1.5 xl:grid-cols-[2.75rem_minmax(0,1fr)_10rem_15rem_17rem_1.25rem]">
      <button
        type="button"
        role="checkbox"
        aria-checked={isMarked}
        aria-disabled={locked || pending || undefined}
        aria-label={`Связались: ${row.name}`}
        onClick={() => {
          if (pending || locked) return;
          startTransition(() => onToggle(row));
        }}
        className={cn(
          "relative z-10 col-start-1 row-start-1 flex size-11 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-accent",
          locked ? "cursor-default" : "cursor-pointer",
        )}
      >
        <ContactedCircle checked={isMarked} />
      </button>
      <Link
        href={`/contacts/${row.id}`}
        className={cn(
          "col-start-2 row-start-1 min-w-0 text-16 font-bold wrap-break-word text-ink transition-colors outline-none after:absolute after:inset-0 after:rounded-field hover:text-accent focus-visible:after:outline-3 focus-visible:after:outline-accent lg:text-17",
          faded,
        )}
      >
        {row.name}
      </Link>
      <p
        className={cn(
          "col-start-2 row-start-2 text-14 text-ink-muted lg:col-start-5 lg:row-start-1 lg:text-15",
          faded,
        )}
      >
        {isMarked && ticked ? ticked.lastContactedToday : row.lastContacted}
      </p>
      <p
        className={cn(
          "col-start-2 row-start-3 text-14 text-ink-muted lg:col-start-3 lg:row-start-1 lg:text-15",
          faded,
        )}
      >
        {row.frequency}
      </p>
      <div className="col-start-2 row-start-4 lg:col-start-4 lg:row-start-1">
        <DueBadge row={row} isMarked={isMarked} />
      </div>
      <ChevronRight
        aria-hidden="true"
        className={cn(
          "col-start-3 row-start-1 size-5 text-ink-muted lg:col-start-6",
          faded,
        )}
      />
    </li>
  );
}

function DueBadge({ row, isMarked }: { row: DueContactRow; isMarked: boolean }) {
  const Icon = isMarked ? Check : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-3 py-1 text-13 font-bold lg:text-14",
        isMarked || row.overdueDays === 0
          ? "bg-lavender-100 text-accent"
          : "bg-coral-50 text-coral-700",
      )}
    >
      <Icon aria-hidden="true" strokeWidth={2.4} className="size-3.5 shrink-0" />
      {isMarked ? CONTACTED_TODAY_LABEL : row.dueBadge}
    </span>
  );
}
