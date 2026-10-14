import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { LogoutForm } from "@/components/logout-form";
import { PushToggle } from "@/components/push-toggle";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n";
import { isPushConfigured } from "@/lib/push";
import {
  deleteAccountAction,
  linkEmailAction,
  logoutAction,
  logoutEverywhereAction,
  updateNameAction,
} from "./actions";

export const metadata: Metadata = { title: t.account.title };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const vapidPublicKey = isPushConfigured() ? (env.VAPID_PUBLIC_KEY ?? null) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.account.title}</h1>

      <section className="card space-y-4" aria-labelledby="profile">
        <h2 id="profile" className="text-lg font-bold">
          {t.account.profile}
        </h2>
        <ActionForm action={updateNameAction} className="space-y-3">
          <div>
            <label htmlFor="name" className="label">
              {t.auth.name}
            </label>
            <input id="name" name="name" defaultValue={user.name} required maxLength={60} className="input" />
          </div>
          <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
        </ActionForm>
        <p className="text-sm">
          <span className="font-semibold">{t.auth.email}: </span>
          {user.email ?? t.account.guest}
        </p>
      </section>

      {!user.email && (
        <section className="card space-y-3 border-brand" aria-labelledby="link-email">
          <h2 id="link-email" className="text-lg font-bold">
            {t.account.linkEmailTitle}
          </h2>
          <p className="text-sm">{t.account.linkEmailIntro}</p>
          <ActionForm action={linkEmailAction} className="space-y-3">
            <label htmlFor="link-email-input" className="label">
              {t.auth.email}
            </label>
            <input id="link-email-input" name="email" type="email" required autoComplete="email" className="input" />
            <SubmitButton>{t.account.linkEmailAction}</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="card space-y-3" aria-labelledby="notifications">
        <h2 id="notifications" className="text-lg font-bold">
          {t.account.notificationsTitle}
        </h2>
        <PushToggle publicKey={vapidPublicKey} />
      </section>

      <section className="card space-y-3" aria-labelledby="sessions">
        <h2 id="sessions" className="text-lg font-bold">
          {t.account.sessionsTitle}
        </h2>
        <div className="flex flex-wrap gap-2">
          <LogoutForm action={logoutAction}>{t.auth.logout}</LogoutForm>
          <LogoutForm action={logoutEverywhereAction}>{t.auth.logoutAll}</LogoutForm>
        </div>
      </section>

      <section className="card space-y-3" aria-labelledby="danger">
        <h2 id="danger" className="text-lg font-bold text-brand">
          {t.account.dangerTitle}
        </h2>
        <p className="text-sm">{t.account.dangerIntro}</p>
        <ActionForm action={deleteAccountAction}>
          <ConfirmSubmit warning={t.account.deleteConfirm}>{t.account.deleteAccount}</ConfirmSubmit>
        </ActionForm>
      </section>
    </div>
  );
}
