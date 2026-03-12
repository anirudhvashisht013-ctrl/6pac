import test from "node:test";
import assert from "node:assert/strict";
import {
  toPublicIdentityClaimBoundary,
  toPublicIdentityClaimDocument,
} from "@/lib/adapters/publicIdentityClaimAdapter";

test("public identity claim boundary isolates discoverability ownership", () => {
  const boundary = toPublicIdentityClaimBoundary({
    uid: "user-1",
    refId: "abc123",
    createdAt: "2026-03-12T00:00:00.000Z",
  });

  assert.equal(boundary?.claim.uid, "user-1");
  assert.equal(boundary?.claim.friendRefId, "abc123");
  assert.equal(boundary?.metadata.createdAt, "2026-03-12T00:00:00.000Z");
});

test("public identity claim boundary tolerates partial malformed docs", () => {
  const doc = toPublicIdentityClaimDocument({
    uid: 123 as never,
    refId: ["bad"] as never,
  });

  assert.equal(doc?.uid, undefined);
  assert.equal(doc?.refId, undefined);
});
