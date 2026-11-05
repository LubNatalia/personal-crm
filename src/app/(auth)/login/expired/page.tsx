import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Ссылка устарела — Личная CRM",
};

// Shown for a link that was used, replaced by a newer one, out of date or
// made up: Better Auth sends every failed check here
export default function ExpiredLoginLinkPage() {
  return (
    <div className="mx-auto grid w-full max-w-md justify-items-start gap-5">
      <h1 className="text-h2 font-extrabold">
        Ссылка устарела, запросите новую
      </h1>
      <Link href="/login" className={buttonVariants()}>
        Войти снова
      </Link>
    </div>
  );
}
