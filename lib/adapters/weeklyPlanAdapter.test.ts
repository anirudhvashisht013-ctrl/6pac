import test from "node:test";
import assert from "node:assert/strict";
import {
  getWeeklyPlanValidationIssues,
  normalizeWeeklyPlan,
  toWeekSchedule,
  type WeeklyPlan,
} from "@/lib/adapters/weeklyPlanAdapter";

test("normalizeWeeklyPlan returns a full seven-day planner week", () => {
  const plan: WeeklyPlan = {
    weekStartDate: "2026-03-02",
    days: [
      { date: "2026-03-02", status: "planned_workout", workoutTemplateId: "tmpl-1" },
      { date: "2026-03-02", status: "rest", workoutTemplateId: "  " },
      { date: "2026-03-10", status: "planned_workout", workoutTemplateId: "tmpl-2" },
      { date: "2026-03-05", status: "bad-status" as never, workoutTemplateId: 123 as never },
    ],
  };

  const normalized = normalizeWeeklyPlan(plan);

  assert.equal(normalized.weekStartDate, "2026-03-02");
  assert.equal(normalized.days.length, 7);
  assert.deepEqual(
    normalized.days.map((day) => day.date),
    [
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]
  );
  assert.equal(normalized.days[0]?.status, "rest");
  assert.equal(normalized.days[0]?.workoutTemplateId, null);
  assert.equal(normalized.days[3]?.status, "unplanned");
  assert.equal(normalized.days[3]?.workoutTemplateId, null);
});

test("weekly plan validation reports malformed planner state", () => {
  const issues = getWeeklyPlanValidationIssues({
    weekStartDate: "2026-03-02",
    days: [
      { date: "2026-03-02", status: "planned_workout", workoutTemplateId: "tmpl-1" },
      { date: "2026-03-02", status: "bad-status" as never, workoutTemplateId: 123 as never },
    ],
  });

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["invalid_days_length", "duplicate_day_date", "invalid_day_status", "invalid_workout_template_id"]
  );
});

test("toWeekSchedule preserves embedded planner-day shape after normalization", () => {
  const schedule = toWeekSchedule(
    normalizeWeeklyPlan({
      weekStartDate: "2026-03-05",
      days: [
        { date: "2026-03-05", status: "planned_workout", workoutTemplateId: "tmpl-1" },
      ],
    })
  );

  assert.equal(schedule.weekStartDate, "2026-03-02");
  assert.equal(schedule.days.length, 7);
  assert.equal(schedule.days[0]?.date, "2026-03-02");
  assert.equal(schedule.days[0]?.status, "unplanned");
  assert.equal(schedule.days[3]?.date, "2026-03-05");
  assert.equal(schedule.days[3]?.status, "planned_workout");
  assert.equal(schedule.days[3]?.workoutTemplateId, "tmpl-1");
});
