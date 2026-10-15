import "server-only";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import { assignments, exclusions, groups, invitations, participants, users } from "@/db/schema";
import { drawAssignments } from "@/lib/draw/algorithm";
import { sendEmails } from "@/lib/email/send";
import { drawInvalidatedEmail, drawResultEmail, scheduledDrawFailedEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { format, t } from "@/lib/i18n";
import { sendPushToUsers } from "@/lib/push";

export type DrawFailureReason = "not_found" | "already_drawn" | "not_due" | "not_enough_participants" | "impossible";

export type DrawOutcome = { ok: true } | { ok: false; reason: DrawFailureReason };

export function drawFailureMessage(reason: DrawFailureReason): string {
  return t.draw.errors[reason];
}

/**
 * Runs the draw on the server inside a transaction that locks the group row.
 * Idempotent: a group that is already drawn is never drawn again, and the
 * unique constraints on `assignments` back this up at the database level.
 */
export async function performDraw(groupId: string, mode: "manual" | "scheduled"): Promise<DrawOutcome> {
  const outcome = await db.transaction(async (tx): Promise<DrawOutcome> => {
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).for("update");
    if (!group) return { ok: false, reason: "not_found" };
    if (group.status === "drawn") return { ok: false, reason: "already_drawn" };
    if (mode === "scheduled" && (!group.scheduledDrawAt || group.scheduledDrawAt.getTime() > Date.now())) {
      return { ok: false, reason: "not_due" };
    }

    const members = await tx.query.participants.findMany({
      where: and(eq(participants.groupId, groupId), eq(participants.status, "accepted")),
      columns: { id: true },
    });
    const groupExclusions = await tx.query.exclusions.findMany({ where: eq(exclusions.groupId, groupId) });

    const result = drawAssignments(
      members.map((m) => m.id),
      groupExclusions.map((e) => [e.participantA, e.participantB] as const),
    );

    if (!result.ok) {
      const reason = result.reason === "impossible" ? "impossible" : "not_enough_participants";
      if (mode === "scheduled") {
        // Clear the schedule so the cron does not retry (and email) every run.
        await tx.update(groups).set({ scheduledDrawAt: null, lastDrawError: reason }).where(eq(groups.id, groupId));
      }
      return { ok: false, reason };
    }

    await tx
      .insert(assignments)
      .values([...result.assignments].map(([giverId, receiverId]) => ({ groupId, giverId, receiverId })));
    await tx
      .update(groups)
      .set({
        status: "drawn",
        drawnAt: new Date(),
        scheduledDrawAt: null,
        lastDrawError: null,
        surpriseRevealedAt: null,
      })
      .where(eq(groups.id, groupId));
    // Invitations expire when the draw happens.
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitations.groupId, groupId), isNull(invitations.revokedAt)));
    return { ok: true };
  });

  return outcome;
}

/** Deletes the assignments and moves the group back to draft. Returns true if a draw was invalidated. */
export async function invalidateDrawInTx(tx: Tx, groupId: string): Promise<boolean> {
  const [group] = await tx.select({ status: groups.status }).from(groups).where(eq(groups.id, groupId)).for("update");
  if (!group || group.status !== "drawn") return false;
  await tx.delete(assignments).where(eq(assignments.groupId, groupId));
  await tx
    .update(groups)
    .set({ status: "draft", drawnAt: null, surpriseRevealedAt: null })
    .where(eq(groups.id, groupId));
  return true;
}

