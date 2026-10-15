import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GiftIcon } from "@/components/icons";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth/session";
import { format, formatBudget, formatDate, t } from "@/lib/i18n";
import { resolveInvitation } from "@/lib/invitations";
import { acceptInvitationAction, joinAsGuestAction } from "./actions";

// The token must not leak through the Referer header.
export const metadata: Metadata = { title: "Invitación", referrer: "no-referrer", robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([resolveInvitation(token), getCurrentUser()]);

  if (!invitation.ok) {
    return (
      <PageShell>
        <div className="card space-y-4 text-center">
          <p className="text-5xl" aria-hidden="true">
            ✉️
          </p>
          <p className="text-lg font-bold">{t.invite[invitation.reason]}</p>
          <Link href="/" className="btn-secondary w-full">
            {t.nav.home}
          </Link>
        </div>
      </PageShell>
    );
  }

  const { group } = invitation;

  return (
    <PageShell
      title={group.name}
      overlap={
        <section className="rounded-[32px] bg-surface p-6 text-center shadow-[0_10px_30px_rgba(40,60,140,0.18)]">
          <GiftIcon size={40} className="mx-auto text-primary" />
          {invitation.invitedName && (
            <p className="mt-2 font-bold text-muted">
              {format(t.invite.personalGreeting, { name: invitation.invitedName })}
            </p>
          )}
          <h2 className="mt-1 text-2xl font-black text-balance">{format(t.invite.title, { group: group.name })}</h2>
          <p className="mt-2 font-semibold">{format(t.invite.invitedBy, { admin: invitation.adminName })}</p>
          <p className="mt-1 font-bold text-muted">
            {formatBudget(group.budget)} · {formatDate(group.deliveryDate)}
          </p>
        </section>
      }
    >
      {user ? (
        <ActionForm action={acceptInvitationAction.bind(null, token)}>
          <SubmitButton className="w-full text-xl" offlineMessage={t.invite.offline}>
            {format(t.invite.joinAsUser, { name: user.name })}
          </SubmitButton>
        </ActionForm>
      ) : (
        <>
          <ActionForm action={joinAsGuestAction.bind(null, token)} className="card space-y-4">
            <div>
              <label htmlFor="guest-name" className="label">
                {t.invite.guestName}
              </label>
              <input
                id="guest-name"
                name="name"
                required
                maxLength={60}
                autoComplete="given-name"
                defaultValue={invitation.invitedName ?? ""}
                className="input"
              />
              <p className="hint">{t.invite.guestHint}</p>
            </div>
            <SubmitButton className="w-full text-xl" offlineMessage={t.invite.offline}>
              {t.invite.joinAsGuest}
            </SubmitButton>
          </ActionForm>
          <p className="text-center">
            <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn-link">
              {t.invite.haveAccount}
            </Link>
          </p>
        </>
      )}
    </PageShell>
  );
}
