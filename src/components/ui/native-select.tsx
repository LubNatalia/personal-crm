import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Native select: the system list on phones. Same look as Input
function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "group/native-select relative w-full has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="h-12 w-full min-w-0 cursor-pointer appearance-none rounded-field border border-transparent bg-lavender-50 pr-11 pl-3.5 text-16 text-ink transition-colors outline-none hover:border-lavender-200 focus-visible:border-accent focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-coral-700 aria-invalid:bg-coral-50 aria-invalid:ring-coral-700/20"
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink-muted select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
