import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// One page for a contact that is gone and for one that is someone else's: the
// page must not tell them apart
export default function ContactNotFound() {
  return (
    <div className="grid max-w-160 justify-items-start gap-5">
      <h1 className="text-h2 font-extrabold">Контакт не найден</h1>
      <p className="text-17 leading-text text-ink-soft lg:text-18">
        Возможно, его удалили, или ссылка неверная.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        К списку контактов
      </Link>
    </div>
  );
}
