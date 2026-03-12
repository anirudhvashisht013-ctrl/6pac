import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDailySummaryProjection,
  DAILY_SUMMARY_PROJECTION_SOURCES,
  type DailySummaryProjectionSnapshot,
} from "@/lib/projections/dailySummaryProjection";

function makeSnapshot(): DailySummaryProjectionSnapshot {
  return {
    logs: [
      {
        date: "2026-03-12",
        weightKg: 82,
        sleepHours: 7,
        waterMl: 2500,
        steps: 9000,
        supplementsTaken: true,
        caloriesManual: 200,
        notes: null,
        updatedAt: "2026-03-12T08:00:00.000Z",
      },
    ],
    meals: [
      {
        id: "meal-1",
        date: "2026-03-12",
        mealName: "Lunch",
        notes: null,
        calories: 600,
        proteinG: 40,
        carbsG: 50,
        fatG: 20,
        createdAt: "2026-03-12T12:00:00.000Z",
        updatedAt: "2026-03-12T12:00:00.000Z",
      },
    ],
    targets: [
      {
        weekStartDate: "2026-03-09",
        dailyCaloriesTarget: 2000,
        dailyStepsTarget: 8000,
        dailyWaterMlTarget: 2200,
        targetWeightKg: null,
        weightGoalType: "maintain",
        createdAt: "2026-03-09T00:00:00.000Z",
        updatedAt: "2026-03-09T00:00:00.000Z",
      },
    ],
    schedules: [
      {
        weekStartDate: "2026-03-09",
        days: [
          { date: "2026-03-09", status: "unplanned", workoutTemplateId: null },
          { date: "2026-03-10", status: "unplanned", workoutTemplateId: null },
          { date: "2026-03-11", status: "unplanned", workoutTemplateId: null },
          { date: "2026-03-12", status: "planned_workout", workoutTemplateId: "tmpl-1" },
          { date: "2026-03-13", status: "rest", workoutTemplateId: null },
          { date: "2026-03-14", status: "unplanned", workoutTemplateId: null },
          { date: "2026-03-15", status: "unplanned", workoutTemplateId: null },
        ],
      },
    ],
    templates: [],
    exercises: [],
    sessions: [
      {
        id: "session-1",
        date: "2026-03-12",
        workoutTemplateId: "tmpl-1",
        workoutNameSnapshot: "Push",
        startedAt: "2026-03-12T18:00:00.000Z",
        endedAt: "2026-03-12T18:45:00.000Z",
        completed: true,
        blockPerformances: [],
      },
    ],
    measurements: [],
    reminders: null,
  };
}

test("daily summary projection remains derived from canonical entities", () => {
  assert.deepEqual(DAILY_SUMMARY_PROJECTION_SOURCES, [
    "DailyCheckIn",
    "NutritionEntry",
    "WorkoutSession",
    "WeeklyTarget",
    "WeeklyPlan",
  ]);

  const summary = buildDailySummaryProjection(makeSnapshot(), "2026-03-12");

  assert.equal(summary.date, "2026-03-12");
  assert.equal(summary.nutrition.calories, 800);
  assert.equal(summary.workouts.completedSessions, 1);
  assert.equal(summary.weekly.plan.status, "planned_workout");
  assert.equal(summary.tallies.plannedWorkoutCompleted, true);
});
