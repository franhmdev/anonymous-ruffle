"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { participants, users } from "@/db/schema";
import { deleteAccount } from "@/lib/account";
import { requestLoginCode } from "@/lib/auth/login";
import { endCurrentSession, getClientIp, requireUser, revokeAllSessions, SESSION_COOKIE } from "@/lib/auth/session";
import { fail, ok, type FormState } from "@/lib/form-state";
import { t } from "@/lib/i18n";
import { emailSchema, firstError, nameSchema } from "@/lib/validation";

export async function updateNameAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return fail(firstError(parsed.error));

  await db.update(users).set({ name: parsed.data }).where(eq(users.id, user.id));
  // Keep the display name in groups in sync.
  await db.update(participants).set({ name: parsed.data }).where(eq(participants.userId, user.id));
  return ok(t.account.nameUpdated);
}

export async function linkEmailAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return fail(firstError(parsed.error));

  const result = await requestLoginCode({
    email: parsed.data,
    linkUserId: user.id,
    ip: await getClientIp(),
    next: "/account",
  });
  if (!result.ok) return fail(t.auth.errors[result.error]);
  redirect(`/login/verify?${new URLSearchParams({ email: parsed.data, next: "/account" })}`);
}

export async function logoutAction(): Promise<void> {
  await endCurrentSession();
  redirect("/");
}

export async function logoutEverywhereAction(): Promise<void> {
  const user = await requireUser("/account");
  await revokeAllSessions(user.id);
  redirect("/");
}

export async function deleteAccountAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  if (formData.get("confirm") !== "yes") return fail(t.errors.confirmRequired);
  await deleteAccount(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
