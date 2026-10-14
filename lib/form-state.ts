/** Shape returned by Server Actions used with `useActionState`. */
export type FormState = {
  error?: string;
  success?: string;
  /** Free-form data for the client (e.g. a freshly generated link). */
  data?: Record<string, string>;
} | null;

export const ok = (success?: string, data?: Record<string, string>): FormState => ({ success, data });
export const fail = (error: string): FormState => ({ error });
