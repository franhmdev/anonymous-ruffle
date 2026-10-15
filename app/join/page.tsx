import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { t } from "@/lib/i18n";
import { joinWithLinkAction } from "./actions";

export const metadata: Metadata = { title: t.join.title };

export default function JoinPage() {
  return (
    <PageShell back="/" title={t.join.title}>
      <ActionForm action={joinWithLinkAction} className="card space-y-4">
        <p className="font-semibold text-muted">{t.join.intro}</p>
        <div>
          <label htmlFor="invite-link" className="label">
            {t.join.label}
          </label>
          <input
            id="invite-link"
            name="link"
            required
            inputMode="url"
            autoComplete="off"
            placeholder="https://…/invite/…"
            className="input"
          />
        </div>
        <SubmitButton className="w-full">{t.join.submit}</SubmitButton>
      </ActionForm>
    </PageShell>
  );
}
