import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { generateToken, hashSecret } from "@/lib/crypto";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ai_session" : "ai_session";
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
// Sliding renewal: extend the session at most once a day to avoid a write per request.
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

const TOKEN_PURPOSE = "session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Creates a session and sets the cookie. Only callable from Server Actions and Route Handlers. */
export async function startSession(userId: string): Promise<void> {
  const token = generateToken();
  const device = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(sessions).values({
    userId,
    tokenHash: hashSecret(token, TOKEN_PURPOSE),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    device,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export type CurrentSession = { sessionId: string; user: User };

/** Resolves the session from the cookie. The server is the source of truth. */
export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashSecret(token, TOKEN_PURPOSE)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  if (!row) return null;

  if (Date.now() - row.session.lastUsedAt.getTime() > RENEW_AFTER_MS) {
    await db
      .update(sessions)
      .set({ lastUsedAt: new Date(), expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) })
      .where(eq(sessions.id, row.session.id));
  }
  return { sessionId: row.session.id, user: row.user };
});

export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  return user;
}

export async function endCurrentSession(): Promise<void> {
  const session = await getCurrentSession();
  if (session) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.sessionId));
  (await cookies()).delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Only allow same-site relative redirects after login. */
export function safeNextPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}
