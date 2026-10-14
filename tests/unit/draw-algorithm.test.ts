import { describe, expect, it } from "vitest";
import { drawAssignments, type Exclusion } from "@/lib/draw/algorithm";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function expectValid(participants: string[], assignments: Map<string, string>, exclusions: Exclusion[] = []) {
  expect([...assignments.keys()].sort()).toEqual([...participants].sort());
  expect([...assignments.values()].sort()).toEqual([...participants].sort());
  for (const [giver, receiver] of assignments) {
    expect(giver).not.toBe(receiver);
    for (const [a, b] of exclusions) {
      expect([giver, receiver].sort()).not.toEqual([a, b].sort());
    }
  }
}

describe("drawAssignments", () => {
  it("requires at least 3 participants", () => {
    expect(drawAssignments(ids(2))).toEqual({ ok: false, reason: "not_enough_participants" });
    expect(drawAssignments([])).toEqual({ ok: false, reason: "not_enough_participants" });
  });

  it("rejects duplicated participants", () => {
    expect(drawAssignments(["a", "a", "b"])).toEqual({ ok: false, reason: "duplicate_participants" });
  });

  it("produces a valid permutation where nobody gives to themselves", () => {
    for (let n = 3; n <= 30; n++) {
      const participants = ids(n);
      const result = drawAssignments(participants);
      expect(result.ok).toBe(true);
      if (result.ok) expectValid(participants, result.assignments);
    }
  });

  it("respects exclusions in both directions", () => {
    const participants = ids(6);
    const exclusions: Exclusion[] = [
      ["p0", "p1"],
      ["p2", "p3"],
      ["p4", "p5"],
    ];
    for (let run = 0; run < 200; run++) {
      const result = drawAssignments(participants, exclusions);
      expect(result.ok).toBe(true);
      if (result.ok) expectValid(participants, result.assignments, exclusions);
    }
  });

  it("finds the only valid solution when constraints are very tight", () => {
    // With 4 people where p0 can only give to p1, etc., the constructive search must still succeed.
    const participants = ids(4);
    const exclusions: Exclusion[] = [
      ["p0", "p2"],
      ["p0", "p3"],
      ["p1", "p3"],
    ];
    for (let run = 0; run < 100; run++) {
      const result = drawAssignments(participants, exclusions);
      expect(result.ok).toBe(true);
      if (result.ok) expectValid(participants, result.assignments, exclusions);
    }
  });

  it("uses the constructive fallback when random sampling keeps failing", () => {
    const participants = ids(8);
    const exclusions: Exclusion[] = [
      ["p0", "p2"],
      ["p0", "p3"],
      ["p1", "p3"],
    ];
    // An RNG that always returns 0 makes every shuffled permutation the same.
    const result = drawAssignments(participants, exclusions, () => 0);
    expect(result.ok).toBe(true);
    if (result.ok) expectValid(participants, result.assignments, exclusions);
  });

  it("reports impossible draws instead of looping", () => {
    // p0 is excluded with everybody else.
    const participants = ids(4);
    const exclusions: Exclusion[] = [
      ["p0", "p1"],
      ["p0", "p2"],
      ["p0", "p3"],
    ];
    expect(drawAssignments(participants, exclusions)).toEqual({ ok: false, reason: "impossible" });
  });

  it("detects impossibility caused by a group of mutually excluded people (Hall's condition)", () => {
    // p0, p1 and p2 are all excluded among themselves in a group of 5:
    // the three of them must give to p3 and p4 only, which cannot work.
    const participants = ids(5);
    const exclusions: Exclusion[] = [
      ["p0", "p1"],
      ["p0", "p2"],
      ["p1", "p2"],
    ];
    expect(drawAssignments(participants, exclusions)).toEqual({ ok: false, reason: "impossible" });
  });

  it("ignores exclusions that reference unknown participants", () => {
    const participants = ids(3);
    const result = drawAssignments(participants, [["p0", "unknown"]]);
    expect(result.ok).toBe(true);
  });

  it("produces varied results (uses randomness)", () => {
    const participants = ids(6);
    const seen = new Set<string>();
    for (let run = 0; run < 50; run++) {
      const result = drawAssignments(participants);
      if (result.ok) seen.add(JSON.stringify([...result.assignments]));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("handles the maximum group size quickly", () => {
    const participants = ids(100);
    const exclusions: Exclusion[] = participants.slice(0, 50).map((id, i) => [id, participants[i + 50]] as const);
    const started = Date.now();
    const result = drawAssignments(participants, exclusions);
    expect(result.ok).toBe(true);
    if (result.ok) expectValid(participants, result.assignments, exclusions);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
