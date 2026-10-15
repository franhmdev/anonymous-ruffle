import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exclusions, participants, type Participant } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { BottomSheet } from "@/components/bottom-sheet";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { AlertIcon, MoreIcon, UserIcon, UserPlusIcon, UsersIcon } from "@/components/icons";
import { LocalDateTime } from "@/components/local-date-time";
import { ScheduleInput } from "@/components/schedule-input";
import { ShareButton } from "@/components/share-button";
import { SubmitButton } from "@/components/submit-button";
import type { GroupContext } from "@/lib/dal";
import { MIN_PARTICIPANTS } from "@/lib/draw/algorithm";
import { format, t } from "@/lib/i18n";
import {
  addExclusionAction,
  addParticipantAction,
  cancelScheduleAction,
  drawNowAction,
  redrawAction,
  regenerateInvitationAction,
  removeExclusionAction,
  removeParticipantAction,
  reopenGroupAction,
  resendInvitationAction,
  scheduleDrawAction,
} from "../actions";

type Props = { ctx: GroupContext; invitation: { link: string; expiresAt: Date } | null };

export async function AdminPanel({ ctx, invitation }: Props) {
  const { group } = ctx;
  const isDrawn = group.status === "drawn";

  const [people, groupExclusions] = await Promise.all([
    db.query.participants.findMany({ where: eq(participants.groupId, group.id), orderBy: participants.createdAt }),
    db.query.exclusions.findMany({ where: eq(exclusions.groupId, group.id) }),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const acceptedCount = people.filter((p) => p.status === "accepted").length;

  // Exclusions are symmetric: list each one under both people.
  const exclusionsOf = new Map<string, { id: string; other: string }[]>();
  for (const exclusion of groupExclusions) {
    for (const [self, other] of [
      [exclusion.participantA, exclusion.participantB],
      [exclusion.participantB, exclusion.participantA],
    ]) {
      exclusionsOf.set(self, [
        ...(exclusionsOf.get(self) ?? []),
        { id: exclusion.id, other: nameOf.get(other) ?? "?" },
      ]);
    }
  }

  const addParticipantSheet = (variant: "header" | "full") => (
    <BottomSheet
      trigger={
        <>
          <UserPlusIcon size={20} /> {variant === "header" ? t.participants.addShort : t.participants.add}
        </>
      }
      triggerLabel={t.participants.add}
      triggerClassName={variant === "header" ? "btn-blue min-h-11 rounded-full px-5" : "btn-blue w-full text-lg"}
      title={t.participants.add}
      icon={<UserPlusIcon size={28} />}
      subtitle={t.participants.addHint}
    >
      <ActionForm action={addParticipantAction.bind(null, group.id)} resetOnSuccess className="space-y-3">
        <div>
          <label htmlFor={`participant-name-${variant}`} className="label">
            {t.participants.name}
          </label>
          <input id={`participant-name-${variant}`} name="name" required maxLength={60} className="input" />
        </div>
        <div>
          <label htmlFor={`participant-email-${variant}`} className="label">
            {t.participants.email}
          </label>
          <input id={`participant-email-${variant}`} name="email" type="email" required className="input" />
        </div>
        {isDrawn ? (
          <ConfirmSubmit warning={t.draw.reopenConfirm} variant="primary" fullWidth>
            {t.participants.add}
          </ConfirmSubmit>
        ) : (
          <SubmitButton className="w-full">{t.participants.add}</SubmitButton>
        )}
      </ActionForm>
    </BottomSheet>
  );

  return (
    <div className="space-y-6">
      {/* Participants */}
      <section aria-labelledby="participants-title" className="-mx-5">
        <div className="mb-3 flex items-center justify-between px-5">
          <h2 id="participants-title" className="text-2xl font-black">
            {t.participants.title} <span className="text-muted">({acceptedCount})</span>
          </h2>
          {addParticipantSheet("header")}
        </div>
        <ul className="divide-y divide-border border-y border-border bg-surface/60">
          {people.map((person) => (
            <ParticipantRow
              key={person.id}
              person={person}
              isMe={person.userId === ctx.user.id}
              groupId={group.id}
              isDrawn={isDrawn}
              excluded={exclusionsOf.get(person.id) ?? []}
              candidates={people.filter((p) => p.id !== person.id)}
            />
          ))}
        </ul>
      </section>

      {addParticipantSheet("full")}

      {!isDrawn && (
        <div className="flex gap-3 text-lg font-semibold text-muted">
          <AlertIcon className="mt-1 shrink-0" size={26} />
          <div className="space-y-3">
            <p>{t.groups.tipBeforeDraw}</p>
            <p>{t.groups.tipWhenReady}</p>
          </div>
        </div>
      )}

      {/* Invitation link */}
      {!isDrawn && (
        <section className="card space-y-3" aria-labelledby="invite-title">
          <h2 id="invite-title" className="text-xl font-black">
            {t.invite.sectionTitle}
          </h2>
          <p className="font-semibold text-muted">{t.invite.intro}</p>
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
            <p className="font-semibold text-muted">{t.invite.none}</p>
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
        </section>
      )}

      {/* Draw */}
      <section className="card space-y-4" aria-labelledby="draw-title">
        <h2 id="draw-title" className="text-xl font-black">
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
            {acceptedCount < MIN_PARTICIPANTS && <p className="font-semibold text-muted">{t.draw.minParticipants}</p>}
            <ActionForm action={drawNowAction.bind(null, group.id)}>
              <ConfirmSubmit
                warning={t.draw.nowConfirm}
                variant="primary"
                offlineMessage={t.draw.requiresOnline}
                fullWidth
              >
                {t.draw.now}
              </ConfirmSubmit>
            </ActionForm>

            <div className="border-t border-border pt-4">
              <h3 className="mb-2 font-black">{t.draw.schedule}</h3>
              {group.scheduledDrawAt && (
                <div className="mb-3 space-y-2">
                  <p className="font-semibold">
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
    </div>
  );
}

function ParticipantRow({
  person,
  isMe,
  groupId,
  isDrawn,
  excluded,
  candidates,
}: {
  person: Participant;
  isMe: boolean;
  groupId: string;
  isDrawn: boolean;
  excluded: { id: string; other: string }[];
  candidates: Participant[];
}) {
  const affectsDraw = isDrawn && person.status === "accepted";

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserIcon className="shrink-0 text-muted" size={22} />
          <div className="min-w-0">
            <p className="truncate text-xl font-black">
              {person.name} {isMe && <span className="font-bold text-muted">({t.common.you})</span>}
            </p>
            {person.status === "pending" && (
              <span className="badge bg-warn-soft text-warn">{t.participants.pending}</span>
            )}
          </div>
        </div>
        <BottomSheet
          trigger={<MoreIcon />}
          triggerLabel={format(t.participants.options, { name: person.name })}
          triggerClassName="inline-flex size-11 items-center justify-center rounded-2xl bg-surface text-brand shadow-sm"
          title={person.name}
          icon={<UserIcon size={28} />}
          subtitle={person.email ?? undefined}
        >
          {person.status === "pending" && person.email && !isDrawn && (
            <ActionForm action={resendInvitationAction.bind(null, groupId, person.id)}>
              <SubmitButton variant="secondary" className="w-full text-lg">
                {t.participants.resendInvite}
              </SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={removeParticipantAction.bind(null, groupId, person.id)}>
            <ConfirmSubmit
              warning={format(affectsDraw ? t.participants.removeAfterDrawConfirm : t.participants.removeConfirm, {
                name: person.name,
              })}
              fullWidth
            >
              {t.participants.remove}
            </ConfirmSubmit>
          </ActionForm>
        </BottomSheet>
      </div>

      {excluded.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-9">
          <span className="text-sm font-bold text-muted">{t.exclusions.noGiftTo}</span>
          {excluded.map((exclusion) =>
            isDrawn ? (
              <span key={exclusion.id} className="badge bg-brand-soft text-brand">
                {exclusion.other}
              </span>
            ) : (
              <ActionForm key={exclusion.id} action={removeExclusionAction.bind(null, groupId, exclusion.id)}>
                <button
                  type="submit"
                  className="badge gap-1 bg-brand-soft py-1 text-sm text-brand"
                  aria-label={`${t.common.delete}: ${format(t.exclusions.pair, { a: person.name, b: exclusion.other })}`}
                >
                  {exclusion.other} <span aria-hidden="true">×</span>
                </button>
              </ActionForm>
            ),
          )}
        </div>
      )}

      {!isDrawn && candidates.length > 0 && (
        <div className="pl-9">
          <BottomSheet
            trigger={
              <>
                <UsersIcon size={20} /> {t.exclusions.addFor}
              </>
            }
            triggerLabel={`${t.exclusions.addFor}: ${person.name}`}
            triggerClassName="btn-outline min-h-11 rounded-2xl px-4 text-base"
            title={t.exclusions.addFor}
            icon={<UsersIcon size={28} />}
            subtitle={t.exclusions.intro}
          >
            <ActionForm action={addExclusionAction.bind(null, groupId)} className="space-y-3">
              <input type="hidden" name="participantA" value={person.id} />
              <div>
                <label htmlFor={`exclude-${person.id}`} className="label">
                  {format(t.exclusions.pair, { a: person.name, b: t.exclusions.choose })}
                </label>
                <select id={`exclude-${person.id}`} name="participantB" required defaultValue="" className="input">
                  <option value="" disabled>
                    —
                  </option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="w-full">{t.exclusions.add}</SubmitButton>
            </ActionForm>
          </BottomSheet>
        </div>
      )}
    </li>
  );
}
