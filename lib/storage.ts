import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User, DailyLog, MealEntry, WeeklyTarget,
  WeekSchedule, WorkoutTemplate, WorkoutSession, BodyMeasurementEntry, ExerciseLibraryItem, ReminderState,
  ReminderSettingsMirrorDoc, DailySummaryMirrorDoc,
} from './types';
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import { removeSharedWorkoutTemplate, syncSharedWorkoutTemplate } from "@/lib/friends/sharedWorkoutsRepo";
import {
  getMeasurementByDate,
  getMeasurementRange,
} from "@/lib/measurements/localMeasurementsQuery";
import { emitDataEvent } from "@/lib/dataEvents";
import { getMondayYMD, getWeekDates, todayYMD } from "@/lib/dates";
import type { ISODate } from "@/lib/models";

const KEY = {
  users: '@6pac:users',
  sessionToken: '@6pac:session_token',
  currentUserId: '@6pac:current_user_id',
  logs: (uid: string) => `@6pac:logs:${uid}`,
  targets: (uid: string) => `@6pac:targets:${uid}`,
  schedules: (uid: string) => `@6pac:schedules:${uid}`,
  templates: (uid: string) => `@6pac:templates:${uid}`,
  exercises: (uid: string) => `@6pac:exercises:${uid}`,
  meals: (uid: string) => `@6pac:meals:${uid}`,
  sessions: (uid: string) => `@6pac:sessions:${uid}`,
  measurements: (uid: string) => `@6pac:measurements:${uid}`,
  reminders: (uid: string) => `@6pac:reminders:${uid}`,
};

async function get<T>(key: string): Promise<T | null> {
  const val = await AsyncStorage.getItem(key);
  if (!val) return null;
  return JSON.parse(val) as T;
}

async function set<T>(key: string, val: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(val));
}

function mirrorBestEffort(task: Promise<void>, label: string) {
  void task.catch((err) => {
    console.warn(`[cloud-mirror] ${label} failed`, err);
  });
}

function toReminderSettingsDoc(state: ReminderState): ReminderSettingsMirrorDoc {
  return {
    id: "primary",
    version: 1,
    settings: state.settings,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

function normalizeTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    notes: typeof template.notes === 'string' ? template.notes : null,
    sharedWithFriends: template.sharedWithFriends !== false,
  };
}

function normalizeSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    sessionBlocks: Array.isArray(session.sessionBlocks) ? session.sessionBlocks : undefined,
    missed: !!session.missed,
  };
}

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

