"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="grid max-w-160 justify-items-start gap-5">
      <h1 className="text-h2 font-extrabold">Что-то пошло не так</h1>
      <p className="text-17 leading-text text-ink-soft lg:text-18">
        Не получилось загрузить данные. Проверьте, что база данных запущена
        (команда <code>docker compose up -d</code>), и попробуйте ещё раз.
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
