import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groups, loginCodes, participants, users } from "@/db/schema";
import { invalidateDrawInTx, notifyDrawInvalidated } from "@/lib/draw/service";

/**
 * GDPR erasure: deletes the user, the groups they administer and their
 * participations. Drawn groups they were part of are invalidated and the
 * remaining members are notified.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const invalidated: string[] = [];

  await db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return;

    await tx.delete(groups).where(eq(groups.adminId, userId));

    const participations = await tx.query.participants.findMany({ where: eq(participants.userId, userId) });
    for (const participation of participations) {
      if (await invalidateDrawInTx(tx, participation.groupId)) invalidated.push(participation.groupId);
      await tx.delete(participants).where(eq(participants.id, participation.id));
    }

    if (user.email) await tx.delete(loginCodes).where(eq(loginCodes.email, user.email));
    await tx.delete(users).where(eq(users.id, userId));
  });

  await Promise.all(invalidated.map(notifyDrawInvalidated));
}
