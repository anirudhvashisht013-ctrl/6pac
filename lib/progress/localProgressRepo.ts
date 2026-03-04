import type { DailySnapshot, ISODate } from "@/lib/models";
import { getMondayYMD } from "@/lib/dates";
import type {
  DailyLog,
  MealEntry,
  WeeklyTarget,
  WorkoutSession,
} from "@/lib/types";

type DayAccumulator = {
  date: ISODate;
  weightKg: number | null;
  sleepHours: number | null;
  steps: number | null;
  waterMl: number | null;
  supplementsTaken: boolean | null;
  notes: string | null;
  caloriesManual: number | null;
  updatedAt?: string;
  mealCalories: number;
  mealProtein: number;
  mealCarbs: number;
  mealFat: number;
  hasMealCalories: boolean;
  hasMealProtein: boolean;
  hasMealCarbs: boolean;
  hasMealFat: boolean;
  completedSessions: {
    id: string;
    workoutNameSnapshot: string;
    startedAt: string;
    endedAt: string | null;
  }[];
};

type ProgressRepos = {
  logsRepo: {
    getRange(uid: string, start: string, end: string): Promise<DailyLog[]>;
  };
  mealsRepo: {
    getAll(uid: string): Promise<MealEntry[]>;
  };
  sessionsRepo: {
    getAll(uid: string): Promise<WorkoutSession[]>;
  };
  targetsRepo: {
    getAll(uid: string): Promise<WeeklyTarget[]>;
  };
};

function isInRange(date: string, start: ISODate, end: ISODate): date is ISODate {
  return date >= start && date <= end;
}

function toDurationMin(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

function getOrCreateDay(map: Map<ISODate, DayAccumulator>, date: ISODate): DayAccumulator {
  const existing = map.get(date);
  if (existing) return existing;

  const created: DayAccumulator = {
    date,
    weightKg: null,
    sleepHours: null,
    steps: null,
    waterMl: null,
    supplementsTaken: null,
    notes: null,
    caloriesManual: null,
    mealCalories: 0,
    mealProtein: 0,
    mealCarbs: 0,
    mealFat: 0,
    hasMealCalories: false,
    hasMealProtein: false,
    hasMealCarbs: false,
    hasMealFat: false,
    completedSessions: [],
  };
  map.set(date, created);
  return created;
}

export async function getProgressRange(
  uid: string,
  start: ISODate,
  end: ISODate,
  repos?: ProgressRepos
): Promise<DailySnapshot[]> {
  const resolvedRepos: ProgressRepos =
    repos ??
    (await import("@/lib/storage").then((storage) => ({
      logsRepo: storage.logsRepo,
      mealsRepo: storage.mealsRepo,
      sessionsRepo: storage.sessionsRepo,
      targetsRepo: storage.targetsRepo,
    })));

  const [logs, allMeals, allSessions, targets] = await Promise.all([
    resolvedRepos.logsRepo.getRange(uid, start, end),
    resolvedRepos.mealsRepo.getAll(uid),
    resolvedRepos.sessionsRepo.getAll(uid),
    resolvedRepos.targetsRepo.getAll(uid),
  ]);

  const meals = allMeals.filter((m) => isInRange(m.date, start, end));
  const sessions = allSessions.filter((s) => isInRange(s.date, start, end));
  const targetByWeek = new Map(targets.map((t) => [t.weekStartDate, t] as const));
  const dayMap = new Map<ISODate, DayAccumulator>();

  for (const log of logs) {
    const day = getOrCreateDay(dayMap, log.date as ISODate);
    day.weightKg = log.weightKg;
    day.sleepHours = log.sleepHours;
    day.steps = log.steps;
    day.waterMl = log.waterMl;
    day.supplementsTaken = log.supplementsTaken;
    day.notes = log.notes;
    day.caloriesManual = log.caloriesManual;
    day.updatedAt = log.updatedAt;
  }

  for (const meal of meals) {
    const day = getOrCreateDay(dayMap, meal.date as ISODate);

    if (meal.calories != null) {
      day.hasMealCalories = true;
      day.mealCalories += meal.calories;
    }
    if (meal.proteinG != null) {
      day.hasMealProtein = true;
      day.mealProtein += meal.proteinG;
    }
    if (meal.carbsG != null) {
      day.hasMealCarbs = true;
      day.mealCarbs += meal.carbsG;
    }
    if (meal.fatG != null) {
      day.hasMealFat = true;
      day.mealFat += meal.fatG;
    }
  }

  for (const session of sessions) {
    if (!session.completed) continue;
    const day = getOrCreateDay(dayMap, session.date as ISODate);
    day.completedSessions.push({
      id: session.id,
      workoutNameSnapshot: session.workoutNameSnapshot,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    });
  }

  return Array.from(dayMap.values())
    .map((day): DailySnapshot => {
      const manualCalories = day.caloriesManual;
      const calories =
        day.hasMealCalories || manualCalories != null
          ? day.mealCalories + (manualCalories ?? 0)
          : null;
      const proteinG = day.hasMealProtein ? day.mealProtein : null;
      const carbsG = day.hasMealCarbs ? day.mealCarbs : null;
      const fatG = day.hasMealFat ? day.mealFat : null;

      const completedSessions = day.completedSessions
        .slice()
        .sort((a, b) => {
          const aTime = Date.parse(a.endedAt || a.startedAt);
          const bTime = Date.parse(b.endedAt || b.startedAt);
          const aValue = Number.isNaN(aTime) ? 0 : aTime;
          const bValue = Number.isNaN(bTime) ? 0 : bTime;
          return aValue - bValue;
        });

      const workoutSessionIds = completedSessions.map((s) => s.id);
      const didWorkout = workoutSessionIds.length > 0;
      const workoutName = didWorkout
        ? completedSessions[completedSessions.length - 1]?.workoutNameSnapshot ?? null
        : null;

      let durationTotal = 0;
      let hasDuration = false;
      for (const session of completedSessions) {
        const duration = toDurationMin(session.startedAt, session.endedAt);
        if (duration == null) continue;
        hasDuration = true;
        durationTotal += duration;
      }
      const workoutMinutes = didWorkout ? (hasDuration ? durationTotal : null) : null;

      const weekTarget = targetByWeek.get(getMondayYMD(day.date));
      const hitCalories =
        weekTarget && calories != null
          ? calories >= weekTarget.dailyCaloriesTarget * 0.95 &&
            calories <= weekTarget.dailyCaloriesTarget * 1.05
          : null;
      const hitSteps =
        weekTarget && day.steps != null ? day.steps >= weekTarget.dailyStepsTarget : null;
      const hitWater =
        weekTarget && day.waterMl != null ? day.waterMl >= weekTarget.dailyWaterMlTarget : null;

      return {
        date: day.date,
        weightKg: day.weightKg,
        sleepHours: day.sleepHours,
        steps: day.steps,
        waterMl: day.waterMl,
        calories,
        proteinG,
        carbsG,
        fatG,
        didWorkout,
        workoutMinutes,
        workoutName,
        workoutSessionIds,
        hitCalories,
        hitProtein: null,
        hitSteps,
        hitWater,
        supplementsTaken: day.supplementsTaken,
        notes: day.notes,
        updatedAt: day.updatedAt,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
