import {
  DueContactsList,
  type DueContactRow,
} from "@/components/due-contacts-list";
import type { listDueContacts } from "@/db/contacts";
import {
  FREQUENCY_INFO,
  formatLastContacted,
  formatOverdueBadge,
} from "@/lib/keep-in-touch";

type DueContactsProps = {
  contacts: Awaited<ReturnType<typeof listDueContacts>>;
};

// The "time to get in touch" block on the home page. Rendered even when
// empty: the list hides itself, but keeps the rows ticked on this page
export function DueContacts({ contacts }: DueContactsProps) {
  const rows: DueContactRow[] = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    frequency: FREQUENCY_INFO[contact.contactFrequency].rowLabel,
    overdueDays: contact.overdueDays,
    dueBadge: formatOverdueBadge(contact.overdueDays),
    lastContacted: formatLastContacted(contact.lastContactedDay, contact.today),
  }));
  // Shown in a ticked row. Without rows there is nothing to tick
  const today = contacts[0]?.today;
  return (
    <DueContactsList
      rows={rows}
      lastContactedToday={today ? formatLastContacted(today, today) : ""}
    />
  );
}
