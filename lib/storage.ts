import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User, DailyLog, MealEntry, WeeklyTarget,
  WeekSchedule, WorkoutTemplate, WorkoutSession, BodyMeasurementEntry, ExerciseLibraryItem, ReminderState,
  ReminderSettingsMirrorDoc,
} from './types';
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import {
  getMeasurementByDate,
  getMeasurementRange,
} from "@/lib/measurements/localMeasurementsQuery";
import { emitDataEvent } from "@/lib/dataEvents";

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
  },
};

export const workoutsRepo = {
  async getAll(uid: string): Promise<WorkoutTemplate[]> {
    return (await get<WorkoutTemplate[]>(KEY.templates(uid))) || [];
  },
  async getById(uid: string, id: string): Promise<WorkoutTemplate | null> {
    const all = await this.getAll(uid);
    return all.find(t => t.id === id) || null;
  },
  async save(uid: string, template: WorkoutTemplate): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex(t => t.id === template.id);
    if (idx >= 0) all[idx] = template;
    else all.push(template);
    await set(KEY.templates(uid), all);
    emitDataEvent(uid, "workouts");
    mirrorBestEffort(cloudMirrorRepo.upsertTemplate(uid, template), `templates/${template.id}`);
  },
  async delete(uid: string, id: string): Promise<void> {
    const all = await this.getAll(uid);
    await set(KEY.templates(uid), all.filter(t => t.id !== id));
    emitDataEvent(uid, "workouts");
    mirrorBestEffort(cloudMirrorRepo.deleteTemplate(uid, id), `templates/${id}:delete`);
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
  },
  async delete(uid: string, id: string): Promise<void> {
    const all = await this.getAll(uid);
    await set(KEY.meals(uid), all.filter(m => m.id !== id));
    emitDataEvent(uid, "meals");
    mirrorBestEffort(cloudMirrorRepo.deleteMeal(uid, id), `meals/${id}:delete`);
  },
};

export const sessionsRepo = {
  async getAll(uid: string): Promise<WorkoutSession[]> {
    return (await get<WorkoutSession[]>(KEY.sessions(uid))) || [];
  },
  async getById(uid: string, id: string): Promise<WorkoutSession | null> {
    const all = await this.getAll(uid);
    return all.find(s => s.id === id) || null;
  },
  async getByDate(uid: string, date: string): Promise<WorkoutSession[]> {
    const all = await this.getAll(uid);
    return all.filter(s => s.date === date);
  },
  async save(uid: string, session: WorkoutSession): Promise<void> {
    const all = await this.getAll(uid);
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) all[idx] = session;
    else all.push(session);
    await set(KEY.sessions(uid), all);
    emitDataEvent(uid, "sessions");
    mirrorBestEffort(cloudMirrorRepo.upsertSession(uid, session), `sessions/${session.id}`);
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
