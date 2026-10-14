"use client";

import type { ReactNode } from "react";
import { clearPrivateCaches } from "@/components/pwa/clear-private-caches";
import { SubmitButton } from "@/components/submit-button";

type Props = { action: () => Promise<void>; children: ReactNode; variant?: "secondary" | "danger" };

/** Clears cached private pages from this device before ending the session. */
export function LogoutForm({ action, children, variant = "secondary" }: Props) {
  return (
    <form
      action={async () => {
        await clearPrivateCaches().catch(() => {});
        await action();
      }}
    >
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </form>
  );
}
