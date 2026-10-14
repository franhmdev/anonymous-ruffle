import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { assignments, participants } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
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

  const back = (
    <Link href={`/groups/${group.id}`} className="btn-link text-sm">
      ← {t.common.back}
    </Link>
  );

  if (access === "not_drawn") {
    return (
      <div className="space-y-4">
        {back}
        <p className="card">{t.results.notDrawn}</p>
      </div>
    );
  }

  if (access === "needs_surprise_confirmation") {
    return (
      <div className="space-y-4">
        {back}
        <section className="card space-y-3 border-brand">
          <h1 className="text-xl font-bold">{t.results.surpriseTitle}</h1>
          <p>{t.results.surpriseWarning}</p>
          <ActionForm action={revealSurpriseAction.bind(null, group.id)}>
            <ConfirmSubmit warning={t.results.surpriseWarning}>{t.results.surpriseConfirm}</ConfirmSubmit>
          </ActionForm>
        </section>
      </div>
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
    <div className="space-y-4">
      {back}
      <h1 className="text-2xl font-bold">{t.results.title}</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead className="border-b border-border text-sm text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t.results.giver}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.results.receiver}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold">{row.giver}</td>
                <td className="px-4 py-3">🎁 {row.receiver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
