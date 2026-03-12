// lib/repos/measurementsRepo.ts
import { getFirebaseDb } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";
import type { BodyMeasurementEntry as MirrorMeasurementEntry } from "@/lib/types";
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";
import {
  compareMeasurementDates,
  isMeasurementForDate,
  normalizeMeasurementEntries,
} from "@/lib/adapters/measurementKeyAdapter";
import { measurementDocId, normalizeMeasurementEntry } from "@/lib/measurements/identity";
import { parseTimestampDate } from "@/lib/measurements/slots";

const ref = (uid: string, date: ISODate) => doc(getFirebaseDb(), "users", uid, "measurements", date);
const col = (uid: string) => collection(getFirebaseDb(), "users", uid, "measurements");

function mirrorBestEffort(task: Promise<void>, label: string) {
  void task.catch((err) => {
    console.warn(`[measurements-mirror] ${label} failed`, err);
  });
}

function toIsoIfDateLike(value: unknown): string | undefined {
  const d = parseTimestampDate(value);
  return d ? d.toISOString() : undefined;
}

function toMirrorMeasurement(entry: BodyMeasurementEntry): MirrorMeasurementEntry {
  const normalized = normalizeMeasurementEntry(entry as MirrorMeasurementEntry);
  const key = measurementDocId(normalized);
  if (!key) {
    throw new Error("measurement missing stable key");
  }

  return {
    id: key,
    date: normalized.date,
    schemaVersion: normalized.schemaVersion,
    waist: normalized.waist,
    chest: normalized.chest,
    shoulders: normalized.shoulders,
    armsR: normalized.armsR,
    armsL: normalized.armsL,
    thighR: normalized.thighR,
    thighL: normalized.thighL,
    bicepsR: normalized.bicepsR,
    bicepsL: normalized.bicepsL,
    bodyFatPercent: normalized.bodyFatPercent,
    notes: normalized.notes,
    createdAt: toIsoIfDateLike(normalized.createdAt),
    loggedAt: toIsoIfDateLike(normalized.loggedAt) ?? normalized.loggedAt,
    updatedAt: toIsoIfDateLike(normalized.updatedAt),
  };
}

export const measurementsRepo = {
  async getByDate(uid: string, date: ISODate): Promise<BodyMeasurementEntry | null> {
    const snap = await getDoc(ref(uid, date));
    if (snap.exists()) {
      return normalizeMeasurementEntry(snap.data() as MirrorMeasurementEntry) as BodyMeasurementEntry;
    }

    const byDateSnaps = await getDocs(query(col(uid), where("date", "==", date)));
    const byIdSnaps = await getDocs(query(col(uid), where("id", "==", date)));
    const matches = normalizeMeasurementEntries(
      [...byDateSnaps.docs, ...byIdSnaps.docs].map((d) => d.data() as MirrorMeasurementEntry),
      "firestore-measurements:getByDate"
    );
    return matches.find((entry) => isMeasurementForDate(entry, date)) as BodyMeasurementEntry | null;
  },

  async getAll(uid: string): Promise<BodyMeasurementEntry[]> {
    const snaps = await getDocs(col(uid));
    return normalizeMeasurementEntries(
      snaps.docs.map((d) => d.data() as MirrorMeasurementEntry),
      "firestore-measurements:getAll"
    ).sort(compareMeasurementDates) as BodyMeasurementEntry[];
  },

  async getRange(uid: string, start: ISODate, end: ISODate): Promise<BodyMeasurementEntry[]> {
    const [dateSnaps, idSnaps] = await Promise.all([
      getDocs(query(col(uid), where("date", ">=", start), where("date", "<=", end))),
      getDocs(query(col(uid), where("id", ">=", start), where("id", "<=", end))),
    ]);
    return normalizeMeasurementEntries(
      [...dateSnaps.docs, ...idSnaps.docs].map((d) => d.data() as MirrorMeasurementEntry),
      "firestore-measurements:getRange"
    )
      .filter((entry) => entry.date >= start && entry.date <= end)
      .sort(compareMeasurementDates) as BodyMeasurementEntry[];
  },

  async upsert(uid: string, entry: BodyMeasurementEntry): Promise<void> {
    const normalized = normalizeMeasurementEntry(entry as MirrorMeasurementEntry);
    const key = measurementDocId(normalized);
    if (!key) {
      throw new Error("measurement missing stable key");
    }
    const docDate = normalized.date as ISODate;

    await setDoc(
      ref(uid, docDate),
      {
        ...normalized,
        createdAt: normalized.createdAt ?? serverTimestamp(),
        loggedAt: normalized.loggedAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    mirrorBestEffort(
      cloudMirrorRepo.upsertMeasurement(uid, toMirrorMeasurement(normalized as BodyMeasurementEntry)),
      `measurements/${key}`
    );
  },

  async deleteByDate(uid: string, date: ISODate): Promise<void> {
    const directSnap = await getDoc(ref(uid, date));
    const candidateSnaps = [
      ...(directSnap.exists() ? [directSnap] : []),
      ...(await getDocs(query(col(uid), where("date", "==", date)))).docs,
      ...(await getDocs(query(col(uid), where("id", "==", date)))).docs,
    ];
    const seenRefs = new Set<string>();
    for (const snap of candidateSnaps) {
      if (seenRefs.has(snap.ref.path)) continue;
      seenRefs.add(snap.ref.path);
      await deleteDoc(snap.ref);
    }
    mirrorBestEffort(cloudMirrorRepo.deleteMeasurement(uid, date), `measurements/${date}:delete`);
  },
};
