import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-field border border-transparent bg-lavender-50 px-3.5 py-3 text-16 leading-text text-ink transition-colors outline-none placeholder:text-ink-muted hover:border-lavender-200 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-coral-700 aria-invalid:bg-coral-50 aria-invalid:ring-coral-700/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
