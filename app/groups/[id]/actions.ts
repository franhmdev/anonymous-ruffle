"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { exclusions, groups, participants, wishlistItems } from "@/db/schema";
import { requireGroupAdmin, requireGroupMember, type GroupContext } from "@/lib/dal";
import {
  drawFailureMessage,
  invalidateDrawInTx,
  notifyDrawCompleted,
  notifyDrawInvalidated,
  performDraw,
} from "@/lib/draw/service";
import { sendEmail } from "@/lib/email/send";
import { invitationEmail } from "@/lib/email/templates";
import { fail, ok, type FormState } from "@/lib/form-state";
import { format, t } from "@/lib/i18n";
import { createPersonalInvitation, regenerateGroupInvitation } from "@/lib/invitations";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import {
  addParticipantSchema,
  firstError,
  scheduleDrawSchema,
  updateGroupSchema,
  wishlistItemSchema,
} from "@/lib/validation";

const MAX_WISHLIST_ITEMS = 30;

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const confirmed = (formData: FormData) => formData.get("confirm") === "yes";
const refresh = (groupId: string) => revalidatePath(`/groups/${groupId}`, "layout");

/**
 * Changing who takes part after the draw invalidates it. The caller must have
 * shown a warning (checked through `confirm=yes`); everybody is notified.
 */
async function invalidateIfDrawn(ctx: GroupContext, formData: FormData): Promise<FormState | "invalidated" | null> {
  if (ctx.group.status !== "drawn") return null;
  if (!confirmed(formData)) return fail(t.errors.confirmRequired);
  const invalidated = await db.transaction((tx) => invalidateDrawInTx(tx, ctx.group.id));
  return invalidated ? "invalidated" : null;
}

export async function updateGroupAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  const parsed = updateGroupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  await db.update(groups).set(parsed.data).where(eq(groups.id, groupId));
  refresh(groupId);
  return ok(t.groups.settingsSaved);
}

export async function regenerateInvitationAction(groupId: string, _state: FormState): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  if (ctx.group.status === "drawn") return fail(t.invite.afterDraw);
  if (!(await rateLimit(`invite:user:${ctx.user.id}`, LIMITS.invitationsPerUser))) return fail(t.errors.rateLimited);
  await regenerateGroupInvitation(groupId);
  refresh(groupId);
  return ok();
}

export async function addParticipantAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  const parsed = addParticipantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  if (!(await rateLimit(`invite:user:${ctx.user.id}`, LIMITS.invitationsPerUser))) return fail(t.errors.rateLimited);

  const duplicate = await db.query.participants.findFirst({
    where: and(eq(participants.groupId, groupId), eq(participants.email, parsed.data.email)),
    columns: { id: true },
  });
  if (duplicate) return fail(t.participants.alreadyInGroup);

  const invalidation = await invalidateIfDrawn(ctx, formData);
  if (invalidation && invalidation !== "invalidated") return invalidation;

  const [participant] = await db
    .insert(participants)
    .values({ groupId, name: parsed.data.name, email: parsed.data.email, status: "pending" })
    .returning({ id: participants.id });

  const link = await createPersonalInvitation(groupId, participant.id);
  const sent = await sendEmail({
    to: parsed.data.email,
    ...invitationEmail({ groupName: ctx.group.name, adminName: ctx.user.name, link }),
  });
  if (invalidation === "invalidated") after(() => notifyDrawInvalidated(groupId));
  refresh(groupId);
  return sent ? ok(format(t.participants.added, { email: parsed.data.email })) : fail(t.auth.errors.send_failed);
}

export async function resendInvitationAction(
  groupId: string,
  participantId: string,
  _state: FormState,
): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  if (ctx.group.status === "drawn") return fail(t.invite.afterDraw);
  if (!(await rateLimit(`invite:user:${ctx.user.id}`, LIMITS.invitationsPerUser))) return fail(t.errors.rateLimited);

  const participant = await db.query.participants.findFirst({
    where: and(
      eq(participants.id, participantId),
      eq(participants.groupId, groupId),
      eq(participants.status, "pending"),
    ),
  });
  if (!participant?.email) return fail(t.errors.generic);

  const link = await createPersonalInvitation(groupId, participant.id);
  const sent = await sendEmail({
    to: participant.email,
    ...invitationEmail({ groupName: ctx.group.name, adminName: ctx.user.name, link }),
  });
  return sent ? ok(t.participants.inviteResent) : fail(t.auth.errors.send_failed);
}

export async function removeParticipantAction(
  groupId: string,
  participantId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireGroupAdmin(groupId);
  if (!confirmed(formData)) return fail(t.errors.confirmRequired);

  const invalidated = await db.transaction(async (tx) => {
    const wasInvalidated = await invalidateDrawInTx(tx, groupId);
    await tx.delete(participants).where(and(eq(participants.id, participantId), eq(participants.groupId, groupId)));
    return wasInvalidated;
  });

  if (invalidated) after(() => notifyDrawInvalidated(groupId));
  refresh(groupId);
  return ok();
}

