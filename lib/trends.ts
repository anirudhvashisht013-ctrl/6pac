// lib/trends.ts
import type { Point } from "@/lib/series";

export type TrendDirection = "up" | "down" | "flat" | "insufficient_data";

export type TrendResult = {
  direction: TrendDirection;
  slopePerDay: number | null;     // raw rate/day
  slopePerWeek: number | null;    // nicer to show
  r2: number | null;              // confidence-ish (0..1)
  lastValue: number | null;
  deltaFromStart: number | null;  // end - start (tracked points)
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Simple Moving Average. Keeps nulls where not enough data.
 * Uses only numeric values in the window. If none numeric => null.
 */
export function movingAverage(points: Point[], window: number): Point[] {
  const out: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    const nums = slice
      .map((p) => p.value)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    out.push({
      date: points[i].date,
      value: nums.length ? mean(nums) : null,
    });
  }

  return out;
}

/**
 * Linear regression over time index (0..n-1) using numeric points only.
 * Returns slope in "units per day index" (1 index = 1 day).
 */
export function linearTrend(points: Point[], flatThresholdPerWeek: number): TrendResult {
  const numeric = points
    .map((p, idx) => ({ idx, value: p.value, date: p.date }))
    .filter((p): p is { idx: number; value: number; date: string } => typeof p.value === "number" && Number.isFinite(p.value));

  if (numeric.length < 5) {
    return {
      direction: "insufficient_data",
      slopePerDay: null,
      slopePerWeek: null,
      r2: null,
      lastValue: numeric.length ? numeric[numeric.length - 1].value : null,
      deltaFromStart: null,
    };
  }

  const xs = numeric.map((p) => p.idx);
  const ys = numeric.map((p) => p.value);

  const xBar = mean(xs);
  const yBar = mean(ys);

  let num = 0;
  let den = 0;

  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - xBar) * (ys[i] - yBar);
    den += (xs[i] - xBar) * (xs[i] - xBar);
  }

  const slope = den === 0 ? 0 : num / den; // units per day
  const intercept = yBar - slope * xBar;

  // r2
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < xs.length; i++) {
    const yHat = slope * xs[i] + intercept;
    ssTot += (ys[i] - yBar) ** 2;
    ssRes += (ys[i] - yHat) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const slopePerWeek = slope * 7;

  // Decide direction with a per-metric threshold (passed in)
  const absWeek = Math.abs(slopePerWeek);
  let direction: TrendDirection = "flat";
  if (absWeek < flatThresholdPerWeek) direction = "flat";
  else direction = slopePerWeek > 0 ? "up" : "down";

  return {
    direction,
    slopePerDay: slope,
    slopePerWeek,
    r2,
    lastValue: numeric[numeric.length - 1].value,
    deltaFromStart: numeric[numeric.length - 1].value - numeric[0].value,
  };
}