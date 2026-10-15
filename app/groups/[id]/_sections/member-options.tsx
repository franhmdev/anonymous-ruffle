import Link from "next/link";
import type { Group } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { BottomSheet } from "@/components/bottom-sheet";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SettingsIcon, UserIcon } from "@/components/icons";
import { t } from "@/lib/i18n";
import { leaveGroupAction } from "../actions";

/** "Opciones del grupo" for participants who are not the admin. */
export function MemberOptions({ group }: { group: Group }) {
  return (
    <BottomSheet
      trigger={<SettingsIcon />}
      triggerLabel={t.groups.options}
      title={t.groups.options}
      icon={<SettingsIcon size={28} />}
      subtitle={group.name}
    >
      <Link href="/account" className="btn-warn w-full text-lg">
        <UserIcon size={20} /> {t.nav.account}
      </Link>
      <ActionForm action={leaveGroupAction.bind(null, group.id)}>
        <ConfirmSubmit
          warning={group.status === "drawn" ? t.groups.leaveAfterDrawConfirm : t.groups.leaveConfirm}
          offlineMessage={t.errors.offline}
          fullWidth
        >
          {t.groups.leave}
        </ConfirmSubmit>
      </ActionForm>
    </BottomSheet>
  );
}
