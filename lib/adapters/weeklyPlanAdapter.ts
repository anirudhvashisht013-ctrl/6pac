import type { ISODate } from "@/lib/models";
import type { DayStatus, WeekSchedule } from "@/lib/types";
import { getMondayYMD, getWeekDates } from "@/lib/dates";

export type DayAssignmentStatus = DayStatus;

export type DayAssignment = {
  date: ISODate;
  // Planner state only. Execution truth lives on workout sessions.
  status: DayAssignmentStatus;
  workoutTemplateId: string | null;
};

export type WeeklyPlan = {
  weekStartDate: ISODate;
  // Embedded day assignments remain the persisted shape for v1.
  days: DayAssignment[];
};

export type WeeklyPlanValidationIssue = {
  code:
    | "invalid_days_length"
    | "duplicate_day_date"
    | "invalid_day_status"
    | "day_outside_week"
    | "invalid_workout_template_id";
  message: string;
};

const VALID_DAY_STATUSES = new Set<DayAssignmentStatus>([
  "planned_workout",
  "rest",
  "unplanned",
]);

export function isDayAssignmentStatus(value: unknown): value is DayAssignmentStatus {
  return typeof value === "string" && VALID_DAY_STATUSES.has(value as DayAssignmentStatus);
}

function normalizeWorkoutTemplateId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toWeeklyPlan(schedule: WeekSchedule): WeeklyPlan {
  return {
    weekStartDate: schedule.weekStartDate as ISODate,
    days: schedule.days.map((day) => ({
      date: day.date as ISODate,
      status: day.status as DayAssignmentStatus,
      workoutTemplateId: day.workoutTemplateId ?? null,
    })),
  };
}

export function normalizeWeeklyPlan(plan: WeeklyPlan): WeeklyPlan {
  const expectedWeekStart = getMondayYMD(plan.weekStartDate);
  const expectedDates = getWeekDates(expectedWeekStart);
  const rawDays = Array.isArray(plan.days) ? plan.days : [];
  const dayByDate = new Map<ISODate, DayAssignment>();

  rawDays.forEach((day, index) => {
    const candidateDate =
      typeof day?.date === "string" && day.date.trim().length > 0
        ? (day.date.trim() as ISODate)
        : expectedDates[Math.min(index, expectedDates.length - 1)];
    const normalizedDate = expectedDates.includes(candidateDate)
      ? candidateDate
      : expectedDates[Math.min(index, expectedDates.length - 1)];

    dayByDate.set(normalizedDate, {
      date: normalizedDate,
      status: isDayAssignmentStatus(day?.status) ? day.status : "unplanned",
      workoutTemplateId: normalizeWorkoutTemplateId(day?.workoutTemplateId),
    });
  });

  return {
    weekStartDate: expectedWeekStart,
    days: expectedDates.map(
      (date) =>
        dayByDate.get(date) || {
          date,
          status: "unplanned",
          workoutTemplateId: null,
        }
    ),
  };
}

export function toWeekSchedule(plan: WeeklyPlan): WeekSchedule {
  const normalizedPlan = normalizeWeeklyPlan(plan);
  return {
    weekStartDate: normalizedPlan.weekStartDate,
    days: normalizedPlan.days.map((day) => ({
      date: day.date,
      status: day.status,
      workoutTemplateId: day.workoutTemplateId,
    })),
  };
}

export function getWeeklyPlanValidationIssues(plan: WeeklyPlan): WeeklyPlanValidationIssue[] {
  const issues: WeeklyPlanValidationIssue[] = [];
  const expectedWeekStart = getMondayYMD(plan.weekStartDate);
  const expectedDates = new Set(getWeekDates(expectedWeekStart));

  if (plan.days.length !== 7) {
    issues.push({
      code: "invalid_days_length",
      message: `Weekly plan ${plan.weekStartDate} has ${plan.days.length} days; expected 7.`,
    });
  }

  const seenDates = new Set<string>();
  for (const day of plan.days) {
    if (seenDates.has(day.date)) {
      issues.push({
        code: "duplicate_day_date",
        message: `Weekly plan ${plan.weekStartDate} contains duplicate day ${day.date}.`,
      });
    } else {
      seenDates.add(day.date);
    }

    if (!isDayAssignmentStatus(day.status)) {
      issues.push({
        code: "invalid_day_status",
        message: `Weekly plan ${plan.weekStartDate} contains invalid status for ${day.date}.`,
      });
    }

    if (!expectedDates.has(day.date)) {
      issues.push({
        code: "day_outside_week",
        message: `Weekly plan ${plan.weekStartDate} contains out-of-week day ${day.date}.`,
      });
    }

    if (day.workoutTemplateId != null && typeof day.workoutTemplateId !== "string") {
      issues.push({
        code: "invalid_workout_template_id",
        message: `Weekly plan ${plan.weekStartDate} contains invalid workoutTemplateId for ${day.date}.`,
      });
    }
  }

  return issues;
}
