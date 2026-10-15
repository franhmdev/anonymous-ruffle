"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { t } from "@/lib/i18n";

type Props = {
  children: ReactNode;
  /** Warning shown before the action is confirmed. */
  warning: string;
  variant?: "primary" | "secondary" | "danger" | "blue";
  offlineMessage?: string;
  fullWidth?: boolean;
};

/**
 * Two-step submit button for destructive actions. Sends `confirm=yes`, which
 * the server also checks, so the warning cannot be skipped.
 */
export function ConfirmSubmit({ children, warning, variant = "danger", offlineMessage, fullWidth }: Props) {
  const [asking, setAsking] = useState(false);
  const { pending } = useFormStatus();
  const [wasPending, setWasPending] = useState(false);

  // Collapse the confirmation once the server has answered, so the action can be retried.
  if (pending !== wasPending) {
    setWasPending(pending);
    if (!pending) setAsking(false);
  }

  if (!asking) {
    return (
      <button
        type="button"
        className={`btn-${variant} ${fullWidth ? "w-full text-lg" : ""}`}
        onClick={() => setAsking(true)}
      >
        {children}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={warning} className="rounded-2xl border-2 border-danger/30 bg-danger-soft p-4">
      <p className="mb-3 font-bold text-danger">{warning}</p>
      <input type="hidden" name="confirm" value="yes" />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant={variant === "danger" ? "danger" : "primary"} offlineMessage={offlineMessage}>
          {t.common.confirm}
        </SubmitButton>
        <button type="button" className="btn-outline" onClick={() => setAsking(false)}>
          {t.common.cancel}
        </button>
      </div>
    </div>
  );
}
