"use client";

import { Check, Plus } from "lucide-react";
import {
  useId,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { createGroupAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type GroupsFieldProps = {
  // All groups, alphabetically
  groups: { id: number; name: string }[];
  // Ids ticked when the form is first shown, as they came from the form
  initialCheckedIds: string[];
  error?: string;
};

// The "Groups" field of the contact form: a label per group, a tap ticks or
// unticks it. Ticked groups go out with the form as `groupIds`.
// The ticks are kept in state, so they survive the form being reset after
// a submit and a group made here is ticked at once
export function GroupsField({
  groups,
  initialCheckedIds,
  error,
}: GroupsFieldProps) {
  const [checked, setChecked] = useState(
    () => new Set(initialCheckedIds.map(Number)),
  );
  const errorId = `${useId()}-error`;

  function toggle(id: number) {
    setChecked((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <fieldset
      className="grid min-w-0 gap-3"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-2 text-14 font-bold text-ink-muted">Группы</legend>
      <div className="flex flex-wrap items-center gap-2">
        {groups.length === 0 && (
          <p className="text-15 text-ink-muted">Групп пока нет</p>
        )}
        {groups.map((group) => {
          const isChecked = checked.has(group.id);
          return (
            <label key={group.id} className="cursor-pointer">
              <input
                type="checkbox"
                name="groupIds"
                value={group.id}
                checked={isChecked}
                onChange={() => toggle(group.id)}
                // The form is reset after a submit, and a reset puts every
                // checkbox back to its default. Keep the default in step with
                // the tick, or ticked groups would look unticked after a save
                ref={(input) => {
                  if (input) input.defaultChecked = isChecked;
                }}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-11 max-w-full items-center gap-1.5 rounded-chip border px-4 text-15 font-semibold transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                  isChecked
                    ? "border-accent bg-accent text-white"
                    : "border-lavender-200 bg-white text-ink hover:border-accent hover:text-accent",
                )}
              >
                {isChecked && (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                )}
                <span className="min-w-0 wrap-break-word">{group.name}</span>
              </span>
            </label>
          );
        })}
        <NewGroup
          onCreated={(id) =>
            setChecked((previous) => new Set(previous).add(id))
          }
        />
      </div>
      {error && (
        <p id={errorId} className="text-14 text-coral-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// "New group" inside the field. Not a nested form (HTML forbids it): the
// input has no name, so it doesn't go out with the contact, and Enter in it
// creates the group instead of saving the contact
function NewGroup({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  function close() {
    setOpen(false);
    setName("");
    setError(undefined);
  }

  function create() {
    startTransition(async () => {
      const result = await createGroupAction(name);
      if (result.ok) {
        onCreated(result.group.id);
        close();
      } else {
        setError(result.error);
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!pending) create();
    } else if (event.key === "Escape") {
      // Closes the field, not anything around it
      event.preventDefault();
      if (!pending) close();
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-chip px-4 text-15"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" className="size-4" />
        Новая группа
      </Button>
    );
  }

  return (
    <div className="grid w-full gap-2">
      <div className="flex flex-wrap gap-2.5">
        <Input
          id={fieldId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Название новой группы"
          aria-label="Название новой группы"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus
          className="min-w-0 flex-[1_1_12rem] sm:max-w-md"
        />
        <Button type="button" disabled={pending} onClick={create}>
          {pending ? "Создаю…" : "Создать"}
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
