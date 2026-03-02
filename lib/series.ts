// lib/series.ts
import type { DailySnapshot } from "@/lib/models";

export type Point = { date: string; value: number | null };

export function toSeries(
  days: DailySnapshot[],
  pick: (d: DailySnapshot) => number | null
): Point[] {
  // assumes days sorted asc by date (your daysRepo.getRange does this)
  return days.map((d) => ({ date: d.date, value: pick(d) }));
}

export function compactSeries(points: Point[]): Point[] {
  // keep only points that have a number
  return points.filter((p) => typeof p.value === "number" && Number.isFinite(p.value));
}

export function values(points: Point[]): number[] {
  return points
    .map((p) => p.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}