"use client";

import { useOnline } from "@/components/online-status";
import { t } from "@/lib/i18n";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="bg-foreground px-4 py-2 text-center text-sm font-medium text-background">
      {t.pwa.offline}
    </div>
  );
}
