import test from "node:test";
import assert from "node:assert/strict";
import { getProgressRange } from "@/lib/progress/localProgressRepo";
import type { DailyLog, MealEntry, WeeklyTarget, WorkoutSession } from "@/lib/types";

function makeLog(date: string, partial?: Partial<DailyLog>): DailyLog {
  return {
    date,
    weightKg: null,
    sleepHours: null,
    waterMl: null,
    steps: null,
    supplementsTaken: null,
    caloriesManual: null,
    notes: null,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function makeMeal(id: string, date: string, partial?: Partial<MealEntry>): MealEntry {
  const now = new Date().toISOString();
  return {
    id,
    date,
    mealName: "Meal",
    notes: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function makeSession(id: string, date: string, partial?: Partial<WorkoutSession>): WorkoutSession {
  return {
    id,
    date,
    workoutTemplateId: "template",
    workoutNameSnapshot: "Workout",
    startedAt: `${date}T06:00:00.000Z`,
    endedAt: `${date}T07:00:00.000Z`,
    completed: true,
    blockPerformances: [],
    ...partial,
  };
}

function makeTarget(weekStartDate: string, partial?: Partial<WeeklyTarget>): WeeklyTarget {
  const now = new Date().toISOString();
  return {
    weekStartDate,
    dailyCaloriesTarget: 2000,
    dailyStepsTarget: 8000,
    dailyWaterMlTarget: 2500,
    weightGoalType: "maintain",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

test("getProgressRange builds local-first daily snapshots from logs/meals/sessions/targets", async () => {
  const repos = {
    logsRepo: {
      getRange: async () => [
      makeLog("2026-03-01", {
        weightKg: 80.4,
        sleepHours: 7.2,
        steps: 8200,
        waterMl: 2600,
        supplementsTaken: true,
        caloriesManual: 200,
        notes: "good day",
      }),
      makeLog("2026-03-03", {
        steps: 5000,
        waterMl: 1200,
      }),
      ],
    },

    mealsRepo: {
      getAll: async () => [
      makeMeal("m-1", "2026-03-01", { calories: 500, proteinG: 40, carbsG: 50, fatG: 20 }),
      makeMeal("m-2", "2026-03-01", { calories: 700, proteinG: 50, carbsG: 80, fatG: 30 }),
      makeMeal("m-3", "2026-03-02", { calories: 400, proteinG: 20, carbsG: 45, fatG: 15 }),
      makeMeal("m-out", "2026-03-08", { calories: 999 }),
      ],
    },

    sessionsRepo: {
      getAll: async () => [
      makeSession("s-1", "2026-03-01", {
        workoutNameSnapshot: "Strength",
        startedAt: "2026-03-01T06:00:00.000Z",
        endedAt: "2026-03-01T07:00:00.000Z",
      }),
      makeSession("s-2", "2026-03-01", {
        workoutNameSnapshot: "Cardio",
        startedAt: "2026-03-01T18:00:00.000Z",
        endedAt: "2026-03-01T18:30:00.000Z",
      }),
      makeSession("s-3", "2026-03-02", {
        completed: false,
        endedAt: null,
      }),
      makeSession("s-4", "2026-03-02", {
        workoutNameSnapshot: "Mobility",
        endedAt: null,
      }),
      makeSession("s-out", "2026-03-10", {}),
      ],
    },

    targetsRepo: {
      getAll: async () => [
      makeTarget("2026-02-23", {
        dailyCaloriesTarget: 1400,
        dailyStepsTarget: 8000,
        dailyWaterMlTarget: 2500,
      }),
      makeTarget("2026-03-02", {
        dailyCaloriesTarget: 2000,
        dailyStepsTarget: 7000,
        dailyWaterMlTarget: 2000,
      }),
      ],
    },
  };

  const rows = await getProgressRange("uid-1", "2026-03-01", "2026-03-03", repos);
  assert.deepEqual(rows.map((row) => row.date), ["2026-03-01", "2026-03-02", "2026-03-03"]);

  const day1 = rows[0];
  assert.equal(day1.calories, 1400);
  assert.equal(day1.proteinG, 90);
  assert.equal(day1.carbsG, 130);
  assert.equal(day1.fatG, 50);
  assert.equal(day1.didWorkout, true);
  assert.equal(day1.workoutMinutes, 90);
  assert.equal(day1.workoutName, "Cardio");
  assert.deepEqual(day1.workoutSessionIds, ["s-1", "s-2"]);
  assert.equal(day1.hitCalories, true);
  assert.equal(day1.hitSteps, true);
  assert.equal(day1.hitWater, true);
  assert.equal(day1.hitProtein, null);
  assert.equal(day1.notes, "good day");

  const day2 = rows[1];
  assert.equal(day2.calories, 400);
  assert.equal(day2.didWorkout, true);
  assert.equal(day2.workoutMinutes, null);
  assert.equal(day2.workoutName, "Mobility");
  assert.deepEqual(day2.workoutSessionIds, ["s-4"]);
  assert.equal(day2.hitCalories, false);
  assert.equal(day2.hitSteps, null);
  assert.equal(day2.hitWater, null);

  const day3 = rows[2];
  assert.equal(day3.calories, null);
  assert.equal(day3.didWorkout, false);
  assert.equal(day3.workoutMinutes, null);
  assert.equal(day3.hitCalories, null);
  assert.equal(day3.hitSteps, false);
  assert.equal(day3.hitWater, false);
});
