import type { Metadata } from "next";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.privacy.title };

export default function PrivacyPage() {
  return (
    <article className="space-y-5">
      <h1 className="text-2xl font-bold">{t.privacy.title}</h1>
      {t.privacy.sections.map((section) => (
        <section key={section.heading} className="space-y-1">
          <h2 className="text-lg font-bold">{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </article>
  );
}
