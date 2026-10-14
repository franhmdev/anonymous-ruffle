import { safeEqual } from "@/lib/crypto";
import { runScheduledDraws } from "@/lib/draw/service";
import { env } from "@/lib/env";

export const maxDuration = 60;

/**
 * Called by the hosting cron (e.g. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * Safe to call repeatedly or late: each draw runs under a row lock and only once.
 */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqual(provided, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runScheduledDraws();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