function sessionDurationMinutes(session: WorkoutSession): number | null {
  if (!session.endedAt) return null;
  const startMs = parseIsoMs(session.startedAt);
  const endMs = parseIsoMs(session.endedAt);
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

function buildDailySummaryDoc(snapshot: LocalDataSnapshot, date: string): DailySummaryMirrorDoc {
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

async function syncDailySummary(uid: string, date: string, snapshot?: LocalDataSnapshot): Promise<void> {
  const source = snapshot || (await localCacheRepo.getSnapshot(uid));
  const summary = buildDailySummaryDoc(source, date);
  await cloudMirrorRepo.upsertDailySummary(uid, summary);
}

async function syncWeekDailySummaries(uid: string, weekStartDate: string): Promise<void> {
  const source = await localCacheRepo.getSnapshot(uid);
  for (const date of getWeekDates(weekStartDate as ISODate)) {
    await syncDailySummary(uid, date, source);
  }
}

export type LocalDataSnapshot = {
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

export const localCacheRepo = {
  async getSnapshot(uid: string): Promise<LocalDataSnapshot> {
    const [logs, meals, targets, schedules, templates, exercises, sessions, measurements, reminders] = await Promise.all([
      get<DailyLog[]>(KEY.logs(uid)),
      get<MealEntry[]>(KEY.meals(uid)),
      get<WeeklyTarget[]>(KEY.targets(uid)),
      get<WeekSchedule[]>(KEY.schedules(uid)),
      get<WorkoutTemplate[]>(KEY.templates(uid)),
      get<ExerciseLibraryItem[]>(KEY.exercises(uid)),
      get<WorkoutSession[]>(KEY.sessions(uid)),
      get<BodyMeasurementEntry[]>(KEY.measurements(uid)),
      get<ReminderState>(KEY.reminders(uid)),
    ]);

    return {
      logs: logs || [],
      meals: meals || [],
      targets: targets || [],
      schedules: schedules || [],
      templates: templates || [],
      exercises: exercises || [],
      sessions: sessions || [],
      measurements: measurements || [],
      reminders: reminders || null,
    };
  },

  async setSnapshot(uid: string, data: LocalDataSnapshot): Promise<void> {
    await Promise.all([
      set(KEY.logs(uid), data.logs),
      set(KEY.meals(uid), data.meals),
      set(KEY.targets(uid), data.targets),
      set(KEY.schedules(uid), data.schedules),
      set(KEY.templates(uid), data.templates),
      set(KEY.exercises(uid), data.exercises),
      set(KEY.sessions(uid), data.sessions),
      set(KEY.measurements(uid), data.measurements),
      set(KEY.reminders(uid), data.reminders),
    ]);
  },
};

export const usersRepo = {
  async getAll(): Promise<User[]> {
    return (await get<User[]>(KEY.users)) || [];
  },
  async getById(id: string): Promise<User | null> {
    const all = await this.getAll();
    return all.find(u => u.id === id) || null;
  },
  async getByEmail(email: string): Promise<User | null> {
    const all = await this.getAll();
    return all.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  async save(user: User): Promise<void> {
    const all = await this.getAll();
    const idx = all.findIndex(u => u.id === user.id);
    if (idx >= 0) all[idx] = user;
    else all.push(user);
    await set(KEY.users, all);
  },
};

export const sessionRepo = {
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEY.sessionToken);
  },
  async getUserId(): Promise<string | null> {
    return AsyncStorage.getItem(KEY.currentUserId);
  },
  async save(userId: string, token: string): Promise<void> {
    await AsyncStorage.setItem(KEY.sessionToken, token);
    await AsyncStorage.setItem(KEY.currentUserId, userId);
  },
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([KEY.sessionToken, KEY.currentUserId]);
  },
};

export const logsRepo = {
  async getAll(uid: string): Promise<DailyLog[]> {
    return (await get<DailyLog[]>(KEY.logs(uid))) || [];
  },
  async getByDate(uid: string, date: string): Promise<DailyLog | null> {
    const all = await this.getAll(uid);
    return all.find(l => l.date === date) || null;
  },
  async getRange(uid: string, start: string, end: string): Promise<DailyLog[]> {
    const all = await this.getAll(uid);
    return all
      .filter((l) => l.date >= start && l.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  async save(uid: string, log: DailyLog): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex(l => l.date === log.date);
    if (idx >= 0) all[idx] = log;
    else all.push(log);
    await set(KEY.logs(uid), all);
    emitDataEvent(uid, "logs");
    mirrorBestEffort(cloudMirrorRepo.upsertLog(uid, log), `logs/${log.date}`);
    mirrorBestEffort(syncDailySummary(uid, log.date), `daily_summaries/${log.date}:log`);
  },
};

export const targetsRepo = {
  async getAll(uid: string): Promise<WeeklyTarget[]> {
    return (await get<WeeklyTarget[]>(KEY.targets(uid))) || [];
  },
  async getByWeek(uid: string, weekStartDate: string): Promise<WeeklyTarget | null> {
    const all = await this.getAll(uid);
    return all.find(t => t.weekStartDate === weekStartDate) || null;
  },
  async save(uid: string, target: WeeklyTarget): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex(t => t.weekStartDate === target.weekStartDate);
    if (idx >= 0) all[idx] = target;
    else all.push(target);
    await set(KEY.targets(uid), all);
    emitDataEvent(uid, "targets");
    mirrorBestEffort(cloudMirrorRepo.upsertTarget(uid, target), `targets/${target.weekStartDate}`);
    mirrorBestEffort(
      syncWeekDailySummaries(uid, target.weekStartDate),
      `daily_summaries/${target.weekStartDate}:targets`
    );
  },
};

export const schedulesRepo = {
  async getAll(uid: string): Promise<WeekSchedule[]> {
    return (await get<WeekSchedule[]>(KEY.schedules(uid))) || [];
  },
  async getByWeek(uid: string, weekStartDate: string): Promise<WeekSchedule | null> {
    const all = await this.getAll(uid);
    return all.find(s => s.weekStartDate === weekStartDate) || null;
  },
  async save(uid: string, schedule: WeekSchedule): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex(s => s.weekStartDate === schedule.weekStartDate);
    if (idx >= 0) all[idx] = schedule;
    else all.push(schedule);
    await set(KEY.schedules(uid), all);
    emitDataEvent(uid, "schedules");
    mirrorBestEffort(cloudMirrorRepo.upsertSchedule(uid, schedule), `schedules/${schedule.weekStartDate}`);
    mirrorBestEffort(
      syncWeekDailySummaries(uid, schedule.weekStartDate),
      `daily_summaries/${schedule.weekStartDate}:plans`
    );
  },
};

