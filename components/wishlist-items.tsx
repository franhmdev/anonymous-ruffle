import type { ReactNode } from "react";
import type { WishlistItem } from "@/db/schema";
import { t } from "@/lib/i18n";
import { safeUrlSchema } from "@/lib/validation";

/** Renders wishlist ideas. Links are re-validated on output and opened safely. */
export function WishlistItems({
  items,
  empty,
  renderActions,
}: {
  items: WishlistItem[];
  empty: string;
  renderActions?: (item: WishlistItem) => ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const url = item.url && safeUrlSchema.safeParse(item.url).success ? item.url : null;
        return (
          <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-background px-3 py-2">
            <div className="min-w-0">
              <p className="break-words">{item.text}</p>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  referrerPolicy="no-referrer"
                  className="btn-link break-all text-sm"
                >
                  {t.wishlist.openLink} ({new URL(url).hostname})
                </a>
              )}
            </div>
            {renderActions?.(item)}
          </li>
        );
      })}
    </ul>
  );
}
