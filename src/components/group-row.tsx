"use client";

import Link from "next/link";
import {
  useId,
  useLayoutEffect,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { renameGroupAction } from "@/app/actions";
import { DeleteGroupButton } from "@/components/delete-group-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatContactCount } from "@/lib/groups";

type GroupRowProps = {
  id: number;
  name: string;
  contactCount: number;
};

// One group on the groups page: its name and size, and the actions on it
export function GroupRow({ id, name, contactCount }: GroupRowProps) {
  const [renaming, setRenaming] = useState(false);

  // Next.js keeps visited pages mounted but hidden: close the rename field
  // on leaving, so it isn't still open on coming back
  useLayoutEffect(() => () => setRenaming(false), []);

  return (
    <li className="border-b border-lavender-line py-3 last:border-0 lg:py-3.5">
      {renaming ? (
        <RenameForm id={id} name={name} onDone={() => setRenaming(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="grid min-w-0 flex-[1_1_12rem] gap-0.5">
            <span className="text-16 font-semibold wrap-break-word lg:text-17">
              {name}
            </span>
            <span className="text-14 text-ink-muted">
              {formatContactCount(contactCount)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Link
              href={`/?group=${id}`}
              className={buttonVariants({ variant: "ghost" })}
            >
              Показать
              <span className="sr-only"> контакты группы «{name}»</span>
            </Link>
            <Button variant="ghost" onClick={() => setRenaming(true)}>
              Переименовать
              <span className="sr-only"> группу «{name}»</span>
            </Button>
            <DeleteGroupButton id={id} name={name} />
          </div>
        </div>
      )}
    </li>
  );
}

function RenameForm({
  id,
  name,
  onDone,
}: {
  id: number;
  name: string;
  onDone: () => void;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await renameGroupAction(id, value);
      if (result.ok) {
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!pending) save();
    } else if (event.key === "Escape" && !pending) {
      onDone();
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2.5">
        <Input
          id={fieldId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={`Новое название группы «${name}»`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus
          className="min-w-0 flex-[1_1_12rem] sm:max-w-md"
        />
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onDone}
        >
          Отмена
        </Button>
      </div>
      {error && (
        <p id={errorId} className="text-14 text-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}