/** Emails each participant their own match only, and sends a push without any assignment. */
export async function notifyDrawCompleted(groupId: string): Promise<void> {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group || group.status !== "drawn" || !group.drawnAt) return;

  const giver = alias(participants, "giver");
  const receiver = alias(participants, "receiver");
  const rows = await db
    .select({
      giverId: assignments.giverId,
      giverName: giver.name,
      giverEmail: giver.email,
      giverUserId: giver.userId,
      receiverName: receiver.name,
    })
    .from(assignments)
    .innerJoin(giver, eq(giver.id, assignments.giverId))
    .innerJoin(receiver, eq(receiver.id, assignments.receiverId))
    .where(eq(assignments.groupId, groupId));

  const link = appUrl(`/groups/${groupId}/match`);
  const drawStamp = group.drawnAt.getTime();
  const failed = await sendEmails(
    rows
      .filter((row) => row.giverEmail)
      .map((row) => ({
        to: row.giverEmail!,
        idempotencyKey: `draw-result/${groupId}/${drawStamp}/${row.giverId}`,
        ...drawResultEmail({
          name: row.giverName,
          groupName: group.name,
          receiverName: row.receiverName,
          budget: group.budget,
          deliveryDate: group.deliveryDate,
          link,
        }),
      })),
  );
  if (failed > 0) console.error("[draw] some result emails failed", { groupId, failed });

  await sendPushToUsers(
    rows.flatMap((row) => (row.giverUserId ? [row.giverUserId] : [])),
    {
      title: t.push.drawDone.title,
      body: format(t.push.drawDone.body, { group: group.name }),
      url: `/groups/${groupId}`,
      tag: `draw-${groupId}`,
    },
  );
}

export async function notifyDrawInvalidated(groupId: string): Promise<void> {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) return;
  const members = await db.query.participants.findMany({
    where: and(eq(participants.groupId, groupId), eq(participants.status, "accepted")),
  });
  const link = appUrl(`/groups/${groupId}`);
  await sendEmails(
    members
      .filter((m) => m.email)
      .map((m) => ({ to: m.email!, ...drawInvalidatedEmail({ groupName: group.name, link }) })),
  );
  await sendPushToUsers(
    members.flatMap((m) => (m.userId ? [m.userId] : [])),
    {
      title: t.push.drawInvalidated.title,
      body: format(t.push.drawInvalidated.body, { group: group.name }),
      url: `/groups/${groupId}`,
      tag: `draw-${groupId}`,
    },
  );
}

/** Called by the cron endpoint. Each group is processed under its own row lock. */
export async function runScheduledDraws(): Promise<{ drawn: number; failed: number }> {
  const due = await db.query.groups.findMany({
    where: and(eq(groups.status, "draft"), lte(groups.scheduledDrawAt, sql`now()`)),
    columns: { id: true },
    limit: 50,
  });

  let drawn = 0;
  let failed = 0;
  for (const { id } of due) {
    const outcome = await runScheduledDraw(id);
    if (outcome.ok) drawn++;
    else if (outcome.reason === "impossible" || outcome.reason === "not_enough_participants") failed++;
  }
  return { drawn, failed };
}

/**
 * Runs one group's scheduled draw if it is due and sends the notifications.
 * Used by the cron and when someone opens the group after the scheduled time
 * (the free hosting plan only runs the cron once a day). Idempotent.
 */
export async function runScheduledDraw(groupId: string): Promise<DrawOutcome> {
  const outcome = await performDraw(groupId, "scheduled");
  if (outcome.ok) {
    await notifyDrawCompleted(groupId);
  } else if (outcome.reason === "impossible" || outcome.reason === "not_enough_participants") {
    await notifyAdminScheduledDrawFailed(groupId, outcome.reason);
  }
  return outcome;
}

async function notifyAdminScheduledDrawFailed(groupId: string, reason: DrawFailureReason): Promise<void> {
  const [row] = await db
    .select({ groupName: groups.name, adminEmail: users.email })
    .from(groups)
    .innerJoin(users, eq(users.id, groups.adminId))
    .where(eq(groups.id, groupId));
  if (!row?.adminEmail) return;
  await sendEmails([
    {
      to: row.adminEmail,
      ...scheduledDrawFailedEmail({
        groupName: row.groupName,
        reason: drawFailureMessage(reason),
        link: appUrl(`/groups/${groupId}`),
      }),
    },
  ]);
}
