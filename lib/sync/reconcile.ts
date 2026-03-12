import AsyncStorage from "@react-native-async-storage/async-storage";
import { Timestamp, collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  localCacheRepo,
  type LocalDataSnapshot,
} from "@/lib/storage";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import { normalizeMeasurementEntries } from "@/lib/adapters/measurementKeyAdapter";
import {
  getMirrorReadCollections,
  mirrorCollections,
  toCanonicalMirrorCollectionName,
  type MirrorCollectionName,
} from "@/lib/sync/mirrorSchema";
import {
  normalizeReminderStateRecord,
  toReminderSettingsMirrorBoundary,
  withReminderSettingsBoundary,
} from "@/lib/adapters/reminderStateAdapter";
import type {
  BodyMeasurementEntry,
  DailyLog,
  ExerciseLibraryItem,
  MealEntry,
  ReminderSettingsMirrorDoc,
  ReminderState,
  WeekSchedule,
  WeeklyTarget,
  WorkoutSession,
  WorkoutTemplate,
} from "@/lib/types";

type ReconcileCheckpoint = {
  lastFullSyncAt: string;
  mergedCounts: Record<string, number>;
  collectionCursors?: Record<string, string>;
};
type TombstoneDoc = {
  collectionName: string;
  docId: string;
  deletedAt: unknown;
};
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
  name: Exclude<MirrorCollectionName, typeof mirrorCollections.syncTombstones>,
  cursorIso?: string
): Promise<FetchResult<T>> {
  const cursorMs = cursorIso ? Date.parse(cursorIso) : Number.NaN;
  const mergedByDocId = new Map<string, { item: T; mirroredAtMs: number | null }>();
  let maxMs = Number.isFinite(cursorMs) ? cursorMs : Number.NaN;

  for (const readName of getMirrorReadCollections(name)) {
    const col = collection(getFirebaseDb(), "users", uid, readName);
    const snaps =
      cursorIso && Number.isFinite(cursorMs)
        ? await getDocs(query(col, where("mirroredAt", ">", Timestamp.fromMillis(cursorMs))))
        : await getDocs(col);

    for (const d of snaps.docs) {
      const raw = d.data() as any;
      const m = toMillis(raw?.mirroredAt);
      if (m != null) {
        if (!Number.isFinite(maxMs) || m > maxMs) maxMs = m;
      }

      const prev = mergedByDocId.get(d.id);
      if (!prev) {
        mergedByDocId.set(d.id, {
          item: stripMirrorFields(raw as T),
          mirroredAtMs: m,
        });
        continue;
      }

      const prevTs = prev.mirroredAtMs;
      if (prevTs == null || (m != null && m >= prevTs)) {
        mergedByDocId.set(d.id, {
          item: stripMirrorFields(raw as T),
          mirroredAtMs: m,
        });
      }
    }
  }

  return {
    items: Array.from(mergedByDocId.values()).map((x) => x.item),
    cursor: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : cursorIso,
  };
}

async function fetchTombstones(
  uid: string,
  cursorIso?: string
): Promise<FetchResult<TombstoneDoc>> {
  const mergedByDocId = new Map<string, TombstoneDoc>();
  let cursor = cursorIso;

  for (const readName of getMirrorReadCollections(mirrorCollections.syncTombstones)) {
    const col = collection(getFirebaseDb(), "users", uid, readName);
    const snaps =
      cursorIso
        ? await getDocs(query(col, where("deletedAt", ">", cursorIso)))
        : await getDocs(col);

    for (const d of snaps.docs) {
      const raw = stripMirrorFields(d.data() as TombstoneDoc);
      const prev = mergedByDocId.get(d.id);

      if (!prev) {
        mergedByDocId.set(d.id, raw);
      } else {
        const prevTs = toMillis(prev.deletedAt);
        const nextTs = toMillis(raw.deletedAt);
        if (prevTs == null || (nextTs != null && nextTs >= prevTs)) {
          mergedByDocId.set(d.id, raw);
        }
      }

      const ts = toMillis(raw.deletedAt);
      if (ts != null) {
        const iso = new Date(ts).toISOString();
        if (!cursor || iso > cursor) cursor = iso;
      }
    }
  }

  return { items: Array.from(mergedByDocId.values()), cursor };
}

