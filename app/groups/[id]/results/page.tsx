import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { assignments, participants } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PageShell } from "@/components/page-shell";
import { requireGroupAdmin } from "@/lib/dal";
import { t } from "@/lib/i18n";
import { canViewAllResults } from "@/lib/permissions";
import { revealSurpriseAction } from "../actions";

export const metadata: Metadata = { title: t.results.title, robots: { index: false } };

export default async function ResultsPage({ params }: PageProps<"/groups/[id]/results">) {
  const { id } = await params;
  const { user, group, me } = await requireGroupAdmin(id);
  const access = canViewAllResults(group, user.id, me);
  if (access === "forbidden") notFound();

  const back = `/groups/${group.id}`;

  if (access === "not_drawn") {
    return (
      <PageShell back={back} title={t.results.title}>
        <p className="card font-semibold">{t.results.notDrawn}</p>
      </PageShell>
    );
  }

  if (access === "needs_surprise_confirmation") {
    return (
      <PageShell back={back} title={t.results.title}>
        <section className="card space-y-3 border-2 border-warn-border bg-warn-soft">
          <h2 className="text-xl font-black text-warn">{t.results.surpriseTitle}</h2>
          <p className="font-semibold">{t.results.surpriseWarning}</p>
          <ActionForm action={revealSurpriseAction.bind(null, group.id)}>
            <ConfirmSubmit warning={t.results.surpriseWarning}>{t.results.surpriseConfirm}</ConfirmSubmit>
          </ActionForm>
        </section>
      </PageShell>
    );
  }

  const giver = alias(participants, "giver");
  const receiver = alias(participants, "receiver");
  const rows = await db
    .select({ id: assignments.id, giver: giver.name, receiver: receiver.name })
    .from(assignments)
    .innerJoin(giver, eq(giver.id, assignments.giverId))
    .innerJoin(receiver, eq(receiver.id, assignments.receiverId))
    .where(eq(assignments.groupId, group.id))
    .orderBy(giver.name);

  return (
    <PageShell back={back} title={t.results.title}>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead className="border-b border-border text-sm font-extrabold text-muted">
            <tr>
              <th scope="col" className="px-5 py-3">
                {t.results.giver}
              </th>
              <th scope="col" className="px-5 py-3">
                {t.results.receiver}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-4 text-lg font-black">{row.giver}</td>
                <td className="px-5 py-4 text-lg font-bold text-primary">🎁 {row.receiver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
