import type { FieldErrors } from '../domain/types';

/** Outcome of a user action that writes data. `errors` maps invalid fields to message keys. */
export type ActionResult<T = Record<string, unknown>> =
  | { ok: true }
  | {
      ok: false;
      errors?: FieldErrors<T>;
      message: string;
      /** Set when a delete was refused because transactions reference the account. */
      blockingCount?: number;
    };
