"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestLoginCode, verifyLoginCode, verifyMagicLink } from "@/lib/auth/login";
import { endCurrentSession, getClientIp, safeNextPath, startSession } from "@/lib/auth/session";
import { fail, type FormState } from "@/lib/form-state";
import { t } from "@/lib/i18n";
import { codeSchema, emailSchema, firstError, nameSchema } from "@/lib/validation";

const requestSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(nameSchema.optional()),
  next: z.string().optional(),
});

export async function requestCodeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { email, name } = parsed.data;
  const next = safeNextPath(parsed.data.next);

  const result = await requestLoginCode({ email, name, ip: await getClientIp(), next });
  if (!result.ok) return fail(t.auth.errors[result.error]);

  redirect(`/login/verify?${new URLSearchParams({ email, next })}`);
}

const verifySchema = z.object({ email: emailSchema, code: codeSchema, next: z.string().optional() });

export async function verifyCodeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));

  const result = await verifyLoginCode({ email: parsed.data.email, code: parsed.data.code, ip: await getClientIp() });
  if (!result.ok) return fail(t.auth.errors[result.error]);

  await endCurrentSession();
  await startSession(result.userId);
  redirect(safeNextPath(parsed.data.next));
}

export async function verifyLinkAction(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const result = await verifyMagicLink({ token, ip: await getClientIp() });
  if (!result.ok)
    return fail(result.error === "rate_limited" ? t.auth.errors.rate_limited : t.auth.errors.link_invalid);

  await endCurrentSession();
  await startSession(result.userId);
  redirect(safeNextPath(formData.get("next")));
}