function pickCollectionCursor(
  cursors: Record<string, string>,
  name: MirrorCollectionName
): string | undefined {
  let best: string | undefined;
  let bestMs = Number.NaN;
  for (const candidateName of getMirrorReadCollections(name)) {
    const candidate = cursors[candidateName];
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (Number.isNaN(ms)) continue;
    if (!Number.isFinite(bestMs) || ms > bestMs) {
      best = candidate;
      bestMs = ms;
    }
  }
  return best;
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

function mergeReminderState(
  localState: ReminderState | null,
  reminderDoc: ReminderSettingsMirrorDoc | null
): ReminderState | null {
  const normalizedLocal = localState
    ? normalizeReminderStateRecord(localState, "reconcile:local-reminders")
    : null;
  if (!normalizedLocal && !reminderDoc) return null;
  if (!reminderDoc) return normalizedLocal;

  const nowIso = new Date().toISOString();
  const base = normalizedLocal
    ? normalizedLocal
    : normalizeReminderStateRecord(
        {
        id: "primary",
        version: 1,
        settings: reminderDoc.settings,
        runtime: {},
        createdAt: reminderDoc.createdAt || nowIso,
        updatedAt: reminderDoc.updatedAt || nowIso,
        },
        "reconcile:cloud-reminder-base"
      );

  return normalizeReminderStateRecord(
    {
      ...withReminderSettingsBoundary(base, reminderDoc.settings),
      createdAt: base.createdAt || reminderDoc.createdAt || nowIso,
      // Keep settings-level timestamp from cloud/local doc; runtime timestamp stays nested.
      updatedAt: reminderDoc.updatedAt || base.updatedAt,
    },
    "reconcile:merged-reminders"
  );
}

export async function reconcileCloudToLocal(
  uid: string,
  opts?: { force?: boolean }
): Promise<void> {
  const force = !!opts?.force;
  const cp = await readCheckpoint(uid);
  if (!force && shouldSkipByCheckpoint(cp)) return;
  const cursors: Record<string, string> = cp?.collectionCursors || {};

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
    remindersRes,
    tombstonesRes,
  ] = await Promise.all([
    fetchMirrorCollection<DailyLog>(
      uid,
      mirrorCollections.dailyLogs,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.dailyLogs)
    ),
    fetchMirrorCollection<MealEntry>(
      uid,
      mirrorCollections.nutritionEntries,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.nutritionEntries)
    ),
    fetchMirrorCollection<WeeklyTarget>(
      uid,
      mirrorCollections.weeklyTargets,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.weeklyTargets)
    ),
    fetchMirrorCollection<WeekSchedule>(
      uid,
      mirrorCollections.weeklyPlans,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.weeklyPlans)
    ),
    fetchMirrorCollection<WorkoutTemplate>(
      uid,
      mirrorCollections.workoutTemplates,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.workoutTemplates)
    ),
    fetchMirrorCollection<ExerciseLibraryItem>(
      uid,
      mirrorCollections.exercises,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.exercises)
    ),
    fetchMirrorCollection<WorkoutSession>(
      uid,
      mirrorCollections.workoutSessions,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.workoutSessions)
    ),
    fetchMirrorCollection<BodyMeasurementEntry>(
      uid,
      mirrorCollections.bodyMeasurements,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.bodyMeasurements)
    ),
    fetchMirrorCollection<ReminderSettingsMirrorDoc>(
      uid,
      mirrorCollections.reminderSettings,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.reminderSettings)
    ),
    fetchTombstones(
      uid,
      force ? undefined : pickCollectionCursor(cursors, mirrorCollections.syncTombstones)
    ),
  ]);
  const cloudLogs = logsRes.items;
  const cloudMeals = mealsRes.items;
  const cloudTargets = targetsRes.items;
  const cloudSchedules = schedulesRes.items;
  const cloudTemplates = templatesRes.items;
  const cloudExercises = exercisesRes.items;
  const cloudSessions = sessionsRes.items;
  const cloudMeasurements = normalizeMeasurementEntries(
    measurementsRes.items.map(normalizeMeasurementEntry).filter(hasMeasurementKey),
    "reconcile:cloudMeasurements"
  );
  const localMeasurements = normalizeMeasurementEntries(
    local.measurements.map(normalizeMeasurementEntry).filter(hasMeasurementKey),
    "reconcile:localMeasurements"
  );
  const localReminderDocs = local.reminders ? [toReminderSettingsMirrorBoundary(local.reminders)] : [];
  const cloudReminders = remindersRes.items;
  const tombstones = tombstonesRes.items;

  const tombstonesByKey = new Map<string, number>();
  for (const t of tombstones) {
    if (!t?.collectionName || !t?.docId) continue;
    const ts = toMillis(t.deletedAt);
    if (ts == null) continue;
    const key = `${toCanonicalMirrorCollectionName(String(t.collectionName))}::${t.docId}`;
    const existing = tombstonesByKey.get(key);
    if (existing == null || ts > existing) tombstonesByKey.set(key, ts);
  }

  const mergedReminderDocsBeforeDelete = mergeByKey(
    localReminderDocs,
    cloudReminders,
    () => "primary",
    ["updatedAt", "createdAt"]
  );

  const mergedReminderDoc = applyTombstones(
    mirrorCollections.reminderSettings,
    mergedReminderDocsBeforeDelete,
    () => "primary",
    tombstonesByKey,
    ["updatedAt", "createdAt"]
  )[0] || null;

  const mergedBeforeDelete: LocalDataSnapshot = {
    logs: mergeByKey(local.logs as any[], cloudLogs as any[], (x) => String(x.date), ["updatedAt"]),
    meals: mergeByKey(local.meals as any[], cloudMeals as any[], (x) => String(x.id), ["updatedAt", "createdAt"]),
    targets: mergeByKey(local.targets as any[], cloudTargets as any[], (x) => String(x.weekStartDate), ["updatedAt", "createdAt"]),
    schedules: mergeByKey(local.schedules as any[], cloudSchedules as any[], (x) => String(x.weekStartDate), []),
    templates: mergeByKey(local.templates as any[], cloudTemplates as any[], (x) => String(x.id), ["updatedAt", "createdAt"]),
    exercises: mergeByKey(local.exercises as any[], cloudExercises as any[], (x) => String(x.id), ["updatedAt", "createdAt"]),
    sessions: mergeByKey(local.sessions as any[], cloudSessions as any[], (x) => String(x.id), ["endedAt", "startedAt"]),
    measurements: mergeByKey(localMeasurements, cloudMeasurements, measurementKey, ["updatedAt", "createdAt", "loggedAt"]),
    reminders: mergeReminderState(local.reminders, mergedReminderDocsBeforeDelete[0] || null),
  };

  const merged: LocalDataSnapshot = {
    logs: applyTombstones(mirrorCollections.dailyLogs, mergedBeforeDelete.logs, (x) => String((x as any).date), tombstonesByKey, ["updatedAt"]),
    meals: applyTombstones(mirrorCollections.nutritionEntries, mergedBeforeDelete.meals, (x) => String((x as any).id), tombstonesByKey, ["updatedAt", "createdAt"]),
    targets: applyTombstones(mirrorCollections.weeklyTargets, mergedBeforeDelete.targets, (x) => String((x as any).weekStartDate), tombstonesByKey, ["updatedAt", "createdAt"]),
    schedules: applyTombstones(mirrorCollections.weeklyPlans, mergedBeforeDelete.schedules, (x) => String((x as any).weekStartDate), tombstonesByKey, []),
    templates: applyTombstones(mirrorCollections.workoutTemplates, mergedBeforeDelete.templates, (x) => String((x as any).id), tombstonesByKey, ["updatedAt", "createdAt"]),
    exercises: applyTombstones(mirrorCollections.exercises, mergedBeforeDelete.exercises, (x) => String((x as any).id), tombstonesByKey, ["updatedAt", "createdAt"]),
    sessions: applyTombstones(mirrorCollections.workoutSessions, mergedBeforeDelete.sessions, (x) => String((x as any).id), tombstonesByKey, ["endedAt", "startedAt"]),
    measurements: applyTombstones(mirrorCollections.bodyMeasurements, mergedBeforeDelete.measurements, measurementKey, tombstonesByKey, ["updatedAt", "createdAt", "loggedAt"]),
    reminders: mergedReminderDoc ? mergeReminderState(mergedBeforeDelete.reminders, mergedReminderDoc) : null,
  };

  await localCacheRepo.setSnapshot(uid, merged);
  const nextCursors: Record<string, string> = {};
  if (logsRes.cursor) nextCursors[mirrorCollections.dailyLogs] = logsRes.cursor;
  if (mealsRes.cursor) nextCursors[mirrorCollections.nutritionEntries] = mealsRes.cursor;
  if (targetsRes.cursor) nextCursors[mirrorCollections.weeklyTargets] = targetsRes.cursor;
  if (schedulesRes.cursor) nextCursors[mirrorCollections.weeklyPlans] = schedulesRes.cursor;
  if (templatesRes.cursor) nextCursors[mirrorCollections.workoutTemplates] = templatesRes.cursor;
  if (exercisesRes.cursor) nextCursors[mirrorCollections.exercises] = exercisesRes.cursor;
  if (sessionsRes.cursor) nextCursors[mirrorCollections.workoutSessions] = sessionsRes.cursor;
  if (measurementsRes.cursor) nextCursors[mirrorCollections.bodyMeasurements] = measurementsRes.cursor;
  if (remindersRes.cursor) nextCursors[mirrorCollections.reminderSettings] = remindersRes.cursor;
  if (tombstonesRes.cursor) nextCursors[mirrorCollections.syncTombstones] = tombstonesRes.cursor;

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
      reminders: merged.reminders ? 1 : 0,
    },
    collectionCursors: nextCursors,
  });
}
