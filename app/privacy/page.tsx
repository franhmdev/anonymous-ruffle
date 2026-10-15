import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.privacy.title };

export default function PrivacyPage() {
  return (
    <PageShell back="/" title={t.privacy.title}>
      <article className="card space-y-5">
        {t.privacy.sections.map((section) => (
          <section key={section.heading} className="space-y-1">
            <h2 className="text-lg font-black">{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </PageShell>
  );
}
