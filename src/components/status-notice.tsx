import { Check } from "lucide-react";
import type { ReactNode } from "react";

// Confirms what has just happened: a contact or a group was added or deleted
export function StatusNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-3 rounded-tile bg-lavender-200 px-4.5 py-4 text-15 leading-text wrap-break-word lg:items-center lg:gap-3.5 lg:rounded-card lg:px-6 lg:py-4.5 lg:text-17"
    >
      <Check
        aria-hidden="true"
        className="mt-0.5 size-5.5 shrink-0 text-accent lg:mt-0 lg:size-6"
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
