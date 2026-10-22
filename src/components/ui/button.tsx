import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Styled after the landing's "Открыть приложение" button
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-btn border border-transparent bg-clip-padding font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow-cta hover:bg-accent-hover",
        outline:
          "border-lavender-200 bg-white text-ink hover:border-accent hover:text-accent",
        ghost: "text-ink-muted hover:bg-lavender-50 hover:text-accent",
      },
      size: {
        default: "h-12 px-5 text-16",
        // The landing's call-to-action size
        lg: "h-14.5 px-8 text-17 lg:h-15 lg:px-10 lg:text-18",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
