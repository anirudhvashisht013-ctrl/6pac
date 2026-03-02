// lib/ranges.ts
import { toISODate } from "@/lib/dateKeys";

export type DateRange = {
  start: string; // ISO YYYY-MM-DD
  end: string;
};

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

export function lastNDays(n: number): DateRange {
  const end = new Date();
  const start = shiftDays(end, -(n - 1));

  return {
    start: toISODate(start),
    end: toISODate(end),
  };
}

export function presetRange(type: "2w" | "1m" | "3m" | "1y"): DateRange {
  switch (type) {
    case "2w":
      return lastNDays(14);
    case "1m":
      return lastNDays(30);
    case "3m":
      return lastNDays(90);
    case "1y":
      return lastNDays(365);
  }
}