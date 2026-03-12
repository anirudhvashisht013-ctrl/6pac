import { getMondayYMD, getWeekDates } from "@/lib/dates";
import type { ISODate } from "@/lib/models";
import type {
  DailyLog,
  DailySummaryMirrorDoc,
  ExerciseLibraryItem,
  MealEntry,
  ReminderState,
  WeekSchedule,
  WeeklyTarget,
  WorkoutSession,
  WorkoutTemplate,
  BodyMeasurementEntry,
} from "@/lib/types";

export const DAILY_SUMMARY_PROJECTION_SOURCES = [
  "DailyCheckIn",
  "NutritionEntry",
  "WorkoutSession",
  "WeeklyTarget",
  "WeeklyPlan",
] as const;

type DailySummarySnapshotProvider = (uid: string) => Promise<LocalDataSnapshot>;

export type DailySummaryProjectionSnapshot = {
  logs: DailyLog[];
  meals: MealEntry[];
  targets: WeeklyTarget[];
  schedules: WeekSchedule[];
  templates: WorkoutTemplate[];
  exercises: ExerciseLibraryItem[];
  sessions: WorkoutSession[];
  measurements: BodyMeasurementEntry[];
  reminders: ReminderState | null;
};

type LocalDataSnapshot = DailySummaryProjectionSnapshot;

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function maxIso(values: Array<string | null | undefined>): string | null {
  let bestMs = Number.NaN;
  let bestIso: string | null = null;
  for (const value of values) {
    const ms = parseIsoMs(value);
    if (ms == null) continue;
    if (!Number.isFinite(bestMs) || ms > bestMs) {
      bestMs = ms;
      bestIso = new Date(ms).toISOString();
    }
  }
  return bestIso;
}

