import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

// The frame of every page: the header with the logo and the page's place.
// `right` is the user's email and "Sign out" on the pages that need a login;
// the login pages have none and keep the logo centered on a phone
export function PageShell({
  right,
  children,
}: {
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header
        className={cn(
          "mx-auto flex h-16 w-full max-w-page items-center gap-3 px-gutter pt-5 lg:h-22 lg:px-gutter-lg lg:pt-6",
          right ? "justify-between" : "justify-center lg:justify-start",
        )}
      >
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center rounded-field focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent"
        >
          <Logo />
        </Link>
        {right}
      </header>
      <main className="mx-auto w-full max-w-page flex-1 px-gutter pt-6 pb-section lg:px-gutter-lg lg:pt-8 lg:pb-section-lg">
        {children}
      </main>
    </>
  );
}
