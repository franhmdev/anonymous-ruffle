"use server";

import { redirect } from "next/navigation";
import { fail, type FormState } from "@/lib/form-state";
import { t } from "@/lib/i18n";

/** Accepts a full invitation link (or just its token) and opens the invitation page. */
export async function joinWithLinkAction(_state: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("link") ?? "").trim();
  const token = raw.match(/\/invite\/([\w-]{20,100})/)?.[1] ?? (/^[\w-]{20,100}$/.test(raw) ? raw : null);
  if (!token) return fail(t.join.invalid);
  redirect(`/invite/${token}`);
}
