import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exclusions, participants } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { GroupFields } from "@/components/group-fields";
import { LocalDateTime } from "@/components/local-date-time";
import { ScheduleInput } from "@/components/schedule-input";
import { ShareButton } from "@/components/share-button";
import { SubmitButton } from "@/components/submit-button";
import type { GroupContext } from "@/lib/dal";
import { MIN_PARTICIPANTS } from "@/lib/draw/algorithm";
import { format, t } from "@/lib/i18n";
import { getActiveGroupInvitation } from "@/lib/invitations";
import {
  addExclusionAction,
  addParticipantAction,
  cancelScheduleAction,
  deleteGroupAction,
  drawNowAction,
  redrawAction,
  regenerateInvitationAction,
  removeExclusionAction,
  removeParticipantAction,
  reopenGroupAction,
  resendInvitationAction,
  scheduleDrawAction,
  updateGroupAction,
} from "../actions";

export async function AdminPanel({ ctx }: { ctx: GroupContext }) {
  const { group } = ctx;
  const isDrawn = group.status === "drawn";

  const [people, groupExclusions, invitation] = await Promise.all([
    db.query.participants.findMany({ where: eq(participants.groupId, group.id), orderBy: participants.createdAt }),
    db.query.exclusions.findMany({ where: eq(exclusions.groupId, group.id) }),
    isDrawn ? null : getActiveGroupInvitation(group.id),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const acceptedCount = people.filter((p) => p.status === "accepted").length;

  return (
    <div className="space-y-6">
      {/* Invitation link */}
      <section className="card space-y-3" aria-labelledby="invite-title">
        <h2 id="invite-title" className="text-lg font-bold">
          {t.invite.sectionTitle}
        </h2>
        {isDrawn ? (
          <p className="text-sm text-muted">{t.invite.afterDraw}</p>
        ) : (
          <>
            <p className="text-sm">{t.invite.intro}</p>
            {invitation ? (
              <>
                <ShareButton
                  title={format(t.invite.shareTitle, { group: group.name })}
                  text={format(t.invite.shareText, { group: group.name })}
                  url={invitation.link}
                />
                <p className="hint">
                  {t.invite.expiresPrefix} <LocalDateTime iso={invitation.expiresAt.toISOString()} />{" "}
                  {t.invite.expiresSuffix}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">{t.invite.none}</p>
            )}
            <ActionForm action={regenerateInvitationAction.bind(null, group.id)}>
              {invitation ? (
                <ConfirmSubmit warning={t.invite.regenerateConfirm} variant="secondary">
                  {t.invite.regenerate}
                </ConfirmSubmit>
              ) : (
                <SubmitButton>{t.invite.create}</SubmitButton>
              )}
            </ActionForm>
          </>
        )}
      </section>

      {/* Participants */}
      <section className="card space-y-4" aria-labelledby="participants-title">
        <h2 id="participants-title" className="text-lg font-bold">
          {t.participants.title}{" "}
          <span className="text-sm font-normal text-muted">
            ({format(t.participants.acceptedCount, { count: acceptedCount })})
          </span>
        </h2>
        <ul className="divide-y divide-border">
          {people.map((person) => {
            const affectsDraw = isDrawn && person.status === "accepted";
            return (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {person.name}
                    {person.userId === ctx.user.id && <span className="text-muted"> ({t.common.you})</span>}
                  </p>
                  <p className="truncate text-sm text-muted">{person.email}</p>
                  <span
                    className={`badge mt-1 ${person.status === "accepted" ? "bg-accent/15 text-accent" : "bg-brand-soft text-brand"}`}
                  >
                    {person.status === "accepted" ? t.participants.accepted : t.participants.pending}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {person.status === "pending" && person.email && !isDrawn && (
                    <ActionForm action={resendInvitationAction.bind(null, group.id, person.id)}>
                      <SubmitButton variant="secondary">{t.participants.resendInvite}</SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={removeParticipantAction.bind(null, group.id, person.id)}>
                    <ConfirmSubmit
                      warning={format(
                        affectsDraw ? t.participants.removeAfterDrawConfirm : t.participants.removeConfirm,
                        {
                          name: person.name,
                        },
                      )}
                    >
                      {t.participants.remove}
                    </ConfirmSubmit>
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>

        <ActionForm
          action={addParticipantAction.bind(null, group.id)}
          resetOnSuccess
          className="space-y-3 border-t border-border pt-4"
        >
          <h3 className="font-bold">{t.participants.add}</h3>
          <p className="hint">{t.participants.addHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="participant-name" className="label">
                {t.participants.name}
              </label>
              <input id="participant-name" name="name" required maxLength={60} className="input" />
            </div>
            <div>
              <label htmlFor="participant-email" className="label">
                {t.participants.email}
              </label>
              <input id="participant-email" name="email" type="email" required className="input" />
            </div>
          </div>
          {isDrawn ? (
            <ConfirmSubmit warning={t.draw.reopenConfirm} variant="secondary">
              {t.participants.add}
            </ConfirmSubmit>
          ) : (
            <SubmitButton variant="secondary">{t.participants.add}</SubmitButton>
          )}
        </ActionForm>
      </section>

      {/* Exclusions */}
      <section className="card space-y-3" aria-labelledby="exclusions-title">
        <h2 id="exclusions-title" className="text-lg font-bold">
          {t.exclusions.title}
        </h2>
        <p className="text-sm">{t.exclusions.intro}</p>
        {groupExclusions.length === 0 ? (
          <p className="text-sm text-muted">{t.exclusions.none}</p>
        ) : (
          <ul className="space-y-2">
            {groupExclusions.map((exclusion) => (
              <li
                key={exclusion.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
              >
                <span>
                  {format(t.exclusions.pair, {
                    a: nameOf.get(exclusion.participantA) ?? "?",
                    b: nameOf.get(exclusion.participantB) ?? "?",
                  })}
                </span>
                {!isDrawn && (
                  <ActionForm action={removeExclusionAction.bind(null, group.id, exclusion.id)}>
                    <SubmitButton variant="danger">{t.common.delete}</SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        {isDrawn ? (
          <p className="hint">{t.exclusions.lockedAfterDraw}</p>
        ) : (
          people.length >= 2 && (
            <ActionForm action={addExclusionAction.bind(null, group.id)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <PersonSelect id="participantA" label={t.exclusions.personA} people={people} />
                <PersonSelect id="participantB" label={t.exclusions.personB} people={people} />
              </div>
              <SubmitButton variant="secondary">{t.exclusions.add}</SubmitButton>
            </ActionForm>
          )
        )}
      </section>

      {/* Draw */}
      <section className="card space-y-4" aria-labelledby="draw-title">
        <h2 id="draw-title" className="text-lg font-bold">
          {t.draw.title}
        </h2>
        {isDrawn ? (
          <>
            <Link href={`/groups/${group.id}/results`} prefetch={false} className="btn-primary w-full">
              {t.results.link}
            </Link>
            <ActionForm action={redrawAction.bind(null, group.id)}>
              <ConfirmSubmit warning={t.draw.redrawConfirm} variant="secondary" offlineMessage={t.draw.requiresOnline}>
                {t.draw.redraw}
              </ConfirmSubmit>
            </ActionForm>
            <ActionForm action={reopenGroupAction.bind(null, group.id)}>
              <ConfirmSubmit warning={t.draw.reopenConfirm}>{t.draw.reopen}</ConfirmSubmit>
            </ActionForm>
          </>
        ) : (
          <>
            {acceptedCount < MIN_PARTICIPANTS && <p className="text-sm text-muted">{t.draw.minParticipants}</p>}
            <ActionForm action={drawNowAction.bind(null, group.id)}>
              <ConfirmSubmit warning={t.draw.nowConfirm} variant="primary" offlineMessage={t.draw.requiresOnline}>
                {t.draw.now}
              </ConfirmSubmit>
            </ActionForm>

            <div className="border-t border-border pt-4">
              <h3 className="mb-2 font-bold">{t.draw.schedule}</h3>
              {group.scheduledDrawAt && (
                <div className="mb-3 space-y-2">
                  <p className="text-sm">
                    {t.groups.scheduledFor} <LocalDateTime iso={group.scheduledDrawAt.toISOString()} />
                  </p>
                  <ActionForm action={cancelScheduleAction.bind(null, group.id)}>
                    <SubmitButton variant="danger">{t.draw.scheduleCancel}</SubmitButton>
                  </ActionForm>
                </div>
              )}
              <ActionForm action={scheduleDrawAction.bind(null, group.id)} className="space-y-3">
                <ScheduleInput />
                <SubmitButton variant="secondary">{t.draw.scheduleSave}</SubmitButton>
              </ActionForm>
            </div>
          </>
        )}
      </section>

      {/* Settings */}
      <section className="card space-y-3" aria-labelledby="settings-title">
        <h2 id="settings-title" className="text-lg font-bold">
          {t.groups.settings}
        </h2>
        <ActionForm action={updateGroupAction.bind(null, group.id)} className="space-y-4">
          <GroupFields defaults={group} />
          <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
        </ActionForm>
        <ActionForm action={deleteGroupAction.bind(null, group.id)} className="border-t border-border pt-4">
          <ConfirmSubmit warning={t.groups.deleteGroupConfirm}>{t.groups.deleteGroup}</ConfirmSubmit>
        </ActionForm>
      </section>
    </div>
  );
}

function PersonSelect({ id, label, people }: { id: string; label: string; people: { id: string; name: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} name={id} required defaultValue="" className="input">
        <option value="" disabled>
          —
        </option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </div>
  );
}
