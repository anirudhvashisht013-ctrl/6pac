// lib/compare.ts
import type { PeriodStats } from "@/lib/analytics";

export type Comparison = {
  deltaCalories: number | null;
  deltaProtein: number | null;
  deltaSteps: number | null;
  deltaWorkoutMinutes: number | null;
};

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return a - b;
}

export function comparePeriods(
  current: PeriodStats,
  previous: PeriodStats
): Comparison {
  return {
    deltaCalories: delta(current.avgCalories, previous.avgCalories),
    deltaProtein: delta(current.avgProtein, previous.avgProtein),
    deltaSteps: delta(current.avgSteps, previous.avgSteps),
    deltaWorkoutMinutes: delta(
      current.totalWorkoutMinutes,
      previous.totalWorkoutMinutes
    ),
  };
}