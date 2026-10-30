"use client";

import { useActionState, useId, useState } from "react";
import { createGroupAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateGroupState = { error?: string };

export function CreateGroupForm() {
  // Hidden pages stay in the DOM, so ids must be unique per form instance
  const id = useId();
  const errorId = `${id}-error`;
  // Controlled: the text stays after an error and is cleared after a success
  const [name, setName] = useState("");
  const [state, formAction, pending] = useActionState(
    async (): Promise<CreateGroupState> => {
      const result = await createGroupAction(name);
      if (result.ok) {
        setName("");
        return {};
      }
      return { error: result.error };
    },
    {},
  );

  return (
    <form action={formAction} noValidate className="grid gap-2">
      <Label htmlFor={id}>Название группы</Label>
      <div className="flex flex-wrap gap-2.5">
        <Input
          id={id}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Например: Теннис"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          className="min-w-0 flex-[1_1_12rem] sm:max-w-md"
        />
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Создаю…" : "Создать группу"}
        </Button>
      </div>
      {state.error && (
        <p id={errorId} className="text-14 text-coral-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
