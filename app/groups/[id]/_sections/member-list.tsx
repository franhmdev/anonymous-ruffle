import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { UserIcon } from "@/components/icons";
import { t } from "@/lib/i18n";

/** Accepted participants' names, as seen by a regular member. */
export async function MemberList({ groupId }: { groupId: string }) {
  const members = await db.query.participants.findMany({
    where: and(eq(participants.groupId, groupId), eq(participants.status, "accepted")),
    columns: { id: true, name: true },
    orderBy: participants.createdAt,
  });

  return (
    <section aria-labelledby="members-title" className="-mx-5">
      <h2 id="members-title" className="mb-3 px-5 text-2xl font-black">
        {t.participants.title} <span className="text-muted">({members.length})</span>
      </h2>
      <ul className="divide-y divide-border border-y border-border bg-surface/60">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-5 py-4 text-xl font-black">
            <UserIcon className="text-muted" size={22} />
            {member.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
