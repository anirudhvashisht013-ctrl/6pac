import { getFirebaseDb } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type {
  BodyMeasurementEntry,
  DailySummaryMirrorDoc,
  DailyLog,
  ExerciseLibraryItem,
  MealEntry,
  ReminderSettingsMirrorDoc,
  WeekSchedule,
  WeeklyTarget,
  WorkoutSession,
  WorkoutTemplate,
} from "@/lib/types";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import { mirrorCollections } from "@/lib/sync/mirrorSchema";
import {
  enqueueMirrorDelete,
  enqueueMirrorUpsert,
  initializeMirrorQueue,
  processMirrorQueue,
} from "@/lib/sync/mirrorQueue";

const TOMBSTONES_COLLECTION = mirrorCollections.syncTombstones;

function tombstoneDocId(collectionName: string, docId: string) {
  return `${encodeURIComponent(collectionName)}|${encodeURIComponent(docId)}`;
}

async function upsertDirect(
  uid: string,
  collectionName: string,
  id: string,
  payload: Record<string, unknown>
) {
  await setDoc(
    doc(getFirebaseDb(), "users", uid, collectionName, id),
    {
      ...payload,
      mirroredAt: serverTimestamp(),
      mirrorVersion: 1,
    },
    { merge: true }
  );
}

async function deleteDirect(uid: string, collectionName: string, id: string) {
  await deleteDoc(doc(getFirebaseDb(), "users", uid, collectionName, id));
}

async function upsertWithQueue(uid: string, collectionName: string, id: string, payload: unknown) {
  initializeMirrorQueue();
  const normalized = (payload || {}) as Record<string, unknown>;

  // Fast path: write directly when possible so cloud reflects changes immediately.
  // If this fails (offline / permission / transient), fallback to durable queue.
  try {
    await upsertDirect(uid, collectionName, id, normalized);
    await deleteDirect(uid, TOMBSTONES_COLLECTION, tombstoneDocId(collectionName, id));
    return;
  } catch {
    // Queue fallback handled below.
  }

  // NOTE: Keep these queue writes sequential. Parallel writes can race on
  // AsyncStorage-backed queue persistence and drop one of the operations.
  await enqueueMirrorUpsert(uid, collectionName, id, normalized);
  // Clear stale delete marker when entity is recreated/updated.
  await enqueueMirrorDelete(uid, TOMBSTONES_COLLECTION, tombstoneDocId(collectionName, id));
  void processMirrorQueue();
}

async function removeWithTombstoneQueue(uid: string, collectionName: string, id: string) {
  initializeMirrorQueue();
  const deletedAt = new Date().toISOString();

  // Fast path: direct cloud write/delete.
  try {
    await deleteDirect(uid, collectionName, id);
    await upsertDirect(uid, TOMBSTONES_COLLECTION, tombstoneDocId(collectionName, id), {
      collectionName,
      docId: id,
      deletedAt,
    });
    return;
  } catch {
    // Queue fallback handled below.
  }

  // NOTE: Keep these queue writes sequential for the same reason as above.
  await enqueueMirrorDelete(uid, collectionName, id);
  await enqueueMirrorUpsert(uid, TOMBSTONES_COLLECTION, tombstoneDocId(collectionName, id), {
    collectionName,
    docId: id,
    deletedAt,
  });
  void processMirrorQueue();
}

export const cloudMirrorRepo = {
  async upsertLog(uid: string, log: DailyLog): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.dailyLogs, log.date, log);
  },

  async upsertTarget(uid: string, target: WeeklyTarget): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.weeklyTargets, target.weekStartDate, target);
  },

  async upsertSchedule(uid: string, schedule: WeekSchedule): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.weeklyPlans, schedule.weekStartDate, schedule);
  },

  async upsertTemplate(uid: string, template: WorkoutTemplate): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.workoutTemplates, template.id, template);
  },

  async deleteTemplate(uid: string, templateId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, mirrorCollections.workoutTemplates, templateId);
  },

  async upsertExercise(uid: string, exercise: ExerciseLibraryItem): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.exercises, exercise.id, exercise);
  },

  async deleteExercise(uid: string, exerciseId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, mirrorCollections.exercises, exerciseId);
  },

  async upsertMeal(uid: string, meal: MealEntry): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.nutritionEntries, meal.id, meal);
  },

  async deleteMeal(uid: string, mealId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, mirrorCollections.nutritionEntries, mealId);
  },

  async upsertSession(uid: string, session: WorkoutSession): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.workoutSessions, session.id, session);
  },

  async upsertDailySummaryProjection(uid: string, summary: DailySummaryMirrorDoc): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.dailySummaries, summary.date, summary);
  },

  // Compatibility alias while callers migrate to projection terminology.
  async upsertDailySummary(uid: string, summary: DailySummaryMirrorDoc): Promise<void> {
    await this.upsertDailySummaryProjection(uid, summary);
  },

  async upsertMeasurement(uid: string, entry: BodyMeasurementEntry): Promise<void> {
    const normalized = normalizeMeasurementEntry(entry);
    const key = measurementDocId(normalized);
    if (!key) throw new Error("measurement missing stable key");
    await upsertWithQueue(uid, mirrorCollections.bodyMeasurements, key, normalized);
  },

  async deleteMeasurement(uid: string, entryId: string): Promise<void> {
    await removeWithTombstoneQueue(uid, mirrorCollections.bodyMeasurements, entryId);
  },

  async upsertReminderSettings(uid: string, doc: ReminderSettingsMirrorDoc): Promise<void> {
    await upsertWithQueue(uid, mirrorCollections.reminderSettings, "primary", doc as unknown as Record<string, unknown>);
  },

  async clearCollection(uid: string, collectionName: string): Promise<void> {
    const snaps = await getDocs(collection(getFirebaseDb(), "users", uid, collectionName));
    if (snaps.empty) return;
    const batch = writeBatch(getFirebaseDb());
    snaps.forEach((snap) => batch.delete(snap.ref));
    await batch.commit();
  },
};
