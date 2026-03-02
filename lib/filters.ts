// lib/filters.ts
import type { DailySnapshot } from "@/lib/models";

export type DayPredicate = (d: DailySnapshot) => boolean;

export const Filters = {
  workoutDays: (): DayPredicate => (d) => d.didWorkout === true,
  proteinTracked: (): DayPredicate => (d) => d.proteinG != null,
  sleepTracked: (): DayPredicate => (d) => d.sleepHours != null,
  stepsAtLeast: (min: number): DayPredicate => (d) => (d.steps ?? -1) >= min,
  sleepBelow: (hrs: number): DayPredicate => (d) => (d.sleepHours ?? 999) < hrs,
  hitProtein: (): DayPredicate => (d) => d.hitProtein === true,
};

export function applyFilters(days: DailySnapshot[], preds: DayPredicate[]): DailySnapshot[] {
  return preds.length ? days.filter((d) => preds.every((p) => p(d))) : days;
}