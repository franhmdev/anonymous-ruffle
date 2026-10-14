import { randomInt } from "node:crypto";

export type RandomInt = (maxExclusive: number) => number;

export type Exclusion = readonly [string, string];

export type DrawResult =
  | { ok: true; assignments: Map<string, string> }
  | { ok: false; reason: "not_enough_participants" | "duplicate_participants" | "impossible" };

export const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 100;

const REJECTION_SAMPLING_ATTEMPTS = 2_000;

const cryptoRandomInt: RandomInt = (max) => randomInt(0, max);

/**
 * Builds a Secret Santa assignment (giver -> receiver) where:
 * - nobody gives to themselves,
 * - excluded pairs (symmetric) never give to each other,
 * - everybody gives exactly once and receives exactly once.
 *
 * It first tries uniform rejection sampling over random permutations. If the
 * constraints are tight it falls back to a constructive search that keeps a
 * perfect matching reachable at every step, so it always terminates and
 * reports `impossible` instead of looping.
 */
export function drawAssignments(
  participantIds: readonly string[],
  exclusions: readonly Exclusion[] = [],
  random: RandomInt = cryptoRandomInt,
): DrawResult {
  const n = participantIds.length;
  if (n < MIN_PARTICIPANTS) return { ok: false, reason: "not_enough_participants" };
  if (new Set(participantIds).size !== n) return { ok: false, reason: "duplicate_participants" };

  const index = new Map(participantIds.map((id, i) => [id, i]));
  const allowed: boolean[][] = participantIds.map((_, giver) =>
    participantIds.map((_, receiver) => giver !== receiver),
  );
  for (const [a, b] of exclusions) {
    const i = index.get(a);
    const j = index.get(b);
    if (i === undefined || j === undefined) continue;
    allowed[i][j] = false;
    allowed[j][i] = false;
  }

  if (!hasPerfectMatching(allowed, new Array(n).fill(-1), new Array(n).fill(false))) {
    return { ok: false, reason: "impossible" };
  }

  const receivers = sampleByRejection(allowed, random) ?? constructiveDraw(allowed, random);
  if (!receivers) return { ok: false, reason: "impossible" };

  return {
    ok: true,
    assignments: new Map(receivers.map((receiver, giver) => [participantIds[giver], participantIds[receiver]])),
  };
}

function shuffle<T>(items: T[], random: RandomInt): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function sampleByRejection(allowed: boolean[][], random: RandomInt): number[] | null {
  const n = allowed.length;
  const base = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < REJECTION_SAMPLING_ATTEMPTS; attempt++) {
    const perm = shuffle([...base], random);
    if (perm.every((receiver, giver) => allowed[giver][receiver])) return perm;
  }
  return null;
}

/**
 * Assigns givers one by one, picking a random receiver among those that still
 * leave a perfect matching for the remaining givers (checked with Kuhn's
 * augmenting paths). Polynomial and never needs backtracking.
 */
function constructiveDraw(allowed: boolean[][], random: RandomInt): number[] | null {
  const n = allowed.length;
  const fixedReceiverOf: number[] = new Array(n).fill(-1);
  const receiverTaken: boolean[] = new Array(n).fill(false);

  for (const giver of shuffle(
    Array.from({ length: n }, (_, i) => i),
    random,
  )) {
    const candidates = shuffle(
      Array.from({ length: n }, (_, r) => r).filter((r) => allowed[giver][r] && !receiverTaken[r]),
      random,
    );
    const choice = candidates.find((receiver) => {
      fixedReceiverOf[giver] = receiver;
      receiverTaken[receiver] = true;
      const feasible = hasPerfectMatching(allowed, fixedReceiverOf, receiverTaken);
      fixedReceiverOf[giver] = -1;
      receiverTaken[receiver] = false;
      return feasible;
    });
    if (choice === undefined) return null;
    fixedReceiverOf[giver] = choice;
    receiverTaken[choice] = true;
  }
  return fixedReceiverOf;
}

/** True if the givers without a fixed receiver can all be matched to free receivers. */
function hasPerfectMatching(allowed: boolean[][], fixedReceiverOf: number[], receiverTaken: boolean[]): boolean {
  const n = allowed.length;
  const matchOfReceiver: number[] = new Array(n).fill(-1);

  const tryAugment = (giver: number, visited: boolean[]): boolean => {
    for (let r = 0; r < n; r++) {
      if (!allowed[giver][r] || receiverTaken[r] || visited[r]) continue;
      visited[r] = true;
      if (matchOfReceiver[r] === -1 || tryAugment(matchOfReceiver[r], visited)) {
        matchOfReceiver[r] = giver;
        return true;
      }
    }
    return false;
  };

  for (let giver = 0; giver < n; giver++) {
    if (fixedReceiverOf[giver] !== -1) continue;
    if (!tryAugment(giver, new Array(n).fill(false))) return false;
  }
  return true;
}
