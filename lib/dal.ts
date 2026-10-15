import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { assignments, groups, participants, type Group, type Participant, type User } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { canViewGroup, isGroupAdmin } from "@/lib/permissions";

// Data Access Layer: every read of group data goes through these helpers,
// which always check authorization on the server.

export type GroupContext = {
  user: User;
  group: Group;
  me: Participant | null;
  isAdmin: boolean;
};

const loadGroupContext = cache(async (groupId: string, userId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) return null;
  const me =
    (await db.query.participants.findFirst({
      where: and(eq(participants.groupId, groupId), eq(participants.userId, userId)),
    })) ?? null;
  return { group, me };
});

/** Whether the user can already see the group (admin or accepted participant). */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const ctx = await loadGroupContext(groupId, userId);
  return Boolean(ctx && canViewGroup(ctx.group, userId, ctx.me));
}

/** Admin or accepted participant. Anyone else gets a 404 (no information leak). */
export async function requireGroupMember(groupId: string): Promise<GroupContext> {
  const user = await requireUser(`/groups/${groupId}`);
  const ctx = await loadGroupContext(groupId, user.id);
  if (!ctx || !canViewGroup(ctx.group, user.id, ctx.me)) notFound();
  return { user, ...ctx, isAdmin: isGroupAdmin(ctx.group, user.id) };
}

export async function requireGroupAdmin(groupId: string): Promise<GroupContext> {
  const ctx = await requireGroupMember(groupId);
  if (!ctx.isAdmin) notFound();
  return ctx;
}

export async function listMyGroups(userId: string) {
  return db
    .selectDistinct({
      id: groups.id,
      name: groups.name,
      status: groups.status,
      deliveryDate: groups.deliveryDate,
      adminId: groups.adminId,
      createdAt: groups.createdAt,
      participantCount:
        sql<number>`(select count(*) from participants p where p.group_id = ${groups.id} and p.status = 'accepted')`.mapWith(
          Number,
        ),
    })
    .from(groups)
    .leftJoin(participants, and(eq(participants.groupId, groups.id), eq(participants.userId, userId)))
    .where(or(eq(groups.adminId, userId), eq(participants.status, "accepted")))
    .orderBy(desc(groups.createdAt));
}

/** The participant the current member has to give a present to. */
export async function getMyReceiver(groupId: string, giverId: string): Promise<Participant | null> {
  const [row] = await db
    .select({ receiver: participants })
    .from(assignments)
    .innerJoin(participants, eq(participants.id, assignments.receiverId))
    .where(and(eq(assignments.groupId, groupId), eq(assignments.giverId, giverId)))
    .limit(1);
  return row?.receiver ?? null;
}
