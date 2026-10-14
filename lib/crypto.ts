import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET is missing or too short");
  return value;
}

/** Long, URL-safe, unguessable token (256 bits). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Six-digit numeric code from a CSPRNG. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Keyed hash used to store tokens and codes. Only the hash is persisted, and
 * the key means a database leak alone is not enough to brute-force codes.
 */
export function hashSecret(value: string, purpose: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Invitation tokens are derived from the invitation id with a server-side key,
 * so the admin can share the same link again without storing it in plain text.
 * The database keeps only the hash; regenerating creates a new id and token.
 */
export function deriveInvitationToken(invitationId: string): string {
  return createHmac("sha256", secret()).update(`invitation-token:${invitationId}`).digest("base64url");
}
