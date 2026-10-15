"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/form-state";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  /** Clears the inputs after a successful submission. */
  resetOnSuccess?: boolean;
  onSuccess?: (state: FormState) => void;
};

export const ACTION_SUCCESS_EVENT = "action-success";

/** Form wired to a Server Action that shows its error or success message accessibly. */
export function ActionForm({ action, children, className, resetOnSuccess, onSuccess }: Props) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
      // Lets containers such as BottomSheet react (e.g. close) without coupling.
      formRef.current?.dispatchEvent(new CustomEvent(ACTION_SUCCESS_EVENT, { bubbles: true }));
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  return state.error ? (
    <p role="alert" className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-danger">
      {state.error}
    </p>
  ) : (
    <p role="status" className="mt-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-bold text-accent">
      {state.success}
    </p>
  );
}
