import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { format, t } from "@/lib/i18n";
import { verifyCodeAction } from "../actions";

export const metadata: Metadata = { title: t.auth.verifyTitle };

export default async function VerifyCodePage({ searchParams }: PageProps<"/login/verify">) {
  const { email, next } = await searchParams;
  if (typeof email !== "string" || !email) redirect("/login");
  const nextPath = typeof next === "string" ? next : "/";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t.auth.verifyTitle}</h1>
      <p className="text-muted">{format(t.auth.verifyIntro, { email })}</p>
      <ActionForm action={verifyCodeAction} className="card space-y-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={nextPath} />
        <div>
          <label htmlFor="code" className="label">
            {t.auth.code}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="input text-center font-mono text-2xl tracking-[0.5em]"
          />
        </div>
        <SubmitButton className="w-full">{t.auth.verify}</SubmitButton>
      </ActionForm>
      <p className="hint">{t.auth.useLinkHint}</p>
      <Link href={`/login?${new URLSearchParams({ email, next: nextPath })}`} className="btn-link text-sm">
        {t.auth.resend}
      </Link>
    </div>
  );
}
