"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/form-state";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Content of the form; a function receives the latest server response. */
  children: ReactNode | ((state: FormState) => ReactNode);
  className?: string;
  /** Clears the inputs after a successful submission. */
  resetOnSuccess?: boolean;
  onSuccess?: (state: FormState) => void;
};

export const ACTION_SUCCESS_EVENT = "action-success";

/**
 * React 19 resets a form's fields after every action. When the server answers
 * with an error, put back what the user typed so they can fix it instead of
 * retyping (and so `required` fields are not left silently empty).
 */
function restoreValues(form: HTMLFormElement, data: FormData) {
  for (const element of Array.from(form.elements)) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      continue;
    }
    if (!element.name || ["hidden", "file", "submit", "button"].includes(element.type)) continue;
    const value = data.get(element.name);
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      element.checked = data.getAll(element.name).includes(element.value);
    } else if (typeof value === "string") {
      element.value = value;
    }
  }
}

/** Form wired to a Server Action that shows its error or success message accessibly. */
export function ActionForm({ action, children, className, resetOnSuccess, onSuccess }: Props) {
  const lastSubmission = useRef<FormData | null>(null);
  const [state, formAction] = useActionState(async (previous: FormState, formData: FormData) => {
    lastSubmission.current = formData;
    return action(previous, formData);
  }, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !state) return;
    if (state.error) {
      if (lastSubmission.current) restoreValues(form, lastSubmission.current);
      return;
    }
    if (resetOnSuccess) form.reset();
    onSuccess?.(state);
    // Lets containers such as BottomSheet react (e.g. close) without coupling.
    form.dispatchEvent(new CustomEvent(ACTION_SUCCESS_EVENT, { bubbles: true }));
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {typeof children === "function" ? children(state) : children}
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
