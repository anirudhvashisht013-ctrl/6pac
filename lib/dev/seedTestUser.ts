// lib/dev/seedTestUser.ts
import type { DailySnapshot, BodyMeasurementEntry, ISODate } from "@/lib/models";
import { todayYMD, addDays, toYMD } from "@/lib/dates";
import { daysRepo } from "@/lib/repos/daysRepo";
import { measurementsRepo } from "@/lib/repos/measurementsRepo";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.round(rand(min, max));
}
function chance(p: number) {
  return Math.random() < p;
}

/**
 * Seeds realistic dummy data for the CURRENT logged-in user.
 * - Daily snapshots: last `daysBack` days
 * - Measurements: every ~14 days over last `measureDaysBack` days
 */
export async function seedTestUser(
  uid: string,
  daysBack = 90,
  measureDaysBack = 180
): Promise<void> {
  // Use Date internally, convert to ISODate only when writing.
  const endDate = new Date();

  // Helper: add N days to an ISODate and get ISODate back
  const addDaysISO = (iso: ISODate, days: number): ISODate => {
    const base = new Date(`${iso}T00:00:00`);
    const d = addDays(base, days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}` as ISODate;
  };

  // --- Daily Snapshots ---
  let weight = 90;
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = toYMD(addDays(endDate, -i));

    weight = weight + rand(-0.15, 0.1);

    const didWorkout = chance(0.62);
    const trackedNutrition = chance(0.8);
    const trackedSteps = chance(0.85);
    const trackedWater = chance(0.8);
    const trackedSleep = chance(0.75);

    const calories = trackedNutrition ? randInt(1800, 2700) : null;
    const proteinG = trackedNutrition ? randInt(110, 190) : null;
    const carbsG = trackedNutrition ? randInt(140, 260) : null;
    const fatG = trackedNutrition ? randInt(45, 90) : null;

    const steps = trackedSteps ? randInt(3000, 12000) : null;
    const waterMl = trackedWater ? randInt(1500, 4000) : null;
    const sleepHours = trackedSleep ? Number(rand(5.5, 8.5).toFixed(1)) : null;

    const workoutMinutes = didWorkout ? randInt(25, 80) : null;
    const workoutName = didWorkout
      ? chance(0.5)
        ? "Strength"
        : chance(0.5)
          ? "Cardio"
          : "Mixed"
      : null;

    const hitCalories = calories == null ? null : chance(0.6);
    const hitProtein = proteinG == null ? null : chance(0.55);
    const hitSteps = steps == null ? null : chance(0.5);
    const hitWater = waterMl == null ? null : chance(0.6);

    const day: DailySnapshot = {
      date,
      weightKg: Number(weight.toFixed(1)),
      sleepHours,
      steps,
      waterMl,
      calories,
      proteinG,
      carbsG,
      fatG,
      didWorkout,
      workoutMinutes,
      workoutName,
      workoutSessionIds: [],
      hitCalories,
      hitProtein,
      hitSteps,
      hitWater,
      supplementsTaken: chance(0.35),
      notes: chance(0.08) ? "seeded" : null,
      updatedAt: new Date(),
    };

    const { date: dayDate, ...patch } = day;
    await daysRepo.upsert(uid, dayDate, patch);
  }

  // --- Measurements (every ~14 days) ---
  let waist = 92;
  let bf = 20;

  for (let i = measureDaysBack; i >= 0; i -= 14) {
    const date = toYMD(addDays(endDate, -i));

    waist = waist + rand(-0.4, 0.2);
    bf = bf + rand(-0.25, 0.15);

    const entry: BodyMeasurementEntry = {
      date,
      waist: Number(waist.toFixed(1)),
      chest: Number(rand(100, 108).toFixed(1)),
      shoulders: Number(rand(112, 120).toFixed(1)),
      armsR: Number(rand(34, 38).toFixed(1)),
      armsL: Number(rand(34, 38).toFixed(1)),
      thighR: Number(rand(52, 60).toFixed(1)),
      thighL: Number(rand(52, 60).toFixed(1)),
      bicepsR: Number(rand(30, 36).toFixed(1)),
      bicepsL: Number(rand(30, 36).toFixed(1)),
      bodyFatPercent: Number(bf.toFixed(1)),
      notes: "seeded",
      createdAt: new Date(),
    };

    await measurementsRepo.upsert(uid, entry);
  }
}