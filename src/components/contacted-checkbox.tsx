"use client";

import { Check } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import {
  markContactedAction,
  unmarkContactedAction,
  type ContactedMark,
} from "@/app/actions";
import { CONTACTED_TODAY_LABEL } from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";

// The round "contacted" tick: an empty accent ring or a filled circle with
// a white check mark. Only the look; the button around it handles clicks
export function ContactedCircle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-accent transition-colors",
        checked ? "bg-accent text-white" : "bg-white",
      )}
    >
      {checked && <Check strokeWidth={3} className="size-3.5" />}
    </span>
  );
}

type ContactedTodayCheckboxProps = {
  contactId: number;
  // Already in touch today: by a new note or by a tick before the page reload
  contactedToday: boolean;
};

// "Contacted today" in the contact card. The tick can be undone only on the
// same page: the undo data lives here, not in the database
export function ContactedTodayCheckbox({
  contactId,
  contactedToday,
}: ContactedTodayCheckboxProps) {
  const [mark, setMark] = useState<ContactedMark | null>(null);
  const [pending, startTransition] = useTransition();
  const [checked, setOptimisticChecked] = useOptimistic(contactedToday);
  const locked = contactedToday && mark === null;

  function toggle() {
    if (pending || locked) return;
    startTransition(async () => {
      if (mark) {
        setOptimisticChecked(false);
        await unmarkContactedAction(contactId, mark.markedAt, mark.previous);
        // Undone or not (marked again from elsewhere), the undo data is spent
        startTransition(() => setMark(null));
      } else {
        setOptimisticChecked(true);
        const newMark = await markContactedAction(contactId);
        startTransition(() => setMark(newMark));
      }
    });
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={locked || undefined}
      onClick={toggle}
      className={cn(
        "flex min-h-11 w-fit items-center gap-3 rounded-field text-15 font-bold text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent lg:text-16",
        locked ? "cursor-default" : "cursor-pointer",
      )}
    >
      <ContactedCircle checked={checked} />
      {CONTACTED_TODAY_LABEL}
    </button>
  );
}
