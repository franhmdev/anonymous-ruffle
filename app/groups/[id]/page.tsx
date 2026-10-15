import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { participants, users, wishlistItems } from "@/db/schema";
import { AlertIcon, GiftIcon } from "@/components/icons";
import { LocalDateTime } from "@/components/local-date-time";
import { PageShell } from "@/components/page-shell";
import { InstallSuggestion } from "@/components/pwa/install-prompt";
import { requireGroupMember } from "@/lib/dal";
import { MIN_PARTICIPANTS } from "@/lib/draw/algorithm";
import { drawFailureMessage, runScheduledDrawIfDue, type DrawFailureReason } from "@/lib/draw/service";
import { format, formatBudget, formatShortDate, t } from "@/lib/i18n";
import { getActiveGroupInvitation } from "@/lib/invitations";
import { AdminPanel } from "./_sections/admin-panel";
import { GroupOptions } from "./_sections/group-options";
import { MemberList } from "./_sections/member-list";
import { MemberOptions } from "./_sections/member-options";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const ctx = await requireGroupMember(id);
  const { group, me, isAdmin } = ctx;

  // The cron only runs daily on the free plan: run a due scheduled draw on the
  // first visit after its time, then reload with the fresh state.
  if (await runScheduledDrawIfDue(group)) {
    redirect(`/groups/${group.id}`);
  }

  const isDrawn = group.status === "drawn";
  const participates = me?.status === "accepted";
  const [admin, wishCount, acceptedCount, invitation] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, group.adminId), columns: { name: true } }),
    me ? db.$count(wishlistItems, eq(wishlistItems.participantId, me.id)) : 0,
    db.$count(participants, and(eq(participants.groupId, group.id), eq(participants.status, "accepted"))),
    isAdmin && !isDrawn ? getActiveGroupInvitation(group.id) : null,
  ]);

  const status = isDrawn
    ? t.groups.statusDrawn
    : group.scheduledDrawAt
      ? t.groups.statusScheduled
      : acceptedCount < MIN_PARTICIPANTS
        ? t.groups.statusNeedsParticipants
        : t.groups.statusReady;

  const statusCard = (
    <section className="rounded-[32px] bg-brand-soft p-5 shadow-[0_10px_30px_rgba(40,60,140,0.18)]">
      {isDrawn && participates ? (
        // Never prefetched: results are only fetched on explicit navigation.
        <Link href={`/groups/${group.id}/match`} prefetch={false} className="btn-primary w-full text-xl">
          <GiftIcon size={22} /> {t.groups.myMatch}
        </Link>
      ) : (
        <div role="status" className="rounded-2xl bg-hero/20 px-4 py-4 text-center text-xl font-black text-muted">
          {status}
          {!isDrawn && group.scheduledDrawAt && (
            <p className="mt-1 text-sm font-bold">
              <LocalDateTime iso={group.scheduledDrawAt.toISOString()} />
            </p>
          )}
        </div>
      )}
      {participates && (
        <Link href={`/groups/${group.id}/wishlist`} className="btn-outline mt-4 w-full text-lg">
          <GiftIcon size={20} /> {format(t.groups.wishlistCount, { count: wishCount })}
        </Link>
      )}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <dt className="font-bold text-muted">{t.groups.budgetLabel}</dt>
          <dd className="font-black">{formatBudget(group.budget)}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">{t.groups.deliveryLabel}</dt>
          <dd className="font-black">{formatShortDate(group.deliveryDate)}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">{t.groups.adminLabel}</dt>
          <dd className="truncate font-black">{admin?.name}</dd>
        </div>
      </dl>
    </section>
  );

  return (
    <PageShell
      back="/"
      title={group.name}
      settings
      action={
        isAdmin ? (
          <GroupOptions group={group} inviteLink={invitation?.link ?? null} />
        ) : participates ? (
          <MemberOptions group={group} />
        ) : undefined
      }
      overlap={statusCard}
    >
      {isAdmin && group.lastDrawError && !isDrawn && (
        <p role="alert" className="card flex gap-2 bg-danger-soft font-bold text-danger">
          <AlertIcon className="shrink-0" />
          {format(t.draw.lastError, { reason: drawFailureMessage(group.lastDrawError as DrawFailureReason) })}
        </p>
      )}

      {/* Below the main actions so it never shifts them when it appears after hydration. */}
      {welcome === "1" && <InstallSuggestion />}

      {isAdmin ? <AdminPanel ctx={ctx} invitation={invitation} /> : <MemberList groupId={group.id} />}
    </PageShell>
  );
}
