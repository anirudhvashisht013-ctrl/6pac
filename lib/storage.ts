import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User, DailyLog, MealEntry, WeeklyTarget,
  WeekSchedule, WorkoutTemplate, WorkoutSession, BodyMeasurementEntry, ExerciseLibraryItem, ReminderRuntime, ReminderSettings, ReminderState,
} from './types';
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import { normalizeMeasurementEntries } from "@/lib/adapters/measurementKeyAdapter";
import { removeSharedWorkoutTemplate, syncSharedWorkoutTemplate } from "@/lib/friends/sharedWorkoutsRepo";
import {
  getReminderRuntimeBoundary,
  getReminderSettingsBoundary,
  normalizeReminderStateRecord,
  toReminderSettingsMirrorBoundary,
} from "@/lib/adapters/reminderStateAdapter";
import {
  getWeeklyPlanValidationIssues,
  type WeeklyPlan,
  normalizeWeeklyPlan,
  toWeekSchedule,
  toWeeklyPlan,
} from "@/lib/adapters/weeklyPlanAdapter";
import {
  normalizeWorkoutSessionRecord,
  prepareWorkoutSessionForSave,
} from "@/lib/adapters/workoutSessionSnapshotAdapter";
import {
  getMeasurementByDate,
  getMeasurementRange,
} from "@/lib/measurements/localMeasurementsQuery";
import { emitDataEvent } from "@/lib/dataEvents";
import { todayYMD } from "@/lib/dates";
import type { ISODate } from "@/lib/models";
import {
  refreshDailySummaryProjection,
  refreshWeeklyDailySummaryProjection,
} from "@/lib/projections/dailySummaryProjection";

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

function normalizeTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    notes: typeof template.notes === 'string' ? template.notes : null,
    sharedWithFriends: template.sharedWithFriends !== false,
  };
}

function normalizeSession(session: WorkoutSession): WorkoutSession {
  return normalizeWorkoutSessionRecord(session, { context: "storage:read" });
}

function normalizeWeekSchedule(schedule: WeekSchedule): WeekSchedule {
  const plan = toWeeklyPlan(schedule);
  const issues = getWeeklyPlanValidationIssues(plan);
  if (issues.length > 0 && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(
      `[weekly-plan] validation issues for ${schedule.weekStartDate}`,
      issues.map((issue) => issue.code)
    );
  }
  return toWeekSchedule(normalizeWeeklyPlan(plan));
}

