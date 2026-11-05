"use client";

import { useActionState, useId, useState } from "react";
import {
  requestLoginLinkAction,
  type LoginFormState,
} from "@/app/auth-actions";
import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE: LoginFormState = { status: "idle" };

export function LoginForm() {
  // Hidden pages stay in the DOM, so ids must be unique per form instance
  const id = useId();
  const errorId = `${id}-error`;
  // Controlled: the text stays after an error and after the link is sent, to
  // fix a typo or to ask again
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState(
    requestLoginLinkAction,
    INITIAL_STATE,
  );
  const error = state.status === "error" ? state.error : undefined;

  return (
    <div className="grid gap-5">
      {state.status === "sent" && (
        <StatusNotice>
          Ссылка для входа отправлена на {state.email}
        </StatusNotice>
      )}
      <form action={formAction} noValidate className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={id}>Почта</Label>
          <Input
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p id={errorId} className="text-14 text-coral-700">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Отправляю…" : "Получить ссылку"}
        </Button>
      </form>
    </div>
  );
}
