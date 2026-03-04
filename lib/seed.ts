// lib/seed.ts
import { toYMD, addDays, getMondayYMD } from "@/lib/dates";
import {
  logsRepo,
  mealsRepo,
  sessionsRepo,
  targetsRepo,
  measurementsRepo,
} from "@/lib/storage";
import type {
  BodyMeasurementEntry,
  DailyLog,
  MealEntry,
  WeeklyTarget,
  WorkoutSession,
} from "@/lib/types";

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
 * - Local logs/meals/sessions/targets for last `daysBack` days
 * - Measurements: every ~14 days over last `measureDaysBack` days
 */
export async function seedTestUser(
  uid: string,
  daysBack = 90,
  measureDaysBack = 180
): Promise<void> {
  const endDate = new Date();
  const weekStarts = new Set<string>();
  const nowIso = new Date().toISOString();
  let weight = 90;

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = toYMD(addDays(endDate, -i));
    weekStarts.add(getMondayYMD(date));

    weight = weight + rand(-0.15, 0.1);

    const didWorkout = chance(0.62);
    const trackedNutrition = chance(0.8);
    const trackedSteps = chance(0.85);
    const trackedWater = chance(0.8);
    const trackedSleep = chance(0.75);

    const steps = trackedSteps ? randInt(3500, 12000) : null;
    const waterMl = trackedWater ? randInt(1600, 4000) : null;
    const sleepHours = trackedSleep ? Number(rand(5.5, 8.5).toFixed(1)) : null;

    const log: DailyLog = {
      date,
      weightKg: Number(weight.toFixed(1)),
      sleepHours,
      steps,
      waterMl,
      supplementsTaken: chance(0.35),
      caloriesManual: trackedNutrition && chance(0.3) ? randInt(120, 500) : null,
      notes: chance(0.08) ? "seeded" : null,
      updatedAt: nowIso,
    };
    await logsRepo.save(uid, log);

    if (trackedNutrition) {
      const mealCount = randInt(2, 4);
      for (let mealIndex = 0; mealIndex < mealCount; mealIndex += 1) {
        const meal: MealEntry = {
          id: `seed-meal-${date}-${mealIndex}`,
          date,
          mealName:
            mealIndex === 0 ? "Breakfast" : mealIndex === 1 ? "Lunch" : mealIndex === 2 ? "Dinner" : "Snack",
          notes: chance(0.2) ? "seeded" : null,
          calories: randInt(300, 900),
          proteinG: randInt(18, 55),
          carbsG: randInt(20, 100),
          fatG: randInt(8, 35),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await mealsRepo.save(uid, meal);
      }
    }

    if (didWorkout) {
      const start = new Date(`${date}T00:00:00.000Z`);
      start.setUTCHours(randInt(5, 20), randInt(0, 50), 0, 0);

      const durationMin = randInt(25, 80);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);

      const session: WorkoutSession = {
        id: `seed-session-${date}`,
        date,
        workoutTemplateId: "seed-template",
        workoutNameSnapshot: chance(0.5) ? "Strength" : chance(0.5) ? "Cardio" : "Mixed",
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        completed: true,
        blockPerformances: [],
      };
      await sessionsRepo.save(uid, session);
    }
  }

  for (const weekStartDate of weekStarts) {
    const target: WeeklyTarget = {
      weekStartDate,
      dailyCaloriesTarget: 2400,
      dailyStepsTarget: 8000,
      dailyWaterMlTarget: 2500,
      weightGoalType: "maintain",
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await targetsRepo.save(uid, target);
  }

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
      createdAt: nowIso,
      loggedAt: nowIso,
      updatedAt: nowIso,
    };

    await measurementsRepo.save(uid, entry);
  }
}
