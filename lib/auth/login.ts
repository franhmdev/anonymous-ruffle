import "server-only";
import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginCodes, users } from "@/db/schema";
import { generateCode, generateToken, hashSecret, safeEqual } from "@/lib/crypto";
import { loginCodeEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { mergeGuestIntoUser } from "@/lib/auth/merge";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

const CODE_PURPOSE = "login-code";
const LINK_PURPOSE = "login-link";

export type RequestCodeResult = { ok: true } | { ok: false; error: "rate_limited" | "name_required" | "send_failed" };

/**
 * Sends a 6-digit code (and an equivalent magic link) to the email.
 * When `linkUserId` is set the code links that email to an existing guest account.
 */
export async function requestLoginCode(params: {
  email: string;
  name?: string;
  linkUserId?: string;
  ip: string;
  next?: string;
}): Promise<RequestCodeResult> {
  const { email, name, linkUserId, ip } = params;

  const [allowedEmail, allowedIp] = await Promise.all([
    rateLimit(`send-code:email:${email}`, LIMITS.sendCodePerEmail),
    rateLimit(`send-code:ip:${ip}`, LIMITS.sendCodePerIp),
  ]);
  if (!allowedEmail || !allowedIp) return { ok: false, error: "rate_limited" };

  let accountName = name;
  if (!linkUserId && !accountName) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (!existing) {
      // New user asking for another code: reuse the name from their previous request.
      const previous = await db.query.loginCodes.findFirst({
        where: and(
          eq(loginCodes.email, email),
          isNotNull(loginCodes.name),
          gt(loginCodes.createdAt, sql`now() - interval '1 day'`),
        ),
        orderBy: desc(loginCodes.createdAt),
        columns: { name: true },
      });
      accountName = previous?.name ?? undefined;
      if (!accountName) return { ok: false, error: "name_required" };
    }
  }

  const code = generateCode();
  const linkToken = generateToken();

  await db.transaction(async (tx) => {
    // Only the most recent code is valid.
    await tx
      .update(loginCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt)));
    await tx.insert(loginCodes).values({
      email,
      name: accountName ?? null,
      linkUserId: linkUserId ?? null,
      codeHash: hashSecret(`${email}:${code}`, CODE_PURPOSE),
      linkTokenHash: hashSecret(linkToken, LINK_PURPOSE),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  });

  const link = new URL(appUrl("/auth/verify"));
  link.searchParams.set("token", linkToken);
  if (params.next) link.searchParams.set("next", params.next);

  const sent = await sendEmail({ to: email, ...loginCodeEmail(code, link.toString()) });
  return sent ? { ok: true } : { ok: false, error: "send_failed" };
}

export type VerifyResult =
  { ok: true; userId: string } | { ok: false; error: "invalid" | "expired" | "too_many_attempts" | "rate_limited" };

export async function verifyLoginCode(params: { email: string; code: string; ip: string }): Promise<VerifyResult> {
  if (!(await rateLimit(`verify:ip:${params.ip}`, LIMITS.verifyPerIp))) return { ok: false, error: "rate_limited" };

  const row = await db.query.loginCodes.findFirst({
    where: and(eq(loginCodes.email, params.email), isNull(loginCodes.usedAt)),
    orderBy: desc(loginCodes.createdAt),
  });
  if (!row) return { ok: false, error: "invalid" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  if (!safeEqual(row.codeHash, hashSecret(`${params.email}:${params.code}`, CODE_PURPOSE))) {
    const [updated] = await db
      .update(loginCodes)
      .set({ attempts: sql`${loginCodes.attempts} + 1` })
      .where(eq(loginCodes.id, row.id))
      .returning({ attempts: loginCodes.attempts });
    return { ok: false, error: updated.attempts >= MAX_CODE_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }

  return consume(row.id);
}

export async function verifyMagicLink(params: { token: string; ip: string }): Promise<VerifyResult> {
  if (!(await rateLimit(`verify:ip:${params.ip}`, LIMITS.verifyPerIp))) return { ok: false, error: "rate_limited" };

  const row = await db.query.loginCodes.findFirst({
    where: and(eq(loginCodes.linkTokenHash, hashSecret(params.token, LINK_PURPOSE)), isNull(loginCodes.usedAt)),
  });
  if (!row) return { ok: false, error: "invalid" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };
  return consume(row.id);
}

/** Marks the code as used (atomically, so it works only once) and resolves the user. */
async function consume(codeId: string): Promise<VerifyResult> {
  const [code] = await db
    .update(loginCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(loginCodes.id, codeId), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, sql`now()`)))
    .returning();
  if (!code) return { ok: false, error: "invalid" };

  if (code.linkUserId) {
    return { ok: true, userId: await mergeGuestIntoUser(code.linkUserId, code.email) };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, code.email), columns: { id: true } });
  if (existing) return { ok: true, userId: existing.id };

  const [created] = await db
    .insert(users)
    .values({ email: code.email, name: code.name ?? code.email.split("@")[0] })
    .onConflictDoUpdate({ target: users.email, set: { email: code.email } })
    .returning({ id: users.id });
  return { ok: true, userId: created.id };
}
