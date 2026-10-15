import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wishlistItems } from "@/db/schema";
import { GiftIcon } from "@/components/icons";
import { PageShell } from "@/components/page-shell";
import { WishlistItems } from "@/components/wishlist-items";
import { getMyReceiver, requireGroupMember } from "@/lib/dal";
import { formatBudget, formatDate, t } from "@/lib/i18n";
import { canViewOwnMatch, canViewWishlist } from "@/lib/permissions";

export const metadata: Metadata = { title: t.match.title, robots: { index: false } };

export default async function MatchPage({ params }: PageProps<"/groups/[id]/match">) {
  const { id } = await params;
  const { user, group, me } = await requireGroupMember(id);
  const back = `/groups/${group.id}`;

  const receiver = me && canViewOwnMatch(group, user.id, me) ? await getMyReceiver(group.id, me.id) : null;

  if (!me || !receiver) {
    return (
      <PageShell back={back} title={t.match.title}>
        <p className="card font-semibold">{t.match.notDrawn}</p>
      </PageShell>
    );
  }

  const items = canViewWishlist(me.id, receiver.id, receiver.id)
    ? await db.query.wishlistItems.findMany({
        where: eq(wishlistItems.participantId, receiver.id),
        orderBy: wishlistItems.createdAt,
      })
    : [];

  return (
    <PageShell
      back={back}
      title={group.name}
      overlap={
        <section className="rounded-[32px] bg-surface p-6 text-center shadow-[0_10px_30px_rgba(40,60,140,0.18)]">
          <GiftIcon size={40} className="mx-auto text-primary" />
          <h2 className="mt-2 text-sm font-extrabold uppercase tracking-wide text-muted">{t.match.youGiveTo}</h2>
          <p className="mt-1 text-4xl font-black text-primary">{receiver.name}</p>
          <p className="mt-2 font-bold text-muted">
            {formatBudget(group.budget)} · {formatDate(group.deliveryDate)}
          </p>
          <p className="mt-3 rounded-2xl bg-warn-soft px-4 py-2 font-bold text-warn">🤫 {t.match.secret}</p>
        </section>
      }
    >
      <section className="card space-y-3" aria-labelledby="wishlist-title">
        <h2 id="wishlist-title" className="text-xl font-black">
          {t.match.theirWishlist}
        </h2>
        <WishlistItems items={items} empty={t.match.emptyWishlist} />
      </section>
    </PageShell>
  );
}
