"use client";

import { t } from "@/lib/i18n";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-16 max-w-md space-y-4 text-center">
      <p className="text-lg font-bold">{t.errors.generic}</p>
      <button type="button" className="btn-primary w-full" onClick={reset}>
        {t.offlinePage.retry}
      </button>
    </div>
  );
}
