// lib/repos/daysRepo.ts
import { getFirebaseDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import type { DailySnapshot, ISODate } from "@/lib/models";

const dayRef = (uid: string, date: ISODate) => doc(getFirebaseDb(), "users", uid, "days", date);
const daysCol = (uid: string) => collection(getFirebaseDb(), "users", uid, "days");

export const daysRepo = {
  async getByDate(uid: string, date: ISODate): Promise<DailySnapshot | null> {
    const snap = await getDoc(dayRef(uid, date));
    return snap.exists() ? (snap.data() as DailySnapshot) : null;
  },

  async upsert(uid: string, date: ISODate, patch: Partial<DailySnapshot>): Promise<void> {
    // Ensure doc always has date and stable fields
    const base: Partial<DailySnapshot> = {
      date,
      updatedAt: serverTimestamp(),
    };

    await setDoc(dayRef(uid, date), { ...base, ...patch }, { merge: true });
  },

  async getRange(uid: string, start: ISODate, end: ISODate): Promise<DailySnapshot[]> {
    // Works because date is also stored as a field "date".
    // We'll also use docId = date, but field queries are simplest for ranges.
    const q = query(
      daysCol(uid),
      where("date", ">=", start),
      where("date", "<=", end)
    );
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => d.data() as DailySnapshot).sort((a, b) => a.date.localeCompare(b.date));
  },
};