export const workoutsRepo = {
  async getAll(uid: string): Promise<WorkoutTemplate[]> {
    const raw = (await get<WorkoutTemplate[]>(KEY.templates(uid))) || [];
    const normalized = raw.map(normalizeTemplate);

    const changed = normalized.filter((template, idx) => {
      const before = raw[idx];
      return !before || typeof before.sharedWithFriends !== "boolean";
    });

    if (changed.length > 0) {
      await set(KEY.templates(uid), normalized);
      changed.forEach((template) => {
        mirrorBestEffort(cloudMirrorRepo.upsertTemplate(uid, template), `templates/${template.id}:share-default`);
        mirrorBestEffort(syncSharedWorkoutTemplate(uid, template), `shared_workouts/${template.id}:share-default`);
      });
    }

    return normalized;
  },
  async getById(uid: string, id: string): Promise<WorkoutTemplate | null> {
    const all = await this.getAll(uid);
    return all.find(t => t.id === id) || null;
  },
  async save(uid: string, template: WorkoutTemplate): Promise<void> {
    const normalizedTemplate = normalizeTemplate(template);
    const all = await this.getAll(uid);
    const idx = all.findIndex(t => t.id === normalizedTemplate.id);
    if (idx >= 0) all[idx] = normalizedTemplate;
    else all.push(normalizedTemplate);
    await set(KEY.templates(uid), all);
    emitDataEvent(uid, "workouts");
    mirrorBestEffort(cloudMirrorRepo.upsertTemplate(uid, normalizedTemplate), `templates/${normalizedTemplate.id}`);
    mirrorBestEffort(syncSharedWorkoutTemplate(uid, normalizedTemplate), `shared_workouts/${normalizedTemplate.id}`);
  },
  async delete(uid: string, id: string): Promise<void> {
    const all = await this.getAll(uid);
    await set(KEY.templates(uid), all.filter(t => t.id !== id));
    emitDataEvent(uid, "workouts");
    mirrorBestEffort(cloudMirrorRepo.deleteTemplate(uid, id), `templates/${id}:delete`);
    mirrorBestEffort(removeSharedWorkoutTemplate(uid, id), `shared_workouts/${id}:delete`);
  },
};

export const exercisesRepo = {
  async getAll(uid: string): Promise<ExerciseLibraryItem[]> {
    return (await get<ExerciseLibraryItem[]>(KEY.exercises(uid))) || [];
  },
  async getById(uid: string, id: string): Promise<ExerciseLibraryItem | null> {
    const all = await this.getAll(uid);
    return all.find((exercise) => exercise.id === id) || null;
  },
  async save(uid: string, exercise: ExerciseLibraryItem): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex((item) => item.id === exercise.id);
    if (idx >= 0) all[idx] = exercise;
    else all.push(exercise);
    await set(KEY.exercises(uid), all);
    emitDataEvent(uid, "exercises");
    mirrorBestEffort(cloudMirrorRepo.upsertExercise(uid, exercise), `exercises/${exercise.id}`);
  },
  async delete(uid: string, id: string): Promise<void> {
    const all = await this.getAll(uid);
    await set(KEY.exercises(uid), all.filter((exercise) => exercise.id !== id));
    emitDataEvent(uid, "exercises");
    mirrorBestEffort(cloudMirrorRepo.deleteExercise(uid, id), `exercises/${id}:delete`);
  },
};

export const mealsRepo = {
  async getAll(uid: string): Promise<MealEntry[]> {
    return (await get<MealEntry[]>(KEY.meals(uid))) || [];
  },
  async getByDate(uid: string, date: string): Promise<MealEntry[]> {
    const all = await this.getAll(uid);
    return all.filter(m => m.date === date);
  },
  async save(uid: string, meal: MealEntry): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex(m => m.id === meal.id);
    if (idx >= 0) all[idx] = meal;
    else all.push(meal);
    await set(KEY.meals(uid), all);
    emitDataEvent(uid, "meals");
    mirrorBestEffort(cloudMirrorRepo.upsertMeal(uid, meal), `meals/${meal.id}`);
    mirrorBestEffort(syncDailySummary(uid, meal.date), `daily_summaries/${meal.date}:meal`);
  },
  async delete(uid: string, id: string): Promise<void> {
    const all = await this.getAll(uid);
    const removed = all.find((meal) => meal.id === id) || null;
    await set(KEY.meals(uid), all.filter(m => m.id !== id));
    emitDataEvent(uid, "meals");
    mirrorBestEffort(cloudMirrorRepo.deleteMeal(uid, id), `meals/${id}:delete`);
    if (removed) {
      mirrorBestEffort(syncDailySummary(uid, removed.date), `daily_summaries/${removed.date}:meal-delete`);
    }
  },
};

