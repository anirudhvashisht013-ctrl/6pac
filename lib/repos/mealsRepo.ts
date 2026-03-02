// lib/repos/mealsRepo.ts
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  serverTimestamp,
} from "firebase/firestore";
import type { ISODate, MealEntry, DailySnapshot } from "@/lib/models";
import { daysRepo } from "@/lib/repos/daysRepo";
import { n0 } from "@/lib/math";

const mealsCol = (uid: string, date: ISODate) =>
  collection(db, "users", uid, "days", date, "meals");

const mealRef = (uid: string, date: ISODate, mealId: string) =>
  doc(db, "users", uid, "days", date, "meals", mealId);

async function recomputeDayMacrosFromMeals(
  uid: string,
  date: ISODate
): Promise<Pick<DailySnapshot, "calories" | "proteinG" | "carbsG" | "fatG">> {
  const snaps = await getDocs(query(mealsCol(uid, date)));
  if (snaps.empty) {
    return { calories: null, proteinG: null, carbsG: null, fatG: null };
  }

  let c = 0, p = 0, cb = 0, f = 0;
  let any = false;

  for (const d of snaps.docs) {
    const m = d.data() as MealEntry;
    const hasAnyMacro =
      m.calories != null || m.proteinG != null || m.carbsG != null || m.fatG != null;
    if (!hasAnyMacro) continue;

    any = true;
    c += n0(m.calories);
    p += n0(m.proteinG);
    cb += n0(m.carbsG);
    f += n0(m.fatG);
  }

  // If meals exist but none has macro data, keep nulls
  if (!any) return { calories: null, proteinG: null, carbsG: null, fatG: null };

  return { calories: c, proteinG: p, carbsG: cb, fatG: f };
}

export const mealsRepo = {
  async getByDate(uid: string, date: ISODate): Promise<MealEntry[]> {
    const snaps = await getDocs(query(mealsCol(uid, date)));
    return snaps.docs.map((d) => d.data() as MealEntry);
  },

  async upsert(uid: string, meal: MealEntry): Promise<void> {
    const ref = mealRef(uid, meal.date, meal.id);

    // Ensure parent day doc exists (daysRepo.upsert is merge-safe)
    await daysRepo.upsert(uid, meal.date, {
      date: meal.date,
      // keep analytics fields stable even if not set yet
      didWorkout: false,
      workoutMinutes: null,
      workoutName: null,
      workoutSessionIds: [],
      hitCalories: null,
      hitProtein: null,
      hitSteps: null,
      hitWater: null,
      supplementsTaken: null,
      notes: null,
      weightKg: null,
      sleepHours: null,
      steps: null,
      waterMl: null,
    });

    await setDoc(
      ref,
      {
        ...meal,
        createdAt: meal.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Recompute macros totals into the day snapshot (Option B)
    const totals = await recomputeDayMacrosFromMeals(uid, meal.date);
    await daysRepo.upsert(uid, meal.date, totals);
  },

  async delete(uid: string, date: ISODate, mealId: string): Promise<void> {
    await deleteDoc(mealRef(uid, date, mealId));
    const totals = await recomputeDayMacrosFromMeals(uid, date);
    await daysRepo.upsert(uid, date, totals);
  },
};