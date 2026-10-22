import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// Same look as the phone/email fields and the search box on the landing
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-field border border-transparent bg-lavender-50 px-3.5 text-16 text-ink transition-colors outline-none placeholder:text-ink-muted hover:border-lavender-200 focus-visible:border-accent focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-coral-700 aria-invalid:bg-coral-50 aria-invalid:ring-coral-700/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
