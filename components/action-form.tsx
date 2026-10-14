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

/** Form wired to a Server Action that shows its error or success message accessibly. */
export function ActionForm({ action, children, className, resetOnSuccess, onSuccess }: Props) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success !== undefined || state?.data) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
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
    <p role="alert" className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
      {state.error}
    </p>
  ) : (
    <p role="status" className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent">
      {state.success}
    </p>
  );
}
