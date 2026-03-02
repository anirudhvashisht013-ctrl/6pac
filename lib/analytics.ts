// lib/analytics.ts
import type { DailySnapshot } from "@/lib/models";
import { n0 } from "@/lib/math";

export type PeriodStats = {
  daysTracked: number;
  workoutDays: number;

  avgCalories: number | null;
  avgProtein: number | null;
  avgSteps: number | null;
  avgSleep: number | null;

  totalWorkouts: number;
  totalWorkoutMinutes: number;

  adherenceRate: number | null; // % days hit protein
};

function average(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => typeof v === "number");
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

export function computePeriodStats(days: DailySnapshot[]): PeriodStats {
  if (!days.length) {
    return {
      daysTracked: 0,
      workoutDays: 0,
      avgCalories: null,
      avgProtein: null,
      avgSteps: null,
      avgSleep: null,
      totalWorkouts: 0,
      totalWorkoutMinutes: 0,
      adherenceRate: null,
    };
  }

  const workoutDays = days.filter((d) => d.didWorkout).length;

  const totalWorkoutMinutes = days.reduce(
    (acc, d) => acc + n0(d.workoutMinutes),
    0
  );

  const proteinHits = days.filter((d) => d.hitProtein === true).length;

  return {
    daysTracked: days.length,
    workoutDays,
    avgCalories: average(days.map((d) => d.calories)),
    avgProtein: average(days.map((d) => d.proteinG)),
    avgSteps: average(days.map((d) => d.steps)),
    avgSleep: average(days.map((d) => d.sleepHours)),
    totalWorkouts: workoutDays,
    totalWorkoutMinutes,
    adherenceRate:
      days.length > 0 ? (proteinHits / days.length) * 100 : null,
  };
}