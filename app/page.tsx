import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/dal";
import { formatDate, t } from "@/lib/i18n";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const groups = await listMyGroups(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
        {user.email && (
          <Link href="/groups/new" className="btn-primary">
            {t.dashboard.create}
          </Link>
        )}
      </div>

      {!user.email && (
        <div className="card border-brand">
          <p className="text-sm">{t.dashboard.guestNotice}</p>
          <Link href="/account" className="btn-link mt-2 inline-block">
            {t.dashboard.guestAction}
          </Link>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="card text-muted">{t.dashboard.empty}</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.id}`} className="card block hover:border-brand">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold">{group.name}</span>
                  <span
                    className={`badge ${group.status === "drawn" ? "bg-accent/15 text-accent" : "bg-brand-soft text-brand"}`}
                  >
                    {group.status === "drawn" ? t.dashboard.drawn : t.dashboard.draft}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(group.deliveryDate)}
                  {group.adminId === user.id && ` · ${t.dashboard.admin}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Landing() {
  return (
    <div className="space-y-8 py-6 text-center">
      <div className="text-6xl" aria-hidden="true">
        🎁
      </div>
      <h1 className="text-3xl font-bold text-balance">{t.landing.title}</h1>
      <p className="mx-auto max-w-md text-lg text-muted text-balance">{t.landing.subtitle}</p>
      <Link href="/login" className="btn-primary px-8 text-lg">
        {t.landing.cta}
      </Link>
      <ul className="mx-auto grid max-w-md gap-2 text-left">
        {t.landing.features.map((feature) => (
          <li key={feature} className="card flex items-center gap-3 py-3">
            <span aria-hidden="true" className="text-accent">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