function normalizeWeeklyPlanBoundary(plan: WeeklyPlan): WeeklyPlan {
  const issues = getWeeklyPlanValidationIssues(plan);
  if (issues.length > 0 && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(
      `[weekly-plan] validation issues for ${plan.weekStartDate}`,
      issues.map((issue) => issue.code)
    );
  }
  return normalizeWeeklyPlan(plan);
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

async function syncDailySummary(uid: string, date: string, snapshot?: LocalDataSnapshot): Promise<void> {
  await refreshDailySummaryProjection(uid, date, {
    getSnapshot: (targetUid) => localCacheRepo.getSnapshot(targetUid),
    snapshot,
  });
}

async function syncWeekDailySummaries(uid: string, weekStartDate: string): Promise<void> {
  await refreshWeeklyDailySummaryProjection(uid, weekStartDate, {
    getSnapshot: (targetUid) => localCacheRepo.getSnapshot(targetUid),
  });
}

// Infrastructure repo: composite local snapshot over the local-first domain repos.
// This is not a canonical business entity boundary.
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

// Legacy local-auth cache repo kept for backward compatibility only.
// Account profile truth now lives in Firestore via accountProfileRepo.
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

// Legacy auth-session token repo. This is unrelated to workout execution sessions.
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

// Canonical local-first repo for DailyCheckIn records.
// Owns one date-keyed daily check-in row; does not own nutrition or workout summaries.
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

// Canonical local-first repo for WeeklyTarget records.
// Owns weekly goal settings only; not weekly planning or execution.
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

// Canonical local-first repo for WeeklyPlan with embedded DayAssignment[].
// Owns planner state only; execution truth lives in WorkoutSession.
export const weeklyPlanRepo = {
  async getAll(uid: string): Promise<WeeklyPlan[]> {
    const raw = (await get<WeekSchedule[]>(KEY.schedules(uid))) || [];
    return raw.map((schedule) => normalizeWeeklyPlanBoundary(toWeeklyPlan(schedule)));
  },
  async getByWeek(uid: string, weekStartDate: string): Promise<WeeklyPlan | null> {
    const all = await this.getAll(uid);
    return all.find((plan) => plan.weekStartDate === weekStartDate) || null;
  },
  async save(uid: string, plan: WeeklyPlan): Promise<void> {
    const normalizedPlan = normalizeWeeklyPlanBoundary(plan);
    const normalizedSchedule = toWeekSchedule(normalizedPlan);
    const all = await this.getAll(uid);
    const idx = all.findIndex((item) => item.weekStartDate === normalizedPlan.weekStartDate);
    if (idx >= 0) all[idx] = normalizedPlan;
    else all.push(normalizedPlan);
    await set(KEY.schedules(uid), all.map(toWeekSchedule));
    emitDataEvent(uid, "schedules");
    mirrorBestEffort(cloudMirrorRepo.upsertSchedule(uid, normalizedSchedule), `schedules/${normalizedSchedule.weekStartDate}`);
    mirrorBestEffort(
      syncWeekDailySummaries(uid, normalizedSchedule.weekStartDate),
      `daily_summaries/${normalizedSchedule.weekStartDate}:plans`
    );
  },
};

// Compatibility alias for older WeekSchedule naming. Same storage, same behavior.
export const schedulesRepo = {
  async getAll(uid: string): Promise<WeekSchedule[]> {
    const plans = await weeklyPlanRepo.getAll(uid);
    return plans.map(toWeekSchedule);
  },
  async getByWeek(uid: string, weekStartDate: string): Promise<WeekSchedule | null> {
    const plan = await weeklyPlanRepo.getByWeek(uid, weekStartDate);
    return plan ? toWeekSchedule(plan) : null;
  },
  async save(uid: string, schedule: WeekSchedule): Promise<void> {
    await weeklyPlanRepo.save(uid, toWeeklyPlan(schedule));
  },
};

// Canonical local-first repo for WorkoutTemplate authoring data.
// Does not own assignment state or execution history.
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

// Canonical local-first repo for ExerciseLibraryItem definitions.
// Templates may snapshot exercise fields, but this repo owns the library source rows.
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

// Canonical local-first repo for NutritionEntry rows.
// Daily totals remain derived and are not owned here.
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

// Canonical local-first repo for WorkoutSession execution records.
// Planner state stays in WeeklyPlan / DayAssignment; execution truth must not be inferred
// back into planning storage.
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
    const all = await this.getAll(uid);
    const existingSession = all.find((item) => item.id === session.id) || null;
    const normalizedSession = prepareWorkoutSessionForSave(session, {
      existingSession,
      context: "storage:save",
    });
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

// Canonical local-first repo for BodyMeasurementEntry records.
// Owns scheduled-slot measurement entries; trend/progress views remain derived.
export const measurementsRepo = {
  async getAll(uid: string): Promise<BodyMeasurementEntry[]> {
    const all = (await get<BodyMeasurementEntry[]>(KEY.measurements(uid))) || [];
    return normalizeMeasurementEntries(all.map(normalizeMeasurementEntry), "storage:getAll");
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

// Hybrid repo for bundled reminder state.
// Owns local ReminderSettings + ReminderRuntime persistence shape for v1, while cloud sync
// mirrors only the settings boundary.
export const remindersRepo = {
  async get(uid: string): Promise<ReminderState | null> {
    const raw = await get<ReminderState>(KEY.reminders(uid));
    return raw ? normalizeReminderStateRecord(raw, "storage:get") : null;
  },
  async saveLocal(uid: string, state: ReminderState): Promise<void> {
    await set(KEY.reminders(uid), normalizeReminderStateRecord(state, "storage:saveLocal"));
    emitDataEvent(uid, "reminders");
  },
  async getSettings(uid: string): Promise<ReminderSettings> {
    return getReminderSettingsBoundary(await this.get(uid), "storage:getSettings");
  },
  async getRuntime(uid: string): Promise<ReminderRuntime> {
    return getReminderRuntimeBoundary(await this.get(uid), "storage:getRuntime");
  },
  async syncSettings(uid: string, state: ReminderState): Promise<void> {
    mirrorBestEffort(
      cloudMirrorRepo.upsertReminderSettings(uid, toReminderSettingsMirrorBoundary(state)),
      "reminders/primary:settings"
    );
  },
  async save(uid: string, state: ReminderState): Promise<void> {
    await this.saveLocal(uid, normalizeReminderStateRecord(state, "storage:save"));
  },
};

// Target-facing domain repo aliases.
// These keep current runtime/storage behavior unchanged while letting new code speak the
// target architecture language.
export const dailyCheckInRepo = logsRepo;
export const nutritionEntryRepo = mealsRepo;
export const weeklyTargetRepo = targetsRepo;
export const workoutTemplateRepo = workoutsRepo;
export const exerciseLibraryRepo = exercisesRepo;
export const workoutSessionRepo = sessionsRepo;
export const workoutExecutionRepo = sessionsRepo;
export const bodyMeasurementRepo = measurementsRepo;
export const reminderStateRepo = remindersRepo;

// Infrastructure / compatibility aliases.
export const localSnapshotRepo = localCacheRepo;
export const legacyLocalUserRepo = usersRepo;
export const localAuthSessionRepo = sessionRepo;
