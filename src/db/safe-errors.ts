import "server-only";
import { DrizzleQueryError } from "drizzle-orm/errors";

// A failed query carries the query and its parameters: Drizzle puts them into
// the message and the `params` field, and the database's own error under it
// may hold the whole row in `detail`. An uncaught error is printed to the
// server log as it is, so names, phones and notes would end up there.
// DatabaseError keeps only what says what broke and where.

// Fields of the database or connection error under DrizzleQueryError that
// never hold user data
type FailureInfo = {
  code?: unknown;
  constraint_name?: unknown;
  table_name?: unknown;
};

export class DatabaseError extends Error {
  readonly code: string | undefined;

  constructor(where: string | undefined, info: FailureInfo) {
    const code = typeof info.code === "string" ? info.code : undefined;
    const parts = [
      code && `code ${code}`,
      typeof info.constraint_name === "string" &&
        `constraint ${info.constraint_name}`,
      typeof info.table_name === "string" && `table ${info.table_name}`,
    ].filter(Boolean);
    super(
      `Database query failed${where ? ` in ${where}` : ""}` +
        (parts.length > 0 ? ` (${parts.join(", ")})` : ""),
    );
    this.name = "DatabaseError";
    this.code = code;
  }
}

// How deep to look for a failed query among the causes: libraries wrap it
// once or twice, never more
const MAX_CAUSE_DEPTH = 10;

function findQueryError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    if (current instanceof DrizzleQueryError) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

// A failed query anywhere in the chain becomes a DatabaseError (whatever the
// outer errors say is dropped too: they may repeat the query's text). Other
// errors, including Next.js redirects, are returned as they are
export function toSafeError(error: unknown, where?: string): unknown {
  if (error instanceof DatabaseError) {
    return error;
  }
  const queryError = findQueryError(error);
  if (!queryError) {
    return error;
  }
  return new DatabaseError(where, (queryError.cause ?? {}) as FailureInfo);
}

// Wraps a data function: a failed query leaves it as a DatabaseError named
// after the function
export function withSafeDbErrors<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  const wrapped = async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw toSafeError(error, fn.name);
    }
  };
  Object.defineProperty(wrapped, "name", { value: fn.name });
  return wrapped;
}
