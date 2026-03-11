// lib/repos/sessionsRepo.ts
import { getFirebaseDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type { ISODate, WorkoutSession, DailySnapshot } from "@/lib/models";
import { daysRepo } from "@/lib/repos/daysRepo";
import { n0 } from "@/lib/math";

const sessionsCol = (uid: string) => collection(getFirebaseDb(), "users", uid, "sessions");
const sessionRef = (uid: string, id: string) => doc(getFirebaseDb(), "users", uid, "sessions", id);

async function recomputeDayWorkoutSummary(
  uid: string,
  date: ISODate
): Promise<Pick<DailySnapshot, "didWorkout" | "workoutMinutes" | "workoutName" | "workoutSessionIds">> {
  const snaps = await getDocs(query(sessionsCol(uid), where("date", "==", date)));
  if (snaps.empty) {
    return { didWorkout: false, workoutMinutes: null, workoutName: null, workoutSessionIds: [] };
  }

  const sessions = snaps.docs.map((d) => d.data() as WorkoutSession);

  const completed = sessions.filter((s) => s.completed);
  const didWorkout = completed.length > 0;

  const minutes = didWorkout
    ? completed.reduce((acc, s) => acc + n0(s.durationMin), 0)
    : null;

  // Snapshot a representative name (latest completed)
  const workoutName = didWorkout ? completed[completed.length - 1].workoutNameSnapshot : null;
  const workoutSessionIds = completed.map((s) => s.id);

  return { didWorkout, workoutMinutes: minutes, workoutName, workoutSessionIds };
}

export const sessionsRepo = {
  async getByDate(uid: string, date: ISODate): Promise<WorkoutSession[]> {
    const snaps = await getDocs(query(sessionsCol(uid), where("date", "==", date)));
    return snaps.docs.map((d) => d.data() as WorkoutSession);
  },

  async upsert(uid: string, session: WorkoutSession): Promise<void> {
    // Ensure parent day doc exists
    await daysRepo.upsert(uid, session.date, {
      date: session.date,
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
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });

    await setDoc(
      sessionRef(uid, session.id),
      {
        ...session,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const summary = await recomputeDayWorkoutSummary(uid, session.date);
    await daysRepo.upsert(uid, session.date, summary);
  },

  async delete(uid: string, sessionId: string, date: ISODate): Promise<void> {
    await deleteDoc(sessionRef(uid, sessionId));
    const summary = await recomputeDayWorkoutSummary(uid, date);
    await daysRepo.upsert(uid, date, summary);
  },
};