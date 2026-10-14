import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush, { WebPushError } from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { env } from "@/lib/env";

/** Payloads must never contain assignments: lock screens are visible to others. */
export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

function configure(): boolean {
  if (!isPushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0 || !configure()) return;
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: inArray(pushSubscriptions.userId, userIds),
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: "normal" },
        );
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          // The browser dropped the subscription.
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          return;
        }
        console.warn("[push] send failed", {
          statusCode: error instanceof WebPushError ? error.statusCode : undefined,
        });
      }
    }),
  );
}