export async function addExclusionAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  if (ctx.group.status === "drawn") return fail(t.exclusions.lockedAfterDraw);

  const a = String(formData.get("participantA") ?? "");
  const b = String(formData.get("participantB") ?? "");
  if (!isUuid(a) || !isUuid(b)) return fail(t.errors.generic);
  if (a === b) return fail(t.exclusions.same);

  // Both people must belong to this group.
  const [{ value: found }] = await db
    .select({ value: count() })
    .from(participants)
    .where(and(eq(participants.groupId, groupId), inArray(participants.id, [a, b])));
  if (found !== 2) return fail(t.errors.generic);

  const [participantA, participantB] = a < b ? [a, b] : [b, a];
  const inserted = await db
    .insert(exclusions)
    .values({ groupId, participantA, participantB })
    .onConflictDoNothing()
    .returning({ id: exclusions.id });
  if (inserted.length === 0) return fail(t.exclusions.exists);
  refresh(groupId);
  return ok();
}

export async function removeExclusionAction(
  groupId: string,
  exclusionId: string,
  _state: FormState,
): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  if (ctx.group.status === "drawn") return fail(t.exclusions.lockedAfterDraw);
  await db.delete(exclusions).where(and(eq(exclusions.id, exclusionId), eq(exclusions.groupId, groupId)));
  refresh(groupId);
  return ok();
}

export async function drawNowAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  if (!confirmed(formData)) return fail(t.errors.confirmRequired);

  const outcome = await performDraw(groupId, "manual");
  if (!outcome.ok) return fail(drawFailureMessage(outcome.reason));

  after(() => notifyDrawCompleted(groupId));
  refresh(groupId);
  return ok(t.draw.done);
}

export async function redrawAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  if (!confirmed(formData)) return fail(t.errors.confirmRequired);

  await db.transaction((tx) => invalidateDrawInTx(tx, groupId));
  const outcome = await performDraw(groupId, "manual");
  if (!outcome.ok) {
    after(() => notifyDrawInvalidated(groupId));
    refresh(groupId);
    return fail(drawFailureMessage(outcome.reason));
  }
  after(() => notifyDrawCompleted(groupId));
  refresh(groupId);
  return ok(t.draw.done);
}

export async function reopenGroupAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  const invalidation = await invalidateIfDrawn(ctx, formData);
  if (invalidation && invalidation !== "invalidated") return invalidation;
  if (invalidation === "invalidated") after(() => notifyDrawInvalidated(groupId));
  refresh(groupId);
  return ok(t.draw.reopened);
}

export async function scheduleDrawAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireGroupAdmin(groupId);
  if (ctx.group.status === "drawn") return fail(t.draw.errors.already_drawn);
  const parsed = scheduleDrawSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  if (parsed.data.scheduledAt.getTime() <= Date.now()) return fail(t.draw.scheduleInPast);

  await db
    .update(groups)
    .set({ scheduledDrawAt: parsed.data.scheduledAt, timezone: parsed.data.timezone, lastDrawError: null })
    .where(and(eq(groups.id, groupId), eq(groups.status, "draft")));
  refresh(groupId);
  return ok(t.draw.scheduled);
}

export async function cancelScheduleAction(groupId: string, _state: FormState): Promise<FormState> {
  await requireGroupAdmin(groupId);
  await db.update(groups).set({ scheduledDrawAt: null }).where(eq(groups.id, groupId));
  refresh(groupId);
  return ok();
}

export async function revealSurpriseAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  if (!confirmed(formData)) return fail(t.errors.confirmRequired);
  await db.update(groups).set({ surpriseRevealedAt: new Date() }).where(eq(groups.id, groupId));
  redirect(`/groups/${groupId}/results`);
}

export async function deleteGroupAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  if (!confirmed(formData)) return fail(t.errors.confirmRequired);
  await db.delete(groups).where(eq(groups.id, groupId));
  redirect("/");
}

export async function addWishAction(groupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireGroupMember(groupId);
  if (!ctx.me || ctx.me.status !== "accepted") return fail(t.errors.generic);
  const parsed = wishlistItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));

  const [{ value }] = await db
    .select({ value: count() })
    .from(wishlistItems)
    .where(eq(wishlistItems.participantId, ctx.me.id));
  if (value >= MAX_WISHLIST_ITEMS) return fail(t.wishlist.tooMany);

  await db
    .insert(wishlistItems)
    .values({ participantId: ctx.me.id, text: parsed.data.text, url: parsed.data.url ?? null });
  revalidatePath(`/groups/${groupId}/wishlist`);
  return ok();
}

export async function removeWishAction(groupId: string, itemId: string, _state: FormState): Promise<FormState> {
  const ctx = await requireGroupMember(groupId);
  if (!ctx.me) return fail(t.errors.generic);
  // Scoped to the current participant: nobody can delete another person's ideas.
  await db.delete(wishlistItems).where(and(eq(wishlistItems.id, itemId), eq(wishlistItems.participantId, ctx.me.id)));
  revalidatePath(`/groups/${groupId}/wishlist`);
  return ok();
}
