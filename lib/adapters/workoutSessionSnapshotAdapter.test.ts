import test from "node:test";
import assert from "node:assert/strict";
import type { WorkoutBlock, WorkoutSession } from "@/lib/types";
import {
  getWorkoutSessionExecutionState,
  getWorkoutSessionSnapshotBoundary,
  normalizeWorkoutSessionRecord,
  prepareWorkoutSessionForSave,
} from "@/lib/adapters/workoutSessionSnapshotAdapter";

function makeBlocks(): WorkoutBlock[] {
  return [
    {
      id: "gym-1",
      type: "gym",
      exerciseId: "ex-1",
      exerciseName: "Bench Press",
      sets: 2,
    },
    {
      id: "rest-1",
      type: "rest",
      label: "Rest",
      seconds: 60,
    },
  ];
}

function makeSession(partial?: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: "session-1",
    date: "2026-03-12",
    workoutTemplateId: "template-1",
    workoutNameSnapshot: "Upper Body",
    sessionBlocks: makeBlocks(),
    startedAt: "2026-03-12T08:00:00.000Z",
    endedAt: null,
    completed: false,
    blockPerformances: [
      {
        blockId: "gym-1",
        completed: false,
        sets: [
          { weight: null, reps: null, completed: false },
          { weight: null, reps: null, completed: false },
        ],
      },
      {
        blockId: "rest-1",
        completed: false,
      },
    ],
    ...partial,
  };
}

test("normalizeWorkoutSessionRecord keeps execution snapshot usable for malformed legacy rows", () => {
  const normalized = normalizeWorkoutSessionRecord(
    makeSession({
      workoutNameSnapshot: "" as never,
      sessionBlocks: makeBlocks(),
      blockPerformances: [] as never,
    }),
    {
      fallback: {
        workoutName: "Recovered Workout",
        blocks: makeBlocks(),
      },
      context: "test",
    }
  );

  assert.equal(normalized.workoutNameSnapshot, "Recovered Workout");
  assert.equal(normalized.blockPerformances.length, 2);
  assert.equal(normalized.blockPerformances[0]?.blockId, "gym-1");
  assert.equal(normalized.blockPerformances[1]?.blockId, "rest-1");
});

test("prepareWorkoutSessionForSave preserves stable execution fields from existing session", () => {
  const existing = makeSession();
  const prepared = prepareWorkoutSessionForSave(
    makeSession({
      id: "session-1",
      date: "" as never,
      startedAt: "" as never,
      workoutNameSnapshot: "" as never,
      sessionBlocks: undefined,
      blockPerformances: undefined as never,
    }),
    {
      existingSession: existing,
      context: "test-save",
    }
  );

  assert.equal(prepared.date, existing.date);
  assert.equal(prepared.startedAt, existing.startedAt);
  assert.equal(prepared.workoutNameSnapshot, existing.workoutNameSnapshot);
  assert.deepEqual(prepared.sessionBlocks, existing.sessionBlocks);
  assert.deepEqual(prepared.blockPerformances, existing.blockPerformances);
});

test("completed execution state wins over missed flag", () => {
  const session = normalizeWorkoutSessionRecord(
    makeSession({
      completed: true,
      missed: true,
      endedAt: "2026-03-12T09:00:00.000Z",
    }),
    { context: "test-state" }
  );

  assert.equal(session.missed, false);
  assert.equal(getWorkoutSessionExecutionState(session), "completed");
});

test("snapshot boundary falls back to template blocks and display name when needed", () => {
  const boundary = getWorkoutSessionSnapshotBoundary(
    makeSession({
      workoutNameSnapshot: "" as never,
      sessionBlocks: undefined,
      blockPerformances: [] as never,
    }),
    {
      workoutTemplateId: "template-1",
      workoutName: "Fallback Template",
      blocks: makeBlocks(),
    }
  );

  assert.equal(boundary.workoutNameSnapshot, "Fallback Template");
  assert.equal(boundary.executionState, "in_progress");
  assert.equal(boundary.sessionBlocks?.length, 2);
  assert.equal(boundary.blockPerformances.length, 2);
});
