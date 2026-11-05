import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";

// For addresses that match no page. Outside the page groups, so it brings
// its own frame
export default function NotFound() {
  return (
    <PageShell>
      <div className="grid max-w-160 justify-items-start gap-5">
        <h1 className="text-h2 font-extrabold">Ничего не нашлось</h1>
        <p className="text-17 leading-text text-ink-soft lg:text-18">
          Такой страницы нет. Возможно, ссылка неверная.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          К списку контактов
        </Link>
      </div>
    </PageShell>
  );
}
