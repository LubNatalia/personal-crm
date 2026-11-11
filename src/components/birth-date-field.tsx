import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { BIRTH_MONTHS } from "@/lib/birthdays";

const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));

type BirthDateFieldProps = {
  // Unique per form instance: hidden pages stay in the DOM
  id: string;
  day: string;
  month: string;
  year: string;
  error?: string;
};

// "Дата рождения": day and month lists and an optional year, in one row
// under one label, with one error for all three
export function BirthDateField({
  id,
  day,
  month,
  year,
  error,
}: BirthDateFieldProps) {
  const errorId = `${id}-error`;
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  return (
    <fieldset className="grid content-start gap-2">
      <legend className="mb-2 text-14 font-bold text-ink-muted">
        Дата рождения
      </legend>
      {/* Day and year are as narrow as "31" and "1990" allow: the rest goes
          to the month, so "сентября" fits on a 375 px phone */}
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_4.5rem] gap-2">
        <NativeSelect
          // A select doesn't pick up a new defaultValue, so after a save it
          // would be reset to the first one. Remount it with the new value
          key={`day-${day}`}
          name="birthDay"
          defaultValue={day}
          aria-label="День"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <NativeSelectOption value="">День</NativeSelectOption>
          {DAYS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          key={`month-${month}`}
          name="birthMonth"
          defaultValue={month}
          aria-label="Месяц"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <NativeSelectOption value="">Месяц</NativeSelectOption>
          {BIRTH_MONTHS.map((label, index) => (
            <NativeSelectOption key={label} value={String(index + 1)}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          name="birthYear"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          defaultValue={year}
          placeholder="Год"
          aria-label="Год"
          aria-invalid={invalid}
          aria-describedby={describedBy}
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
