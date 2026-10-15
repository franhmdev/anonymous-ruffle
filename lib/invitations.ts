import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, invitations, participants, users, type User } from "@/db/schema";
import { deriveInvitationToken, hashSecret } from "@/lib/crypto";
import { appUrl } from "@/lib/env";

export const INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PURPOSE = "invitation";

function linkFor(invitationId: string): string {
  return appUrl(`/invite/${deriveInvitationToken(invitationId)}`);
}

async function insertInvitation(groupId: string, participantId: string | null): Promise<string> {
  const id = randomUUID();
  await db.insert(invitations).values({
    id,
    groupId,
    participantId,
    tokenHash: hashSecret(deriveInvitationToken(id), PURPOSE),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  });
  return linkFor(id);
}

/** Creates a new group-wide link and invalidates the previous one. */
export async function regenerateGroupInvitation(groupId: string): Promise<string> {
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.groupId, groupId), isNull(invitations.participantId), isNull(invitations.revokedAt)));
  return insertInvitation(groupId, null);
}

export async function createPersonalInvitation(groupId: string, participantId: string): Promise<string> {
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.participantId, participantId), isNull(invitations.revokedAt)));
  return insertInvitation(groupId, participantId);
}

/** The current group-wide link, if one is still valid. */
export async function getActiveGroupInvitation(groupId: string): Promise<{ link: string; expiresAt: Date } | null> {
  const row = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.groupId, groupId),
      isNull(invitations.participantId),
      isNull(invitations.revokedAt),
      gt(invitations.expiresAt, sql`now()`),
    ),
    orderBy: desc(invitations.createdAt),
  });
  return row ? { link: linkFor(row.id), expiresAt: row.expiresAt } : null;
}

export type ResolvedInvitation =
  | {
      ok: true;
      invitationId: string;
      participantId: string | null;
      group: { id: string; name: string; budget: number | null; deliveryDate: string | null; adminId: string };
      adminName: string;
      invitedName: string | null;
    }
  | { ok: false; reason: "invalid" | "expired" };

export async function resolveInvitation(token: string): Promise<ResolvedInvitation> {
  if (!/^[\w-]{20,100}$/.test(token)) return { ok: false, reason: "invalid" };
  const [row] = await db
    .select({ invitation: invitations, group: groups, adminName: users.name })
    .from(invitations)
    .innerJoin(groups, eq(groups.id, invitations.groupId))
    .innerJoin(users, eq(users.id, groups.adminId))
    .where(eq(invitations.tokenHash, hashSecret(token, PURPOSE)))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  const { invitation, group } = row;
  if (invitation.revokedAt || invitation.expiresAt.getTime() < Date.now() || group.status !== "draft") {
    return { ok: false, reason: "expired" };
  }

  let invitedName: string | null = null;
  if (invitation.participantId) {
    const participant = await db.query.participants.findFirst({ where: eq(participants.id, invitation.participantId) });
    if (!participant || participant.status === "accepted") return { ok: false, reason: "expired" };
    invitedName = participant.name;
  }

  return {
    ok: true,
    invitationId: invitation.id,
    participantId: invitation.participantId,
    group: {
      id: group.id,
      name: group.name,
      budget: group.budget,
      deliveryDate: group.deliveryDate,
      adminId: group.adminId,
    },
    adminName: row.adminName,
    invitedName,
  };
}

/**
 * Group an invitation belongs to, even if the invitation has expired or was
 * revoked by the draw. Used to send existing members straight to their group.
 */
export async function findInvitationGroupId(token: string): Promise<string | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const row = await db.query.invitations.findFirst({
    where: eq(invitations.tokenHash, hashSecret(token, PURPOSE)),
    columns: { groupId: true },
  });
  return row?.groupId ?? null;
}

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

/** Same person name, ignoring case and accents. */
export const sameName = (a: string, b: string) => normalizeName(a) === normalizeName(b);

/** True if an accepted participant of the group already uses this name (ignoring case and accents). */
export async function groupHasMemberNamed(groupId: string, name: string): Promise<boolean> {
  const members = await db.query.participants.findMany({
    where: and(eq(participants.groupId, groupId), eq(participants.status, "accepted")),
    columns: { name: true },
  });
  const wanted = normalizeName(name);
  return members.some((member) => normalizeName(member.name) === wanted);
}

/**
 * Adds the user to the group as an accepted participant. Reuses the pending
 * record created by the admin when the invitation is personal or the email matches.
 */
export async function acceptInvitation(
  token: string,
  user: User,
): Promise<{ ok: true; groupId: string } | { ok: false; reason: "invalid" | "expired" }> {
  const resolved = await resolveInvitation(token);
  if (!resolved.ok) return resolved;
  const groupId = resolved.group.id;

  try {
    await db.transaction(async (tx) => {
      // Lock the group so a concurrent draw cannot run while someone joins.
      const [group] = await tx
        .select({ status: groups.status })
        .from(groups)
        .where(eq(groups.id, groupId))
        .for("update");
      if (group?.status !== "draft") throw new InvitationExpiredError();

      const existing = await tx.query.participants.findFirst({
        where: and(eq(participants.groupId, groupId), eq(participants.userId, user.id)),
      });

      const claimable = resolved.participantId
        ? await tx.query.participants.findFirst({ where: eq(participants.id, resolved.participantId) })
        : user.email
          ? await tx.query.participants.findFirst({
              where: and(
                eq(participants.groupId, groupId),
                eq(participants.email, user.email),
                isNull(participants.userId),
              ),
            })
          : undefined;

      if (existing) {
        await tx.update(participants).set({ status: "accepted" }).where(eq(participants.id, existing.id));
        if (claimable && claimable.id !== existing.id && !claimable.userId) {
          await tx.delete(participants).where(eq(participants.id, claimable.id));
        }
      } else if (claimable && !claimable.userId) {
        await tx
          .update(participants)
          .set({ userId: user.id, status: "accepted", email: user.email ?? claimable.email })
          .where(eq(participants.id, claimable.id));
      } else {
        await tx
          .insert(participants)
          .values({ groupId, userId: user.id, name: user.name, email: user.email, status: "accepted" });
      }

      if (resolved.participantId) {
        await tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, resolved.invitationId));
      }
    });
  } catch (error) {
    if (error instanceof InvitationExpiredError) return { ok: false, reason: "expired" };
    throw error;
  }
  return { ok: true, groupId };
}

class InvitationExpiredError extends Error {}
