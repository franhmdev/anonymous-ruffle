// Pure authorization rules. Data loading lives in lib/dal.ts; keeping the rules
// here makes them easy to test exhaustively.

export type GroupAccessInfo = {
  adminId: string;
  status: "draft" | "drawn";
  surpriseMode: boolean;
  surpriseRevealedAt: Date | null;
};

export type ParticipantAccessInfo = {
  id: string;
  userId: string | null;
  status: "pending" | "accepted";
} | null;

export function isGroupAdmin(group: GroupAccessInfo, userId: string): boolean {
  return group.adminId === userId;
}

/** Members are the admin and accepted participants. Pending people only see the invitation. */
export function canViewGroup(group: GroupAccessInfo, userId: string, participant: ParticipantAccessInfo): boolean {
  return isGroupAdmin(group, userId) || (participant?.userId === userId && participant.status === "accepted");
}

export type AllResultsAccess = "allowed" | "forbidden" | "not_drawn" | "needs_surprise_confirmation";

/**
 * Only the admin may see every assignment. In surprise mode, an admin who also
 * participates must explicitly confirm first (and loses the surprise).
 */
export function canViewAllResults(
  group: GroupAccessInfo,
  userId: string,
  adminParticipant: ParticipantAccessInfo,
): AllResultsAccess {
  if (!isGroupAdmin(group, userId)) return "forbidden";
  if (group.status !== "drawn") return "not_drawn";
  const adminParticipates = adminParticipant?.userId === userId && adminParticipant.status === "accepted";
  if (group.surpriseMode && adminParticipates && !group.surpriseRevealedAt) return "needs_surprise_confirmation";
  return "allowed";
}

/** A participant only sees their own match, and only once the draw has happened. */
export function canViewOwnMatch(group: GroupAccessInfo, userId: string, participant: ParticipantAccessInfo): boolean {
  return group.status === "drawn" && participant?.userId === userId && participant.status === "accepted";
}

/**
 * A wishlist is visible to its owner and to the person who has to give them a
 * present. Nobody else (not even the admin) can read it.
 */
export function canViewWishlist(
  viewerParticipantId: string,
  ownerParticipantId: string,
  viewerReceiverId: string | null,
): boolean {
  return viewerParticipantId === ownerParticipantId || viewerReceiverId === ownerParticipantId;
}
