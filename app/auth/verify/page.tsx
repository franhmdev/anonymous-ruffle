import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { t } from "@/lib/i18n";
import { verifyLinkAction } from "@/app/login/actions";

export const metadata: Metadata = { title: t.auth.loginTitle, referrer: "no-referrer" };

/**
 * Magic link landing page. Consuming the token needs a tap (POST) so that
 * email security scanners that prefetch links cannot burn it.
 */
export default async function MagicLinkPage({ searchParams }: PageProps<"/auth/verify">) {
  const { token, next } = await searchParams;
  if (typeof token !== "string" || !token) redirect("/login");

  return (
    <PageShell back="/" title={t.auth.loginTitle}>
      <ActionForm action={verifyLinkAction} className="card space-y-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
        <SubmitButton className="w-full">{t.auth.verify}</SubmitButton>
      </ActionForm>
    </PageShell>
  );
}
