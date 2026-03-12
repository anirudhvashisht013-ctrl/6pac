import test from "node:test";
import assert from "node:assert/strict";
import {
  getAccountProfileBridgeBoundary,
  getAccountProfileCoreBoundary,
  getAccountProfileProjectionBoundary,
  toAccountProfileBoundary,
} from "@/lib/adapters/accountProfileAdapter";

test("account profile boundary separates core, bridge, and projection semantics", () => {
  const boundary = toAccountProfileBoundary({
    uid: "user-1",
    email: "test@example.com",
    onboardingDone: true,
    fullName: "Test User",
    friendRefId: "abc123",
    currentStreakDays: 4,
    maxStreakDays: 12,
  });

  assert.equal(boundary?.core.uid, "user-1");
  assert.equal(boundary?.core.email, "test@example.com");
  assert.equal(boundary?.bridge.friendRefId, "abc123");
  assert.equal(boundary?.projection.currentStreakDays, 4);
  assert.equal(boundary?.projection.maxStreakDays, 12);
});

test("account profile boundary tolerates partial profile docs", () => {
  const core = getAccountProfileCoreBoundary({
    onboardingDone: "yes" as never,
    fullName: "Partial User",
    friendRefId: 123 as never,
  });
  const bridge = getAccountProfileBridgeBoundary({
    onboardingDone: false,
    friendRefId: 123 as never,
  });
  const projection = getAccountProfileProjectionBoundary({
    onboardingDone: false,
    currentStreakDays: "4" as never,
  });

  assert.equal(core?.onboardingDone, false);
  assert.equal(core?.fullName, "Partial User");
  assert.equal(bridge?.friendRefId, undefined);
  assert.equal(projection?.currentStreakDays, undefined);
});
