"use client";

import { locale } from "@/lib/i18n";

/** Renders a UTC instant in the viewer's own time zone. */
export function LocalDateTime({ iso }: { iso: string }) {
  const text = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
