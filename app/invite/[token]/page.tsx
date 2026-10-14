import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
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
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <p className="text-4xl" aria-hidden="true">
          ✉️
        </p>
        <p>{t.invite[invitation.reason]}</p>
        <Link href="/" className="btn-secondary">
          {t.nav.home}
        </Link>
      </div>
    );
  }

  const { group } = invitation;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="space-y-2 text-center">
        <p className="text-5xl" aria-hidden="true">
          🎁
        </p>
        {invitation.invitedName && (
          <p className="text-muted">{format(t.invite.personalGreeting, { name: invitation.invitedName })}</p>
        )}
        <h1 className="text-2xl font-bold text-balance">{format(t.invite.title, { group: group.name })}</h1>
        <p>{format(t.invite.invitedBy, { admin: invitation.adminName })}</p>
        <p className="text-sm text-muted">
          {formatBudget(group.budget)} · {formatDate(group.deliveryDate)}
        </p>
      </div>

      {user ? (
        <ActionForm action={acceptInvitationAction.bind(null, token)} className="card">
          <SubmitButton className="w-full" offlineMessage={t.invite.offline}>
            {format(t.invite.joinAsUser, { name: user.name })}
          </SubmitButton>
        </ActionForm>
      ) : (
        <>
          <ActionForm action={joinAsGuestAction.bind(null, token)} className="card space-y-3">
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
            <SubmitButton className="w-full" offlineMessage={t.invite.offline}>
              {t.invite.joinAsGuest}
            </SubmitButton>
          </ActionForm>
          <p className="text-center">
            <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn-link text-sm">
              {t.invite.haveAccount}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
