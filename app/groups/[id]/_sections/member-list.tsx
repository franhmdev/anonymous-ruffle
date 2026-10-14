import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { t } from "@/lib/i18n";

/** Accepted participants' names, as seen by a regular member. */
export async function MemberList({ groupId }: { groupId: string }) {
  const members = await db.query.participants.findMany({
    where: and(eq(participants.groupId, groupId), eq(participants.status, "accepted")),
    columns: { id: true, name: true },
    orderBy: participants.createdAt,
  });

  return (
    <section className="card" aria-labelledby="members-title">
      <h2 id="members-title" className="mb-3 text-lg font-bold">
        {t.participants.title} ({members.length})
      </h2>
      <ul className="flex flex-wrap gap-2">
        {members.map((member) => (
          <li key={member.id} className="badge bg-background px-3 py-1 text-sm">
            {member.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
