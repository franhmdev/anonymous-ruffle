"use client";

import { useOnline } from "@/components/online-status";
import { t } from "@/lib/i18n";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-foreground px-4 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-center text-sm font-bold text-background"
    >
      {t.pwa.offline}
    </div>
  );
}
