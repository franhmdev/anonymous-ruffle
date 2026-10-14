"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { groups, participants } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { fail, type FormState } from "@/lib/form-state";
import { regenerateGroupInvitation } from "@/lib/invitations";
import { t } from "@/lib/i18n";
import { createGroupSchema, firstError } from "@/lib/validation";

export async function createGroupAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/groups/new");
  // The admin needs a verified email to receive notices about the group.
  if (!user.email) return fail(t.dashboard.needsEmailToCreate);

  const parsed = createGroupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { adminParticipates, ...data } = parsed.data;

  const groupId = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ ...data, adminId: user.id })
      .returning({ id: groups.id });
    if (adminParticipates) {
      await tx.insert(participants).values({
        groupId: group.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        status: "accepted",
      });
    }
    return group.id;
  });

  await regenerateGroupInvitation(groupId);
  redirect(`/groups/${groupId}?welcome=1`);
}
