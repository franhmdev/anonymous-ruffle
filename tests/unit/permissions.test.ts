import { describe, expect, it } from "vitest";
import {
  canViewAllResults,
  canViewGroup,
  canViewOwnMatch,
  canViewWishlist,
  type GroupAccessInfo,
} from "@/lib/permissions";

const ADMIN = "admin-user";
const OTHER = "other-user";

const group = (overrides: Partial<GroupAccessInfo> = {}): GroupAccessInfo => ({
  adminId: ADMIN,
  status: "drawn",
  surpriseMode: false,
  surpriseRevealedAt: null,
  ...overrides,
});

const accepted = (userId: string) => ({ id: `participant-${userId}`, userId, status: "accepted" as const });
const pending = (userId: string) => ({ id: `participant-${userId}`, userId, status: "pending" as const });

describe("canViewGroup", () => {
  it("allows the admin and accepted participants", () => {
    expect(canViewGroup(group(), ADMIN, null)).toBe(true);
    expect(canViewGroup(group(), OTHER, accepted(OTHER))).toBe(true);
  });

  it("denies pending participants and strangers", () => {
    expect(canViewGroup(group(), OTHER, pending(OTHER))).toBe(false);
    expect(canViewGroup(group(), OTHER, null)).toBe(false);
  });

  it("denies a participant record that belongs to another user", () => {
    expect(canViewGroup(group(), OTHER, accepted("someone-else"))).toBe(false);
  });
});

describe("canViewAllResults", () => {
  it("is forbidden for anyone but the admin", () => {
    expect(canViewAllResults(group(), OTHER, accepted(OTHER))).toBe("forbidden");
  });

  it("requires the draw to have happened", () => {
    expect(canViewAllResults(group({ status: "draft" }), ADMIN, accepted(ADMIN))).toBe("not_drawn");
  });

  it("is allowed for the admin by default", () => {
    expect(canViewAllResults(group(), ADMIN, accepted(ADMIN))).toBe("allowed");
  });

  it("asks a participating admin for confirmation in surprise mode", () => {
    expect(canViewAllResults(group({ surpriseMode: true }), ADMIN, accepted(ADMIN))).toBe(
      "needs_surprise_confirmation",
    );
  });

  it("allows a participating admin in surprise mode once they have confirmed", () => {
    expect(
      canViewAllResults(group({ surpriseMode: true, surpriseRevealedAt: new Date() }), ADMIN, accepted(ADMIN)),
    ).toBe("allowed");
  });

  it("does not ask for confirmation when the admin is not participating", () => {
    expect(canViewAllResults(group({ surpriseMode: true }), ADMIN, null)).toBe("allowed");
  });
});

describe("canViewOwnMatch", () => {
  it("allows accepted participants after the draw", () => {
    expect(canViewOwnMatch(group(), OTHER, accepted(OTHER))).toBe(true);
  });

  it("denies before the draw, to pending participants and to strangers", () => {
    expect(canViewOwnMatch(group({ status: "draft" }), OTHER, accepted(OTHER))).toBe(false);
    expect(canViewOwnMatch(group(), OTHER, pending(OTHER))).toBe(false);
    expect(canViewOwnMatch(group(), OTHER, null)).toBe(false);
    expect(canViewOwnMatch(group(), OTHER, accepted("someone-else"))).toBe(false);
  });
});

describe("canViewWishlist", () => {
  it("allows the owner and their giver only", () => {
    expect(canViewWishlist("p1", "p1", null)).toBe(true);
    expect(canViewWishlist("p2", "p1", "p1")).toBe(true);
    expect(canViewWishlist("p3", "p1", "p2")).toBe(false);
    expect(canViewWishlist("p3", "p1", null)).toBe(false);
  });
});
