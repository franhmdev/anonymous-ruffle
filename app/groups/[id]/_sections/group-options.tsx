import Link from "next/link";
import type { Group } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { BottomSheet } from "@/components/bottom-sheet";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EditIcon, SettingsIcon, UserIcon } from "@/components/icons";
import { ShareAction } from "@/components/share-button";
import { format, t } from "@/lib/i18n";
import { deleteGroupAction } from "../actions";

/** Admin-only "Opciones del grupo" bottom sheet. */
export function GroupOptions({ group, inviteLink }: { group: Group; inviteLink: string | null }) {
  return (
    <BottomSheet
      trigger={<SettingsIcon />}
      triggerLabel={t.groups.options}
      title={t.groups.options}
      icon={<SettingsIcon size={28} />}
      subtitle={`#${group.id.slice(0, 8)}`}
    >
      <Link href={`/groups/${group.id}/edit`} className="btn-secondary w-full text-lg">
        <EditIcon size={20} /> {t.groups.edit}
      </Link>
      {inviteLink && (
        <ShareAction
          title={format(t.invite.shareTitle, { group: group.name })}
          text={format(t.invite.shareText, { group: group.name })}
          url={inviteLink}
        >
          {t.groups.share}
        </ShareAction>
      )}
      <Link href="/account" className="btn-warn w-full text-lg">
        <UserIcon size={20} /> {t.nav.account}
      </Link>
      <ActionForm action={deleteGroupAction.bind(null, group.id)}>
        <ConfirmSubmit warning={t.groups.deleteGroupConfirm} fullWidth>
          {t.groups.deleteGroup}
        </ConfirmSubmit>
      </ActionForm>
    </BottomSheet>
  );
}
