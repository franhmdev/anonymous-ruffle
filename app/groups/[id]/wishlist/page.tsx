import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wishlistItems } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { WishlistItems } from "@/components/wishlist-items";
import { requireGroupMember } from "@/lib/dal";
import { t } from "@/lib/i18n";
import { addWishAction, removeWishAction } from "../actions";

export const metadata: Metadata = { title: t.wishlist.title };

export default async function WishlistPage({ params }: PageProps<"/groups/[id]/wishlist">) {
  const { id } = await params;
  const { group, me } = await requireGroupMember(id);

  const items = me
    ? await db.query.wishlistItems.findMany({
        where: eq(wishlistItems.participantId, me.id),
        orderBy: wishlistItems.createdAt,
      })
    : [];

  return (
    <div className="space-y-6">
      <Link href={`/groups/${group.id}`} className="btn-link text-sm">
        ← {group.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t.wishlist.title}</h1>
        <p className="mt-1 text-muted">{t.wishlist.intro}</p>
      </div>

      <section className="card">
        <WishlistItems
          items={items}
          empty={t.wishlist.empty}
          renderActions={(item) => (
            <ActionForm action={removeWishAction.bind(null, group.id, item.id)}>
              <SubmitButton variant="danger">{t.wishlist.remove}</SubmitButton>
            </ActionForm>
          )}
        />
      </section>

      {me?.status === "accepted" && (
        <ActionForm action={addWishAction.bind(null, group.id)} resetOnSuccess className="card space-y-3">
          <div>
            <label htmlFor="wish-text" className="label">
              {t.wishlist.text}
            </label>
            <input
              id="wish-text"
              name="text"
              required
              maxLength={200}
              placeholder={t.wishlist.textPlaceholder}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="wish-url" className="label">
              {t.wishlist.url} <span className="font-normal text-muted">({t.common.optional})</span>
            </label>
            <input id="wish-url" name="url" type="url" inputMode="url" placeholder="https://" className="input" />
          </div>
          <SubmitButton>{t.wishlist.add}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
