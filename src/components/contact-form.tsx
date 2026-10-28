"use client";

import { Check } from "lucide-react";
import {
  useActionState,
  useId,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { ContactedTodayCheckbox } from "@/components/contacted-checkbox";
import { GroupsField } from "@/components/groups-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContactField,
  ContactFormState,
  ContactValues,
} from "@/lib/contact-form";
import { CONTACT_FREQUENCIES, FREQUENCY_INFO } from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";

type ContactFormAction = (
  state: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;

// When to get in touch, for a saved contact with a frequency. The texts
// follow the saved data, not the unsaved input
export type KeepInTouchStatus = {
  contactId: number;
  // "Последнее общение: 2 октября"
  lastContacted: string;
  // "Связаться до: 9 октября"
  due: string;
  // "пора сегодня" or "просрочено на 17 дней"; null while not yet due
  overdue: string | null;
  dueToday: boolean;
  contactedToday: boolean;
};

type ContactFormProps = {
  action: ContactFormAction;
  initialValues: ContactValues;
  // All groups, alphabetically
  groups: { id: number; name: string }[];
  submitLabel: string;
  autoFocusName?: boolean;
  // Start every visit with a fresh form (used for "new contact")
  resetOnLeave?: boolean;
  // Shown at the far end of the submit row, e.g. "delete contact"
  secondaryAction?: ReactNode;
  keepInTouch?: KeepInTouchStatus;
};

const NOTES_HINT = "Новая строка — новое общение: срок отсчитывается заново";

const INITIAL_STATE: ContactFormState = { status: "idle" };

export function ContactForm({ resetOnLeave, ...props }: ContactFormProps) {
  const [instance, setInstance] = useState(0);

  // Next.js keeps visited pages mounted but hidden (React Activity), so the
  // form would otherwise keep the previous input. Remount it when hidden.
  useLayoutEffect(() => {
    if (!resetOnLeave) return;
    return () => setInstance((n) => n + 1);
  }, [resetOnLeave]);

  return <ContactFormBody key={instance} {...props} />;
}

function ContactFormBody({
  action,
  initialValues,
  groups,
  submitLabel,
  autoFocusName,
  secondaryAction,
  keepInTouch,
}: Omit<ContactFormProps, "resetOnLeave">) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  // The result message is shown only right after a submit: it hides when
  // the user edits the form again or leaves the page
  const [showResult, setShowResult] = useState(false);
  useLayoutEffect(() => () => setShowResult(false), []);

  // Hidden pages stay in the DOM, so ids must be unique per form instance
  const idPrefix = useId();
  const fieldId = (field: ContactField) => `${idPrefix}-${field}`;

  // After a submit the form shows what was submitted, so input is never lost
  const values = state.values ?? initialValues;
  const errors = state.errors ?? {};
  const notesHintId = `${fieldId("notes")}-hint`;
  const notesErrorId = `${fieldId("notes")}-error`;
  const frequencyErrorId = `${fieldId("contactFrequency")}-error`;

  return (
    <form
      action={(formData) => {
        setShowResult(true);
        formAction(formData);
      }}
      onInput={() => setShowResult(false)}
      noValidate
      className="grid gap-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id={fieldId("name")}
          field="name"
          label="Имя"
          value={values.name}
          error={errors.name}
          required
          autoFocus={autoFocusName}
        />
        <TextField
          id={fieldId("about")}
          field="about"
          label="Кто это"
          placeholder="Например: коллега, сосед, врач"
          value={values.about}
          error={errors.about}
        />
        <TextField
          id={fieldId("howWeMet")}
          field="howWeMet"
          label="Откуда знакомы"
          placeholder="Например: учились вместе"
          value={values.howWeMet}
          error={errors.howWeMet}
        />
        <TextField
          id={fieldId("phone")}
          field="phone"
          label="Телефон"
          type="tel"
          placeholder="+7 900 000-00-00"
          value={values.phone}
          error={errors.phone}
        />
        <TextField
          id={fieldId("email")}
          field="email"
          label="Почта"
          type="email"
          placeholder="name@example.com"
          value={values.email}
          error={errors.email}
        />
        <div className="grid content-start gap-2">
          <Label htmlFor={fieldId("contactFrequency")}>Как часто общаться</Label>
          <NativeSelect
            // A select doesn't pick up a new defaultValue, so after a save it
            // would be reset to the first one. Remount it with the new value
            key={values.contactFrequency}
            id={fieldId("contactFrequency")}
            name="contactFrequency"
            defaultValue={values.contactFrequency}
            aria-invalid={errors.contactFrequency ? true : undefined}
            aria-describedby={
              errors.contactFrequency ? frequencyErrorId : undefined
            }
          >
            <NativeSelectOption value="">Не задано</NativeSelectOption>
            {CONTACT_FREQUENCIES.map((frequency) => (
              <NativeSelectOption key={frequency} value={frequency}>
                {FREQUENCY_INFO[frequency].optionLabel}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.contactFrequency && (
            <FieldError id={frequencyErrorId} message={errors.contactFrequency} />
          )}
          {keepInTouch && <KeepInTouchLines status={keepInTouch} />}
        </div>
      </div>

      <GroupsField
        groups={groups}
        // The ticks live in the field itself; this is only where they start
        initialCheckedIds={initialValues.groupIds}
        error={errors.groupIds}
      />

      <div className="grid gap-2">
        <Label htmlFor={fieldId("notes")}>Заметки</Label>
        <Textarea
          id={fieldId("notes")}
          name="notes"
          defaultValue={values.notes}
          placeholder="О чём говорили, о чём договорились"
          // Looks like the sticky note on the landing's contact card
          className="min-h-40 rounded-note bg-note px-4 py-3.5 lg:rounded-note-lg lg:px-4.5 lg:py-4"
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={
            [keepInTouch && notesHintId, errors.notes && notesErrorId]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {keepInTouch && (
          <p id={notesHintId} className="text-14 leading-text text-ink-muted">
            {NOTES_HINT}
          </p>
        )}
        {errors.notes && <FieldError id={notesErrorId} message={errors.notes} />}
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:gap-4">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Сохраняю…" : submitLabel}
        </Button>
        {!pending && showResult && state.status === "saved" && (
          <p
            role="status"
            className="flex items-center gap-2 text-15 font-semibold text-accent lg:text-16"
          >
            <Check aria-hidden="true" className="size-5 shrink-0" />
            Изменения сохранены
          </p>
        )}
        {!pending && showResult && state.status === "error" && (
          <p role="alert" className="text-15 font-semibold text-coral-700 lg:text-16">
            Не сохранено: исправьте поля, отмеченные красным
          </p>
        )}
        {secondaryAction && (
          <div className="w-full sm:ml-auto sm:w-auto">{secondaryAction}</div>
        )}
      </div>
    </form>
  );
}

type TextFieldProps = {
  id: string;
  field: ContactField;
  label: string;
  value: string;
  error?: string;
  type?: "text" | "tel" | "email";
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
};

function TextField({
  id,
  field,
  label,
  value,
  error,
  type = "text",
  placeholder,
  required,
  autoFocus,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-coral-700">*</span>}
      </Label>
      <Input
        id={id}
        name={field}
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

// Under the frequency field: the last contact, the due day and the tick
function KeepInTouchLines({ status }: { status: KeepInTouchStatus }) {
  return (
    <div className="grid gap-1">
      <p className="text-14 text-ink-muted">{status.lastContacted}</p>
      <p className="text-14 text-ink-muted">
        {status.due}
        {status.overdue && (
          <>
            {" · "}
            <span
              className={cn(
                "font-bold",
                status.dueToday ? "text-accent" : "text-coral-700",
              )}
            >
              {status.overdue}
            </span>
          </>
        )}
      </p>
      <div className="mt-1">
        <ContactedTodayCheckbox
          contactId={status.contactId}
          contactedToday={status.contactedToday}
        />
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="text-14 text-coral-700">
      {message}
    </p>
  );
}
