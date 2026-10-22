import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid max-w-160 justify-items-start gap-5">
      <h1 className="text-h2 font-extrabold">Ничего не нашлось</h1>
      <p className="text-17 leading-text text-ink-soft lg:text-18">
        Такой страницы нет. Возможно, ссылка неверная.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        К списку контактов
      </Link>
    </div>
  );
}
