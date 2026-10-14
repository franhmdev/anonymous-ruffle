import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wishlistItems } from "@/db/schema";
import { WishlistItems } from "@/components/wishlist-items";
import { getMyReceiver, requireGroupMember } from "@/lib/dal";
import { formatBudget, formatDate, t } from "@/lib/i18n";
import { canViewOwnMatch, canViewWishlist } from "@/lib/permissions";

export const metadata: Metadata = { title: t.match.title, robots: { index: false } };

export default async function MatchPage({ params }: PageProps<"/groups/[id]/match">) {
  const { id } = await params;
  const { user, group, me } = await requireGroupMember(id);

  const receiver = me && canViewOwnMatch(group, user.id, me) ? await getMyReceiver(group.id, me.id) : null;

  if (!me || !receiver) {
    return (
      <div className="space-y-4">
        <BackLink groupId={group.id} />
        <p className="card">{t.match.notDrawn}</p>
      </div>
    );
  }

  const items = canViewWishlist(me.id, receiver.id, receiver.id)
    ? await db.query.wishlistItems.findMany({
        where: eq(wishlistItems.participantId, receiver.id),
        orderBy: wishlistItems.createdAt,
      })
    : [];

  return (
    <div className="space-y-6">
      <BackLink groupId={group.id} />
      <section className="card space-y-2 text-center">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.match.youGiveTo}</h1>
        <p className="text-4xl font-bold text-brand">{receiver.name}</p>
        <p className="text-sm text-muted">
          {formatBudget(group.budget)} · {formatDate(group.deliveryDate)}
        </p>
        <p className="text-sm">🤫 {t.match.secret}</p>
      </section>
      <section className="card space-y-3" aria-labelledby="wishlist-title">
        <h2 id="wishlist-title" className="text-lg font-bold">
          {t.match.theirWishlist}
        </h2>
        <WishlistItems items={items} empty={t.match.emptyWishlist} />
      </section>
    </div>
  );
}

function BackLink({ groupId }: { groupId: string }) {
  return (
    <Link href={`/groups/${groupId}`} className="btn-link text-sm">
      ← {t.common.back}
    </Link>
  );
}
