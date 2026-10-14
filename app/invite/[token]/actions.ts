"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getClientIp, getCurrentUser, startSession } from "@/lib/auth/session";
import { fail, type FormState } from "@/lib/form-state";
import { t } from "@/lib/i18n";
import { acceptInvitation, resolveInvitation } from "@/lib/invitations";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { firstError, nameSchema } from "@/lib/validation";

export async function acceptInvitationAction(token: string, _state: FormState): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/invite/${token}`);

  const result = await acceptInvitation(token, user);
  if (!result.ok) return fail(t.invite[result.reason]);
  redirect(`/groups/${result.groupId}?welcome=1`);
}

/** Joins without registering: creates a guest account bound to this device's session. */
export async function joinAsGuestAction(token: string, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return fail(firstError(parsed.error));
  if (!(await rateLimit(`join:ip:${await getClientIp()}`, LIMITS.joinPerIp))) return fail(t.errors.rateLimited);

  // Validate before creating any account.
  const resolved = await resolveInvitation(token);
  if (!resolved.ok) return fail(t.invite[resolved.reason]);

  const [guest] = await db.insert(users).values({ name: parsed.data }).returning();
  const result = await acceptInvitation(token, guest);
  if (!result.ok) return fail(t.invite[result.reason]);

  await startSession(guest.id);
  redirect(`/groups/${result.groupId}?welcome=1`);
}