function sessionDurationMinutes(session: LocalDataSnapshot["sessions"][number]): number | null {
  if (!session.endedAt) return null;
  const startMs = parseIsoMs(session.startedAt);
  const endMs = parseIsoMs(session.endedAt);
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

/**
 * Materialized daily projection only.
 * This doc is derived from canonical source entities and must never become
 * business truth for logs, nutrition, workouts, targets, or plans.
 */
export function buildDailySummaryProjection(
  snapshot: LocalDataSnapshot,
  date: string
): DailySummaryMirrorDoc {
  const weekStartDate = getMondayYMD(date as ISODate);
  const log = snapshot.logs.find((x) => x.date === date) || null;
  const meals = snapshot.meals.filter((x) => x.date === date);
  const sessions = snapshot.sessions.filter((x) => x.date === date);
  const target = snapshot.targets.find((x) => x.weekStartDate === weekStartDate) || null;
  const schedule = snapshot.schedules.find((x) => x.weekStartDate === weekStartDate) || null;
  const plannedDay = schedule?.days.find((x) => x.date === date) || null;

  let mealCalories = 0;
  let mealProtein = 0;
  let mealCarbs = 0;
  let mealFat = 0;
  let hasCalories = false;
  let hasProtein = false;
  let hasCarbs = false;
  let hasFat = false;

  for (const meal of meals) {
    if (meal.calories != null) {
      hasCalories = true;
      mealCalories += meal.calories;
    }
    if (meal.proteinG != null) {
      hasProtein = true;
      mealProtein += meal.proteinG;
    }
    if (meal.carbsG != null) {
      hasCarbs = true;
      mealCarbs += meal.carbsG;
    }
    if (meal.fatG != null) {
      hasFat = true;
      mealFat += meal.fatG;
    }
  }

  const manualCalories = log?.caloriesManual ?? null;
  const totalCalories =
    hasCalories || manualCalories != null ? mealCalories + (manualCalories || 0) : null;

  const completedSessions = sessions.filter((x) => x.completed);
  const missedSessions = sessions.filter((x) => !!x.missed);
  let totalWorkoutMinutes = 0;
  let hasWorkoutDuration = false;
  for (const session of completedSessions) {
    const minutes = sessionDurationMinutes(session);
    if (minutes == null) continue;
    hasWorkoutDuration = true;
    totalWorkoutMinutes += minutes;
  }
  const workoutMinutes =
    completedSessions.length > 0 ? (hasWorkoutDuration ? totalWorkoutMinutes : null) : null;

  const caloriesOnTarget =
    target && totalCalories != null
      ? totalCalories >= target.dailyCaloriesTarget * 0.95 &&
        totalCalories <= target.dailyCaloriesTarget * 1.05
      : null;
  const stepsOnTarget =
    target && log?.steps != null ? log.steps >= target.dailyStepsTarget : null;
  const waterOnTarget =
    target && log?.waterMl != null ? log.waterMl >= target.dailyWaterMlTarget : null;
  const plannedWorkoutCompleted =
    plannedDay?.status === "planned_workout" ? completedSessions.length > 0 : null;

  return {
    id: date,
    date,
    version: 1,
    log: {
      weightKg: log?.weightKg ?? null,
      sleepHours: log?.sleepHours ?? null,
      steps: log?.steps ?? null,
      waterMl: log?.waterMl ?? null,
      supplementsTaken: log?.supplementsTaken ?? null,
      caloriesManual: log?.caloriesManual ?? null,
      updatedAt: log?.updatedAt ?? null,
    },
    nutrition: {
      mealCount: meals.length,
      calories: totalCalories,
      proteinG: hasProtein ? mealProtein : null,
      carbsG: hasCarbs ? mealCarbs : null,
      fatG: hasFat ? mealFat : null,
      lastMealUpdateAt: maxIso(meals.map((x) => x.updatedAt || x.createdAt || null)),
    },
    workouts: {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      missedSessions: missedSessions.length,
      workoutMinutes,
      sessionIds: sessions.map((x) => x.id),
      lastSessionUpdateAt: maxIso(
        sessions.map((x) => x.endedAt || x.startedAt || null)
      ),
    },
    weekly: {
      weekStartDate,
      target: {
        dailyCaloriesTarget: target?.dailyCaloriesTarget ?? null,
        dailyStepsTarget: target?.dailyStepsTarget ?? null,
        dailyWaterMlTarget: target?.dailyWaterMlTarget ?? null,
        targetWeightKg: target?.targetWeightKg ?? null,
        weightGoalType: target?.weightGoalType ?? null,
        updatedAt: target?.updatedAt ?? null,
      },
      plan: {
        status: plannedDay?.status ?? null,
        workoutTemplateId: plannedDay?.workoutTemplateId ?? null,
      },
    },
    tallies: {
      caloriesOnTarget,
      stepsOnTarget,
      waterOnTarget,
      plannedWorkoutCompleted,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Write-only projection boundary for `daily_summaries`.
 * No read helpers are exposed on purpose; canonical reads should come from
 * logs, meals, sessions, weekly targets, and weekly plans.
 */
export async function refreshDailySummaryProjection(
  uid: string,
  date: string,
  options: {
    getSnapshot: DailySummarySnapshotProvider;
    snapshot?: LocalDataSnapshot;
  }
): Promise<void> {
  const source = options.snapshot || (await options.getSnapshot(uid));
  const summary = buildDailySummaryProjection(source, date);
  const { cloudMirrorRepo } = await import("@/lib/repos/cloudMirrorRepo");
  await cloudMirrorRepo.upsertDailySummaryProjection(uid, summary);
}

export async function refreshWeeklyDailySummaryProjection(
  uid: string,
  weekStartDate: string,
  options: {
    getSnapshot: DailySummarySnapshotProvider;
    snapshot?: LocalDataSnapshot;
  }
): Promise<void> {
  const source = options.snapshot || (await options.getSnapshot(uid));
  for (const date of getWeekDates(weekStartDate as ISODate)) {
    await refreshDailySummaryProjection(uid, date, {
      getSnapshot: options.getSnapshot,
      snapshot: source,
    });
  }
}
