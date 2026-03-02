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
  serverTimestamp,
} from "firebase/firestore";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";

const ref = (uid: string, date: ISODate) => doc(db, "users", uid, "measurements", date);
const col = (uid: string) => collection(db, "users", uid, "measurements");

export const measurementsRepo = {
  async getByDate(uid: string, date: ISODate): Promise<BodyMeasurementEntry | null> {
    const snap = await getDoc(ref(uid, date));
    return snap.exists() ? (snap.data() as BodyMeasurementEntry) : null;
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
      },
      { merge: true }
    );
  },
};