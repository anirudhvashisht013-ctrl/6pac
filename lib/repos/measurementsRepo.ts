// lib/repos/measurementsRepo.ts
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";

const ref = (uid: string, date: ISODate) => doc(db, "users", uid, "measurements", date);

export const measurementsRepo = {
  async getByDate(uid: string, date: ISODate): Promise<BodyMeasurementEntry | null> {
    const snap = await getDoc(ref(uid, date));
    return snap.exists() ? (snap.data() as BodyMeasurementEntry) : null;
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