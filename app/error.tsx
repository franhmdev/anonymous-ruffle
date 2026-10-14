"use client";

import { t } from "@/lib/i18n";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto max-w-md space-y-3 text-center">
      <p>{t.errors.generic}</p>
      <button type="button" className="btn-secondary" onClick={reset}>
        {t.offlinePage.retry}
      </button>
    </div>
  );
}
