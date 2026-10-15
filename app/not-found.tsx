import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <PageShell title={t.errors.notFoundTitle}>
      <div className="card space-y-4 text-center">
        <p className="text-lg font-bold">{t.errors.notFoundBody}</p>
        <Link href="/" className="btn-secondary w-full">
          {t.nav.home}
        </Link>
      </div>
    </PageShell>
  );
}
