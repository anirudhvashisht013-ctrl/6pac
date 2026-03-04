import AsyncStorage from "@react-native-async-storage/async-storage";
import { Timestamp, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  localCacheRepo,
  type LocalDataSnapshot,
} from "@/lib/storage";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import type {
  BodyMeasurementEntry,
  DailyLog,
  ExerciseLibraryItem,
  MealEntry,
  WeekSchedule,
  WeeklyTarget,
  WorkoutSession,
  WorkoutTemplate,
} from "@/lib/types";

type ReconcileCheckpoint = {
  lastFullSyncAt: string;
  mergedCounts: Record<string, number>;
  collectionCursors?: Partial<Record<MirrorCollectionName, string>>;
};
type TombstoneDoc = {
  collectionName: string;
  docId: string;
  deletedAt: unknown;
};
type MirrorCollectionName =
  | "logs_v1"
  | "meals_v1"
  | "targets_v1"
  | "schedules_v1"
  | "templates_v1"
  | "exercises_v1"
  | "sessions_v1"
  | "measurements_local_v1"
  | "tombstones_v1";
type FetchResult<T> = {
  items: T[];
  cursor: string | undefined;
};

const CHECKPOINT_KEY = (uid: string) => `@6pac:reconcile_checkpoint_v1:${uid}`;
const MIN_SYNC_INTERVAL_MS = 60 * 1000;

function stripMirrorFields<T extends object>(raw: T): T {
  const { mirroredAt, mirrorVersion, ...rest } = raw as any;
  void mirroredAt;
  void mirrorVersion;
  return rest as T;
}

function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Date.parse(value);
    return Number.isNaN(n) ? null : n;
  }
  if (typeof value === "object") {
    const anyVal = value as any;
    if (typeof anyVal.toDate === "function") {
      try {
        const d = anyVal.toDate();
        if (d instanceof Date) return d.getTime();
      } catch {
        return null;
      }
    }
    if (typeof anyVal.seconds === "number") {
      return anyVal.seconds * 1000;
    }
  }
  return null;
}

function pickTimestamp(record: unknown, fields: string[]): number | null {
  const obj = (record || {}) as Record<string, unknown>;
  for (const f of fields) {
    const n = toMillis(obj[f]);
    if (n != null) return n;
  }
  return null;
}

function mergeByKey<T extends object>(
  localItems: T[],
  cloudItems: T[],
  keyOf: (item: T) => string,
  timestampFields: string[]
): T[] {
  const map = new Map<string, T>();
  for (const item of localItems) map.set(keyOf(item), item);

  for (const cloudItem of cloudItems) {
    const key = keyOf(cloudItem);
    const local = map.get(key);
    if (!local) {
      map.set(key, cloudItem);
      continue;
    }

    const localTs = pickTimestamp(local, timestampFields);
    const cloudTs = pickTimestamp(cloudItem, timestampFields);

    if (localTs == null && cloudTs == null) {
      map.set(key, cloudItem); // deterministic tie: cloud wins
      continue;
    }

    if (cloudTs == null) continue;
    if (localTs == null || cloudTs >= localTs) {
      map.set(key, cloudItem);
    }
  }

  return Array.from(map.values());
}

function applyTombstones<T extends object>(
  collectionName: string,
  items: T[],
  keyOf: (item: T) => string,
  tombstonesByKey: Map<string, number>,
  timestampFields: string[]
): T[] {
  return items.filter((item) => {
    const key = `${collectionName}::${keyOf(item)}`;
    const tombstoneTs = tombstonesByKey.get(key);
    if (tombstoneTs == null) return true;

    const itemTs = pickTimestamp(item, timestampFields);
    if (itemTs == null) return false;
    return itemTs > tombstoneTs;
  });
}

async function fetchMirrorCollection<T extends object>(
  uid: string,
  name: Exclude<MirrorCollectionName, "tombstones_v1">,
  cursorIso?: string
): Promise<FetchResult<T>> {
  const col = collection(db, "users", uid, name);
  const cursorMs = cursorIso ? Date.parse(cursorIso) : Number.NaN;

  const snaps =
    cursorIso && Number.isFinite(cursorMs)
      ? await getDocs(query(col, where("mirroredAt", ">", Timestamp.fromMillis(cursorMs))))
      : await getDocs(col);

  const items: T[] = [];
  let maxMs = Number.isFinite(cursorMs) ? cursorMs : Number.NaN;

  for (const d of snaps.docs) {
    const raw = d.data() as any;
    const m = toMillis(raw?.mirroredAt);
    if (m != null) {
      if (!Number.isFinite(maxMs) || m > maxMs) maxMs = m;
    }
    items.push(stripMirrorFields(raw as T));
  }

  return {
    items,
    cursor: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : cursorIso,
  };
}

