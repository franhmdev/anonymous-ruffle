"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";
import { t } from "@/lib/i18n";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultName: string;
};

/**
 * Guest join form. When the server warns that someone in the group already
 * uses the name, the button becomes "Soy otra persona, unirme" and carries that
 * exact name, so the server only skips the check for it.
 */
export function GuestJoinForm({ action, defaultName }: Props) {
  return (
    <ActionForm action={action} className="card space-y-4">
      {(state) => {
        const duplicateName = state?.data?.duplicateName;
        return (
          <>
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
                defaultValue={defaultName}
                className="input"
              />
              <p className="hint">{t.invite.guestHint}</p>
            </div>
            {duplicateName ? (
              <SubmitButton
                key="confirm"
                name="confirmDuplicate"
                value={duplicateName}
                className="w-full text-xl"
                offlineMessage={t.invite.offline}
              >
                {t.invite.joinAnyway}
              </SubmitButton>
            ) : (
              <SubmitButton key="join" className="w-full text-xl" offlineMessage={t.invite.offline}>
                {t.invite.joinAsGuest}
              </SubmitButton>
            )}
          </>
        );
      }}
    </ActionForm>
  );
}
