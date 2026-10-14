import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { t } from "@/lib/i18n";
import { requestCodeAction } from "./actions";

export const metadata: Metadata = { title: t.auth.loginTitle };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, email } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      <p className="text-muted">{t.auth.loginIntro}</p>
      <ActionForm action={requestCodeAction} className="card space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
        <div>
          <label htmlFor="email" className="label">
            {t.auth.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={typeof email === "string" ? email : ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="name" className="label">
            {t.auth.name} <span className="font-normal text-muted">({t.common.optional})</span>
          </label>
          <input id="name" name="name" type="text" autoComplete="name" maxLength={60} className="input" />
          <p className="hint">{t.auth.nameHint}</p>
        </div>
        <SubmitButton className="w-full">{t.auth.sendCode}</SubmitButton>
      </ActionForm>
    </div>
  );
}