export const sessionsRepo = {
  async getAll(uid: string): Promise<WorkoutSession[]> {
    const raw = (await get<WorkoutSession[]>(KEY.sessions(uid))) || [];
    const today = todayYMD();
    const nowIso = new Date().toISOString();
    const updatedForMissed: WorkoutSession[] = [];

    const all = raw.map((item) => {
      const normalized = normalizeSession(item);
      if (!normalized.completed && !normalized.endedAt && normalized.date < today) {
        const markedMissed: WorkoutSession = {
          ...normalized,
          endedAt: nowIso,
          missed: true,
        };
        updatedForMissed.push(markedMissed);
        return markedMissed;
      }
      return normalized;
    });

    if (updatedForMissed.length > 0) {
      await set(KEY.sessions(uid), all);
      emitDataEvent(uid, "sessions");
      updatedForMissed.forEach((session) => {
        mirrorBestEffort(cloudMirrorRepo.upsertSession(uid, session), `sessions/${session.id}`);
        mirrorBestEffort(syncDailySummary(uid, session.date), `daily_summaries/${session.date}:missed`);
      });
    }

    return all;
  },
  async getById(uid: string, id: string): Promise<WorkoutSession | null> {
    const all = await this.getAll(uid);
    return all.find(s => s.id === id) || null;
  },
  async getByDate(uid: string, date: string): Promise<WorkoutSession[]> {
    const all = await this.getAll(uid);
    return all.filter(s => s.date === date);
  },
  async save(uid: string, session: WorkoutSession, opts?: { syncToCloud?: boolean }): Promise<void> {
    const normalizedSession = normalizeSession(session);
    const all = await this.getAll(uid);
    const idx = all.findIndex(s => s.id === normalizedSession.id);
    if (idx >= 0) all[idx] = normalizedSession;
    else all.push(normalizedSession);
    await set(KEY.sessions(uid), all);
    emitDataEvent(uid, "sessions");
    void opts;
    mirrorBestEffort(cloudMirrorRepo.upsertSession(uid, normalizedSession), `sessions/${normalizedSession.id}`);
    mirrorBestEffort(syncDailySummary(uid, normalizedSession.date), `daily_summaries/${normalizedSession.date}:session`);
  },
};

export const measurementsRepo = {
  async getAll(uid: string): Promise<BodyMeasurementEntry[]> {
    const all = (await get<BodyMeasurementEntry[]>(KEY.measurements(uid))) || [];
    return all.map(normalizeMeasurementEntry);
  },
  async getByDate(uid: string, date: string): Promise<BodyMeasurementEntry | null> {
    const all = await this.getAll(uid);
    return getMeasurementByDate(all, date);
  },
  async getRange(uid: string, start: string, end: string): Promise<BodyMeasurementEntry[]> {
    const all = await this.getAll(uid);
    return getMeasurementRange(all, start, end);
  },
  async save(uid: string, entry: BodyMeasurementEntry): Promise<void> {
    const normalized = normalizeMeasurementEntry(entry);
    const key = measurementDocId(normalized);
    if (!key) {
      throw new Error("measurement missing stable key");
    }

    const all = await this.getAll(uid);
    const idx = all.findIndex((e) => measurementDocId(e) === key);
    if (idx >= 0) all[idx] = normalized;
    else all.push(normalized);
    await set(KEY.measurements(uid), all);
    emitDataEvent(uid, "measurements");
    mirrorBestEffort(cloudMirrorRepo.upsertMeasurement(uid, normalized), `measurements/${key}`);
  },
  async delete(uid: string, key: string): Promise<void> {
    const all = await this.getAll(uid);
    await set(
      KEY.measurements(uid),
      all.filter((e) => {
        const docId = measurementDocId(e);
        return docId !== key && e.id !== key && e.date !== key;
      })
    );
    emitDataEvent(uid, "measurements");
    mirrorBestEffort(cloudMirrorRepo.deleteMeasurement(uid, key), `measurements/${key}:delete`);
  },
};

export const remindersRepo = {
  async get(uid: string): Promise<ReminderState | null> {
    return get<ReminderState>(KEY.reminders(uid));
  },
  async saveLocal(uid: string, state: ReminderState): Promise<void> {
    await set(KEY.reminders(uid), state);
    emitDataEvent(uid, "reminders");
  },
  async syncSettings(uid: string, state: ReminderState): Promise<void> {
    mirrorBestEffort(
      cloudMirrorRepo.upsertReminderSettings(uid, toReminderSettingsDoc(state)),
      "reminders/primary:settings"
    );
  },
  async save(uid: string, state: ReminderState): Promise<void> {
    await this.saveLocal(uid, state);
  },
};
