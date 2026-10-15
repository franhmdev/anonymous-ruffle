import Link from "next/link";
import { CalendarIcon, CheckCircleIcon, ClockIcon, GiftIcon, LinkIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/dal";
import { format, formatShortDate, t } from "@/lib/i18n";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const groups = await listMyGroups(user.id);

  return (
    <PageShell tone="full" settings title={t.dashboard.title}>
      {!user.email && (
        <div className="card mb-4 border-2 border-warn-border bg-warn-soft text-warn">
          <p className="font-semibold">{t.dashboard.guestNotice}</p>
          <Link href="/account" className="mt-2 inline-block font-extrabold underline underline-offset-4">
            {t.dashboard.guestAction}
          </Link>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="card font-semibold text-muted">{t.dashboard.empty}</p>
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="card flex items-start justify-between gap-3 transition hover:-translate-y-0.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xl font-black">{group.name}</p>
                  <p className="mt-1 flex items-center gap-6 text-lg font-extrabold text-muted">
                    <span className="flex items-center gap-1.5">
                      <UsersIcon size={22} className="opacity-60" />
                      <span className="sr-only">
                        {format(t.dashboard.participantsCount, { count: group.participantCount })}
                      </span>
                      <span aria-hidden="true">{group.participantCount}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon size={20} className="opacity-60" />
                      {formatShortDate(group.deliveryDate)}
                    </span>
                  </p>
                </div>
                <span className="text-brand" title={group.status === "drawn" ? t.dashboard.drawn : t.dashboard.draft}>
                  {group.status === "drawn" ? (
                    <CheckCircleIcon size={30} />
                  ) : (
                    <ClockIcon size={30} className="text-muted" />
                  )}
                  <span className="sr-only">{group.status === "drawn" ? t.dashboard.drawn : t.dashboard.draft}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom action panel */}
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="rounded-[32px] bg-brand-soft/95 p-5 shadow-[0_-8px_30px_rgba(20,40,120,0.18)] backdrop-blur">
          <Link href="/join" className="mb-4 flex items-center justify-center gap-2 text-lg font-extrabold text-brand">
            <LinkIcon size={20} /> {t.dashboard.join}
          </Link>
          {user.email ? (
            <Link href="/groups/new" className="btn-primary w-full text-xl">
              <PlusIcon size={22} /> {t.dashboard.create}
            </Link>
          ) : (
            <Link href="/account" className="btn-primary w-full">
              {t.dashboard.guestAction}
            </Link>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Landing() {
  return (
    <PageShell tone="full">
      <div className="space-y-8 text-center text-white">
        <GiftIcon size={88} strokeWidth={1.5} className="mx-auto" />
        <h1 className="text-4xl font-black text-balance">{t.landing.title}</h1>
        <p className="mx-auto max-w-md text-lg font-semibold text-white/90 text-balance">{t.landing.subtitle}</p>
        <ul className="mx-auto grid max-w-md gap-3 text-left text-foreground">
          {t.landing.features.map((feature) => (
            <li key={feature} className="card flex items-center gap-3 py-4 font-bold">
              <CheckCircleIcon className="shrink-0 text-brand" />
              {feature}
            </li>
          ))}
        </ul>
        <Link href="/privacy" className="inline-block font-bold text-white/80 underline underline-offset-4">
          {t.nav.privacy}
        </Link>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="rounded-[32px] bg-brand-soft/95 p-5 shadow-[0_-8px_30px_rgba(20,40,120,0.18)] backdrop-blur">
          <Link href="/login" className="btn-primary w-full text-xl">
            {t.landing.cta}
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
