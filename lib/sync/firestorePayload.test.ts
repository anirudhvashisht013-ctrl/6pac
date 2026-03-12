import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeFirestorePayload,
  summarizeFirestorePayloadShape,
} from "@/lib/sync/firestorePayload";

test("sanitizeFirestorePayload strips nested undefined and preserves null", () => {
  const original = {
    id: "template-1",
    notes: null,
    blocks: [
      {
        id: "block-1",
        type: "gym",
        exerciseId: "exercise-1",
        sets: undefined,
        repsOption: undefined,
        referenceVideoUrls: ["https://example.com/demo", undefined],
      },
      undefined,
      {
        id: "block-2",
        type: "rest",
        seconds: 60,
        label: null,
      },
    ],
  };

  const sanitized = sanitizeFirestorePayload(original);

  assert.deepEqual(sanitized, {
    id: "template-1",
    notes: null,
    blocks: [
      {
        id: "block-1",
        type: "gym",
        exerciseId: "exercise-1",
        referenceVideoUrls: ["https://example.com/demo"],
      },
      {
        id: "block-2",
        type: "rest",
        seconds: 60,
        label: null,
      },
    ],
  });

  assert.equal(original.blocks.length, 3);
  assert.equal("sets" in (original.blocks[0] as Record<string, unknown>), true);
});

test("sanitizeFirestorePayload strips undefined from workout-session-like payloads", () => {
  const sanitized = sanitizeFirestorePayload({
    id: "session-1",
    workoutNameSnapshot: "Push Day",
    sessionBlocks: [
      {
        id: "block-1",
        type: "gym",
        exerciseId: "exercise-1",
        notes: undefined,
      },
    ],
    blockPerformances: [
      {
        blockId: "block-1",
        completed: false,
        exerciseIdOverride: undefined,
        sets: [
          { weight: null, reps: null, completed: false },
          undefined,
        ],
      },
    ],
  });

  assert.deepEqual(sanitized, {
    id: "session-1",
    workoutNameSnapshot: "Push Day",
    sessionBlocks: [
      {
        id: "block-1",
        type: "gym",
        exerciseId: "exercise-1",
      },
    ],
    blockPerformances: [
      {
        blockId: "block-1",
        completed: false,
        sets: [{ weight: null, reps: null, completed: false }],
      },
    ],
  });
});

test("summarizeFirestorePayloadShape returns compact debug output", () => {
  const summary = summarizeFirestorePayloadShape({
    id: "template-1",
    blocks: [{ id: "block-1", type: "gym", sets: undefined }],
  });

  assert.match(summary, /\{id:string,blocks:\[1:/);
});
