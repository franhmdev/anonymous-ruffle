import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { assignments, exclusions, groups, invitations, participants, users } from "@/db/schema";
import { performDraw, runScheduledDraws } from "@/lib/draw/service";

// Runs against the database in DATABASE_URL (see `npm run test:integration`).

const createdUserIds: string[] = [];

async function createGroup(options: { members: number; scheduledDrawAt?: Date; impossible?: boolean }) {
  const [admin] = await db
    .insert(users)
    .values({ name: "Admin", email: `admin-${crypto.randomUUID()}@example.com` })
    .returning();
  createdUserIds.push(admin.id);
  const [group] = await db
    .insert(groups)
    .values({ adminId: admin.id, name: "Test", scheduledDrawAt: options.scheduledDrawAt ?? null })
    .returning();
  const members = await db
    .insert(participants)
    .values(
      Array.from({ length: options.members }, (_, i) => ({
        groupId: group.id,
        name: `P${i}`,
        status: "accepted" as const,
      })),
    )
    .returning();
  if (options.impossible) {
    // In a group of 3, P0 excluded with both others cannot give to anyone.
    const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);
    for (const other of members.slice(1)) {
      const [participantA, participantB] = pair(members[0].id, other.id);
      await db.insert(exclusions).values({ groupId: group.id, participantA, participantB });
    }
  }
  await db.insert(invitations).values({
    groupId: group.id,
    tokenHash: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return { group, members };
}

const countAssignments = async (groupId: string) =>
  (await db.select().from(assignments).where(eq(assignments.groupId, groupId))).length;

describe("draw service (database)", () => {
  beforeEach(() => {
    // Keep emails/push out of these tests: they log in development mode only.
    delete process.env.RESEND_API_KEY;
  });

  afterAll(async () => {
    for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  });

  it("draws once and is idempotent under concurrent calls", async () => {
    const { group, members } = await createGroup({ members: 5 });

    const outcomes = await Promise.all([performDraw(group.id, "manual"), performDraw(group.id, "manual")]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok)).toEqual([{ ok: false, reason: "already_drawn" }]);
    expect(await countAssignments(group.id)).toBe(members.length);

    // A later call does not draw again.
    expect(await performDraw(group.id, "manual")).toEqual({ ok: false, reason: "already_drawn" });

    const updated = await db.query.groups.findFirst({ where: eq(groups.id, group.id) });
    expect(updated?.status).toBe("drawn");
    const invites = await db.query.invitations.findMany({ where: eq(invitations.groupId, group.id) });
    expect(invites.every((i) => i.revokedAt !== null)).toBe(true);
  });

  it("runs a due scheduled draw only once even if the cron fires twice", async () => {
    const { group, members } = await createGroup({ members: 4, scheduledDrawAt: new Date(Date.now() - 60_000) });

    await Promise.all([runScheduledDraws(), runScheduledDraws()]);

    expect(await countAssignments(group.id)).toBe(members.length);
    const updated = await db.query.groups.findFirst({ where: eq(groups.id, group.id) });
    expect(updated?.status).toBe("drawn");
    expect(updated?.scheduledDrawAt).toBeNull();
  });

  it("does not run a scheduled draw before its time", async () => {
    const { group } = await createGroup({ members: 3, scheduledDrawAt: new Date(Date.now() + 3_600_000) });
    expect(await performDraw(group.id, "scheduled")).toEqual({ ok: false, reason: "not_due" });
    expect(await countAssignments(group.id)).toBe(0);
  });

  it("clears an impossible scheduled draw and records why, so the cron does not retry", async () => {
    const { group } = await createGroup({
      members: 3,
      scheduledDrawAt: new Date(Date.now() - 60_000),
      impossible: true,
    });

    expect(await performDraw(group.id, "scheduled")).toEqual({ ok: false, reason: "impossible" });
    const updated = await db.query.groups.findFirst({ where: eq(groups.id, group.id) });
    expect(updated?.status).toBe("draft");
    expect(updated?.scheduledDrawAt).toBeNull();
    expect(updated?.lastDrawError).toBe("impossible");

    // A second cron run finds nothing to do.
    expect(await performDraw(group.id, "scheduled")).toEqual({ ok: false, reason: "not_due" });
  });

  it("refuses groups with fewer than 3 accepted participants", async () => {
    const { group } = await createGroup({ members: 2 });
    expect(await performDraw(group.id, "manual")).toEqual({ ok: false, reason: "not_enough_participants" });
  });
});
