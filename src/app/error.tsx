"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="grid justify-items-start gap-4">
      <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
      <p className="text-muted-foreground">
        Не получилось загрузить данные. Проверьте, что база данных запущена
        (команда <code>docker compose up -d</code>), и попробуйте ещё раз.
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
