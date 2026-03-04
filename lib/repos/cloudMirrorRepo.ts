import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
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
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import {
  enqueueMirrorDelete,
  enqueueMirrorUpsert,
  initializeMirrorQueue,
  processMirrorQueue,
} from "@/lib/sync/mirrorQueue";

const TOMBSTONES_COLLECTION = "tombstones_v1";

function tombstoneDocId(collectionName: string, docId: string) {
  return `${encodeURIComponent(collectionName)}|${encodeURIComponent(docId)}`;
}

async function upsertWithQueue(uid: string, collectionName: string, id: string, payload: unknown) {
  initializeMirrorQueue();
  await Promise.all([
    enqueueMirrorUpsert(uid, collectionName, id, (payload || {}) as Record<string, unknown>),
    // Clear stale delete marker when entity is recreated/updated.
    enqueueMirrorDelete(uid, TOMBSTONES_COLLECTION, tombstoneDocId(collectionName, id)),
  ]);
  void processMirrorQueue();
}

async function removeWithTombstoneQueue(uid: string, collectionName: string, id: string) {
  initializeMirrorQueue();
  const deletedAt = new Date().toISOString();
  await Promise.all([
    enqueueMirrorDelete(uid, collectionName, id),
    enqueueMirrorUpsert(uid, TOMBSTONES_COLLECTION, tombstoneDocId(collectionName, id), {
      collectionName,
      docId: id,
      deletedAt,
    }),
  ]);
  void processMirrorQueue();
}

export const cloudMirrorRepo = {
  async upsertLog(uid: string, log: DailyLog): Promise<void> {
    await upsertWithQueue(uid, "logs_v1", log.date, log);
  },

  async upsertTarget(uid: string, target: WeeklyTarget): Promise<void> {
    await upsertWithQueue(uid, "targets_v1", target.weekStartDate, target);
  },

  async upsertSchedule(uid: string, schedule: WeekSchedule): Promise<void> {
    await upsertWithQueue(uid, "schedules_v1", schedule.weekStartDate, schedule);
  },

  async upsertTemplate(uid: string, template: WorkoutTemplate): Promise<void> {
    await upsertWithQueue(uid, "templates_v1", template.id, template);
  },

  async deleteTemplate(uid: string, templateId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, "templates_v1", templateId);
  },

  async upsertExercise(uid: string, exercise: ExerciseLibraryItem): Promise<void> {
    await upsertWithQueue(uid, "exercises_v1", exercise.id, exercise);
  },

  async deleteExercise(uid: string, exerciseId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, "exercises_v1", exerciseId);
  },

  async upsertMeal(uid: string, meal: MealEntry): Promise<void> {
    await upsertWithQueue(uid, "meals_v1", meal.id, meal);
  },

  async deleteMeal(uid: string, mealId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, "meals_v1", mealId);
  },

  async upsertSession(uid: string, session: WorkoutSession): Promise<void> {
    await upsertWithQueue(uid, "sessions_v1", session.id, session);
  },

  async upsertMeasurement(uid: string, entry: BodyMeasurementEntry): Promise<void> {
    const normalized = normalizeMeasurementEntry(entry);
    const key = measurementDocId(normalized);
    if (!key) throw new Error("measurement missing stable key");
    await upsertWithQueue(uid, "measurements_local_v1", key, normalized);
  },

  async deleteMeasurement(uid: string, entryId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, "measurements_local_v1", entryId);
  },

  async clearCollection(uid: string, collectionName: string): Promise<void> {
    const snaps = await getDocs(collection(db, "users", uid, collectionName));
    if (snaps.empty) return;
    const batch = writeBatch(db);
    snaps.forEach((snap) => batch.delete(snap.ref));
    await batch.commit();
  },
};
