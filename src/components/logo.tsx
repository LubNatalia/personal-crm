// Brand from the landing: person icon + "Личная CRM"
export function Logo() {
  return (
    <span className="flex items-center gap-2 lg:gap-2.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5.5 shrink-0 text-accent lg:size-6.5"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
      <span className="text-16 font-extrabold lg:text-18">Личная CRM</span>
    </span>
  );
}
