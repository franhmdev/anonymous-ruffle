import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export const LIMITS = {
  sendCodePerEmail: { limit: 5, windowSeconds: 60 * 60 },
  sendCodePerIp: { limit: 20, windowSeconds: 60 * 60 },
  verifyPerIp: { limit: 30, windowSeconds: 15 * 60 },
  invitationsPerUser: { limit: 30, windowSeconds: 60 * 60 },
  joinPerIp: { limit: 30, windowSeconds: 60 * 60 },
} as const;

/**
 * Fixed-window counter stored in PostgreSQL so every serverless instance shares it.
 * Returns true when the request is allowed.
 */
export async function rateLimit(key: string, { limit, windowSeconds }: { limit: number; windowSeconds: number }) {
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + make_interval(secs => ${windowSeconds})` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then now() + make_interval(secs => ${windowSeconds}) else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row.count <= limit;
}