async function fetchTombstones(
  uid: string,
  cursorIso?: string
): Promise<FetchResult<TombstoneDoc>> {
  const col = collection(db, "users", uid, "tombstones_v1");
  const snaps =
    cursorIso
      ? await getDocs(query(col, where("deletedAt", ">", cursorIso)))
      : await getDocs(col);

  const items: TombstoneDoc[] = [];
  let cursor = cursorIso;

  for (const d of snaps.docs) {
    const raw = stripMirrorFields(d.data() as TombstoneDoc);
    items.push(raw);

    const ts = toMillis(raw.deletedAt);
    if (ts != null) {
      const iso = new Date(ts).toISOString();
      if (!cursor || iso > cursor) cursor = iso;
    }
  }

  return { items, cursor };
}

async function readCheckpoint(uid: string): Promise<ReconcileCheckpoint | null> {
  const raw = await AsyncStorage.getItem(CHECKPOINT_KEY(uid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReconcileCheckpoint;
  } catch {
    return null;
  }
}

async function writeCheckpoint(uid: string, cp: ReconcileCheckpoint): Promise<void> {
  await AsyncStorage.setItem(CHECKPOINT_KEY(uid), JSON.stringify(cp));
}

function shouldSkipByCheckpoint(cp: ReconcileCheckpoint | null): boolean {
  if (!cp?.lastFullSyncAt) return false;
  const last = Date.parse(cp.lastFullSyncAt);
  if (Number.isNaN(last)) return false;
  return Date.now() - last < MIN_SYNC_INTERVAL_MS;
}

function hasMeasurementKey(entry: BodyMeasurementEntry): boolean {
  return measurementDocId(entry) != null;
}

function measurementKey(entry: BodyMeasurementEntry): string {
  const key = measurementDocId(entry);
  if (!key) throw new Error("measurement missing stable key");
  return key;
}

export async function reconcileCloudToLocal(
  uid: string,
  opts?: { force?: boolean }
): Promise<void> {
  const force = !!opts?.force;
  const cp = await readCheckpoint(uid);
  if (!force && shouldSkipByCheckpoint(cp)) return;
  const cursors = cp?.collectionCursors || {};

  const local = await localCacheRepo.getSnapshot(uid);

  const [
    logsRes,
    mealsRes,
    targetsRes,
    schedulesRes,
    templatesRes,
    exercisesRes,
    sessionsRes,
    measurementsRes,
    tombstonesRes,
  ] = await Promise.all([
    fetchMirrorCollection<DailyLog>(uid, "logs_v1", force ? undefined : cursors.logs_v1),
    fetchMirrorCollection<MealEntry>(uid, "meals_v1", force ? undefined : cursors.meals_v1),
    fetchMirrorCollection<WeeklyTarget>(uid, "targets_v1", force ? undefined : cursors.targets_v1),
    fetchMirrorCollection<WeekSchedule>(uid, "schedules_v1", force ? undefined : cursors.schedules_v1),
    fetchMirrorCollection<WorkoutTemplate>(uid, "templates_v1", force ? undefined : cursors.templates_v1),
    fetchMirrorCollection<ExerciseLibraryItem>(uid, "exercises_v1", force ? undefined : cursors.exercises_v1),
    fetchMirrorCollection<WorkoutSession>(uid, "sessions_v1", force ? undefined : cursors.sessions_v1),
    fetchMirrorCollection<BodyMeasurementEntry>(uid, "measurements_local_v1", force ? undefined : cursors.measurements_local_v1),
    fetchTombstones(uid, force ? undefined : cursors.tombstones_v1),
  ]);
  const cloudLogs = logsRes.items;
  const cloudMeals = mealsRes.items;
  const cloudTargets = targetsRes.items;
  const cloudSchedules = schedulesRes.items;
  const cloudTemplates = templatesRes.items;
  const cloudExercises = exercisesRes.items;
  const cloudSessions = sessionsRes.items;
  const cloudMeasurements = measurementsRes.items
    .map(normalizeMeasurementEntry)
    .filter(hasMeasurementKey);
  const localMeasurements = local.measurements
    .map(normalizeMeasurementEntry)
    .filter(hasMeasurementKey);
  const tombstones = tombstonesRes.items;

  const tombstonesByKey = new Map<string, number>();
  for (const t of tombstones) {
    if (!t?.collectionName || !t?.docId) continue;
    const ts = toMillis(t.deletedAt);
    if (ts == null) continue;
    const key = `${t.collectionName}::${t.docId}`;
    const existing = tombstonesByKey.get(key);
    if (existing == null || ts > existing) tombstonesByKey.set(key, ts);
  }

  const mergedBeforeDelete: LocalDataSnapshot = {
    logs: mergeByKey(local.logs as any[], cloudLogs as any[], (x) => String(x.date), ["updatedAt"]),
    meals: mergeByKey(local.meals as any[], cloudMeals as any[], (x) => String(x.id), ["updatedAt", "createdAt"]),
    targets: mergeByKey(local.targets as any[], cloudTargets as any[], (x) => String(x.weekStartDate), ["updatedAt", "createdAt"]),
    schedules: mergeByKey(local.schedules as any[], cloudSchedules as any[], (x) => String(x.weekStartDate), []),
    templates: mergeByKey(local.templates as any[], cloudTemplates as any[], (x) => String(x.id), ["updatedAt", "createdAt"]),
    exercises: mergeByKey(local.exercises as any[], cloudExercises as any[], (x) => String(x.id), ["updatedAt", "createdAt"]),
    sessions: mergeByKey(local.sessions as any[], cloudSessions as any[], (x) => String(x.id), ["endedAt", "startedAt"]),
    measurements: mergeByKey(localMeasurements, cloudMeasurements, measurementKey, ["updatedAt", "createdAt", "loggedAt"]),
  };

  const merged: LocalDataSnapshot = {
    logs: applyTombstones("logs_v1", mergedBeforeDelete.logs, (x) => String((x as any).date), tombstonesByKey, ["updatedAt"]),
    meals: applyTombstones("meals_v1", mergedBeforeDelete.meals, (x) => String((x as any).id), tombstonesByKey, ["updatedAt", "createdAt"]),
    targets: applyTombstones("targets_v1", mergedBeforeDelete.targets, (x) => String((x as any).weekStartDate), tombstonesByKey, ["updatedAt", "createdAt"]),
    schedules: applyTombstones("schedules_v1", mergedBeforeDelete.schedules, (x) => String((x as any).weekStartDate), tombstonesByKey, []),
    templates: applyTombstones("templates_v1", mergedBeforeDelete.templates, (x) => String((x as any).id), tombstonesByKey, ["updatedAt", "createdAt"]),
    exercises: applyTombstones("exercises_v1", mergedBeforeDelete.exercises, (x) => String((x as any).id), tombstonesByKey, ["updatedAt", "createdAt"]),
    sessions: applyTombstones("sessions_v1", mergedBeforeDelete.sessions, (x) => String((x as any).id), tombstonesByKey, ["endedAt", "startedAt"]),
    measurements: applyTombstones("measurements_local_v1", mergedBeforeDelete.measurements, measurementKey, tombstonesByKey, ["updatedAt", "createdAt", "loggedAt"]),
  };

  await localCacheRepo.setSnapshot(uid, merged);

  await writeCheckpoint(uid, {
    lastFullSyncAt: new Date().toISOString(),
    mergedCounts: {
      logs: merged.logs.length,
      meals: merged.meals.length,
      targets: merged.targets.length,
      schedules: merged.schedules.length,
      templates: merged.templates.length,
      exercises: merged.exercises.length,
      sessions: merged.sessions.length,
      measurements: merged.measurements.length,
    },
    collectionCursors: {
      logs_v1: logsRes.cursor,
      meals_v1: mealsRes.cursor,
      targets_v1: targetsRes.cursor,
      schedules_v1: schedulesRes.cursor,
      templates_v1: templatesRes.cursor,
      exercises_v1: exercisesRes.cursor,
      sessions_v1: sessionsRes.cursor,
      measurements_local_v1: measurementsRes.cursor,
      tombstones_v1: tombstonesRes.cursor,
    },
  });
}
