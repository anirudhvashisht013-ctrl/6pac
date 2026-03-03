// lib/repos/measurementsRepo.ts
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";
import type { BodyMeasurementEntry as MirrorMeasurementEntry } from "@/lib/types";
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";
import { parseTimestampDate } from "@/lib/measurements/slots";

const ref = (uid: string, date: ISODate) => doc(db, "users", uid, "measurements", date);
const col = (uid: string) => collection(db, "users", uid, "measurements");

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
  return {
    id: entry.date,
    date: entry.date,
    schemaVersion: entry.schemaVersion,
    waist: entry.waist,
    chest: entry.chest,
    shoulders: entry.shoulders,
    armsR: entry.armsR,
    armsL: entry.armsL,
    thighR: entry.thighR,
    thighL: entry.thighL,
    bicepsR: entry.bicepsR,
    bicepsL: entry.bicepsL,
    bodyFatPercent: entry.bodyFatPercent,
    notes: entry.notes,
    createdAt: toIsoIfDateLike(entry.createdAt),
    loggedAt: toIsoIfDateLike(entry.loggedAt) ?? entry.loggedAt,
    updatedAt: toIsoIfDateLike(entry.updatedAt),
  };
}

export const measurementsRepo = {
  async getByDate(uid: string, date: ISODate): Promise<BodyMeasurementEntry | null> {
    const snap = await getDoc(ref(uid, date));
    return snap.exists() ? (snap.data() as BodyMeasurementEntry) : null;
  },

  async getAll(uid: string): Promise<BodyMeasurementEntry[]> {
    const snaps = await getDocs(col(uid));
    return snaps.docs
      .map((d) => d.data() as BodyMeasurementEntry)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async getRange(uid: string, start: ISODate, end: ISODate): Promise<BodyMeasurementEntry[]> {
    const q = query(col(uid), where("date", ">=", start), where("date", "<=", end));
    const snaps = await getDocs(q);
    return snaps.docs
      .map((d) => d.data() as BodyMeasurementEntry)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async upsert(uid: string, entry: BodyMeasurementEntry): Promise<void> {
    await setDoc(
      ref(uid, entry.date),
      {
        ...entry,
        createdAt: entry.createdAt ?? serverTimestamp(),
        loggedAt: entry.loggedAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    mirrorBestEffort(
      cloudMirrorRepo.upsertMeasurement(uid, toMirrorMeasurement(entry)),
      `measurements/${entry.date}`
    );
  },

  async deleteByDate(uid: string, date: ISODate): Promise<void> {
    await deleteDoc(ref(uid, date));
    mirrorBestEffort(cloudMirrorRepo.deleteMeasurement(uid, date), `measurements/${date}:delete`);
  },
};
