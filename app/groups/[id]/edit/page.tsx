import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { GroupFields } from "@/components/group-fields";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { requireGroupAdmin } from "@/lib/dal";
import { t } from "@/lib/i18n";
import { updateGroupAction } from "../actions";

export const metadata: Metadata = { title: t.groups.edit };

export default async function EditGroupPage({ params }: PageProps<"/groups/[id]/edit">) {
  const { id } = await params;
  const { group } = await requireGroupAdmin(id);

  return (
    <PageShell back={`/groups/${group.id}`} title={t.groups.edit}>
      <ActionForm action={updateGroupAction.bind(null, group.id)} className="card space-y-4">
        <GroupFields defaults={group} />
        <SubmitButton className="w-full">{t.common.save}</SubmitButton>
      </ActionForm>
    </PageShell>
  );
}
