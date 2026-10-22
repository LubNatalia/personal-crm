import { cn } from "@/lib/utils";

// Initials circle, as on the landing: small neutral one in the list,
// large coral one on the contact page
export function ContactAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm"
          ? "size-9 bg-lavender-avatar text-14 font-bold text-ink-muted lg:size-10 lg:text-15"
          : "size-16 bg-coral-100 text-22 font-extrabold text-coral-700 lg:size-19 lg:text-26",
      )}
    >
      {getInitials(name)}
    </span>
  );
}

// "Анна Петрова" -> "АП", "Олег" -> "О"
function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
