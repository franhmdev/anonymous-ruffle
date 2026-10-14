import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <h1 className="text-2xl font-bold">{t.errors.notFoundTitle}</h1>
      <p>{t.errors.notFoundBody}</p>
      <Link href="/" className="btn-secondary">
        {t.nav.home}
      </Link>
    </div>
  );
}
