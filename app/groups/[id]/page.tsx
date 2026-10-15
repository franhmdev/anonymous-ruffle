import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { LocalDateTime } from "@/components/local-date-time";
import { InstallSuggestion } from "@/components/pwa/install-prompt";
import { requireGroupMember } from "@/lib/dal";
import { drawFailureMessage, runScheduledDraw, type DrawFailureReason } from "@/lib/draw/service";
import { format, formatBudget, formatDate, t } from "@/lib/i18n";
import { AdminPanel } from "./_sections/admin-panel";
import { MemberList } from "./_sections/member-list";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const ctx = await requireGroupMember(id);
  const { group, me, isAdmin } = ctx;

  // The cron only runs daily on the free plan: run a due scheduled draw on the
  // first visit after its time, then reload with the fresh state.
  if (group.status === "draft" && group.scheduledDrawAt && group.scheduledDrawAt.getTime() <= Date.now()) {
    await runScheduledDraw(group.id);
    redirect(`/groups/${group.id}`);
  }
  const admin = await db.query.users.findFirst({ where: eq(users.id, group.adminId), columns: { name: true } });
  const isDrawn = group.status === "drawn";
  const participates = me?.status === "accepted";

  return (
    <div className="space-y-6">
      <Link href="/" className="btn-link text-sm">
        ← {t.nav.home}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <span className={`badge ${isDrawn ? "bg-accent/15 text-accent" : "bg-brand-soft text-brand"}`}>
            {isDrawn ? t.groups.statusDrawn : t.groups.statusDraft}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">{t.groups.budgetLabel}</dt>
            <dd className="font-semibold">{formatBudget(group.budget)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.groups.deliveryLabel}</dt>
            <dd className="font-semibold">{formatDate(group.deliveryDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.groups.adminLabel}</dt>
            <dd className="font-semibold">{admin?.name}</dd>
          </div>
        </dl>
      </header>

      {participates && (
        <section className="card space-y-3" aria-label={t.match.title}>
          {isDrawn ? (
            // Never prefetched: results are only fetched on explicit navigation.
            <Link href={`/groups/${group.id}/match`} prefetch={false} className="btn-primary w-full">
              🎁 {t.groups.myMatch}
            </Link>
          ) : (
            <p>
              {group.scheduledDrawAt ? (
                <>
                  {t.groups.scheduledFor} <LocalDateTime iso={group.scheduledDrawAt.toISOString()} />
                </>
              ) : (
                t.groups.waitingDraw
              )}
            </p>
          )}
          <Link href={`/groups/${group.id}/wishlist`} className="btn-secondary w-full">
            {t.groups.myWishlist}
          </Link>
        </section>
      )}

      {/* Below the main actions so it never shifts them when it appears after hydration. */}
      {welcome === "1" && <InstallSuggestion />}

      {isAdmin && group.lastDrawError && !isDrawn && (
        <p role="alert" className="card border-brand text-sm text-brand">
          {format(t.draw.lastError, { reason: drawFailureMessage(group.lastDrawError as DrawFailureReason) })}
        </p>
      )}

      {isAdmin ? <AdminPanel ctx={ctx} /> : <MemberList groupId={group.id} />}
    </div>
  );
}
