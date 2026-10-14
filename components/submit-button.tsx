"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useOnline } from "@/components/online-status";
import { t } from "@/lib/i18n";

type Props = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  /** Critical operations are never queued: they are disabled while offline. */
  requiresOnline?: boolean;
  offlineMessage?: string;
  name?: string;
  value?: string;
};

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  requiresOnline = true,
  offlineMessage = t.errors.offline,
  name,
  value,
}: Props) {
  const { pending } = useFormStatus();
  const online = useOnline();
  const blocked = requiresOnline && !online;

  return (
    <>
      <button
        type="submit"
        name={name}
        value={value}
        disabled={pending || blocked}
        aria-busy={pending}
        className={`btn-${variant} ${className}`}
      >
        {pending ? t.common.loading : children}
      </button>
      {blocked && (
        <p role="status" className="hint">
          {offlineMessage}
        </p>
      )}
    </>
  );
}
