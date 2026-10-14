import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GroupFields } from "@/components/group-fields";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { createGroupAction } from "./actions";

export const metadata: Metadata = { title: t.groups.newTitle };

export default async function NewGroupPage() {
  const user = await requireUser("/groups/new");

  if (!user.email) {
    return (
      <div className="card space-y-3">
        <p>{t.dashboard.needsEmailToCreate}</p>
        <Link href="/account" className="btn-primary">
          {t.dashboard.guestAction}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.groups.newTitle}</h1>
      <ActionForm action={createGroupAction} className="card space-y-4">
        <GroupFields />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="adminParticipates" defaultChecked className="mt-1 size-5 accent-brand" />
          <span className="font-semibold">{t.groups.adminParticipates}</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="surpriseMode" className="mt-1 size-5 accent-brand" />
          <span>
            <span className="font-semibold">{t.groups.surpriseMode}</span>
            <span className="hint block">{t.groups.surpriseModeHint}</span>
          </span>
        </label>
        <SubmitButton className="w-full">{t.groups.create}</SubmitButton>
      </ActionForm>
    </div>
  );
}
