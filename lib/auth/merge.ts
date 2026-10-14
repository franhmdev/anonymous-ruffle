import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groups, participants, pushSubscriptions, sessions, users } from "@/db/schema";
import { invalidateDrawInTx, notifyDrawInvalidated } from "@/lib/draw/service";

/**
 * Links a verified email to a guest account. If the email already belongs to
 * another account, the guest's data is moved into it and the guest is deleted.
 * Returns the id of the account the session should use.
 */
export async function mergeGuestIntoUser(guestId: string, email: string): Promise<string> {
  const invalidatedGroupIds: string[] = [];

  const userId = await db.transaction(async (tx) => {
    const guest = await tx.query.users.findFirst({ where: eq(users.id, guestId) });
    if (!guest) throw new Error("Guest user not found");
    if (guest.email === email) return guest.id;

    const owner = await tx.query.users.findFirst({ where: eq(users.email, email) });
    if (!owner) {
      await tx.update(users).set({ email }).where(eq(users.id, guestId));
      await tx.update(participants).set({ email }).where(eq(participants.userId, guestId));
      return guestId;
    }

    const guestParticipations = await tx.query.participants.findMany({ where: eq(participants.userId, guestId) });
    const ownerGroupIds = new Set(
      (
        await tx.query.participants.findMany({ where: eq(participants.userId, owner.id), columns: { groupId: true } })
      ).map((p) => p.groupId),
    );

    for (const participation of guestParticipations) {
      if (!ownerGroupIds.has(participation.groupId)) {
        await tx
          .update(participants)
          .set({ userId: owner.id, email, name: participation.name })
          .where(eq(participants.id, participation.id));
        continue;
      }
      // The same person joined twice (as guest and with their email): keep one.
      if (await invalidateDrawInTx(tx, participation.groupId)) invalidatedGroupIds.push(participation.groupId);
      await tx.delete(participants).where(eq(participants.id, participation.id));
    }

    await tx.update(groups).set({ adminId: owner.id }).where(eq(groups.adminId, guestId));
    await tx.update(sessions).set({ userId: owner.id }).where(eq(sessions.userId, guestId));
    await tx.update(pushSubscriptions).set({ userId: owner.id }).where(eq(pushSubscriptions.userId, guestId));
    await tx.delete(users).where(eq(users.id, guestId));
    return owner.id;
  });

  await Promise.all(invalidatedGroupIds.map(notifyDrawInvalidated));
  return userId;
}
