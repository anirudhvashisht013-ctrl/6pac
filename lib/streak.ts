import type { ISODate } from "./models";
import type { DailyLog } from "./types";
import { todayYMD, toYMD, addDays, formatDateLong } from "./dates";

/**
 * A small WWSS record for a single day.
 * "WWSS" stands for Weight / Water / Sleep / Steps – the four
 * basic metrics we care about for the streak UI.  The UI uses
 * the `score` value to decide how "lit" the fire should appear.
 */
export type DayWWSS = {
  date: ISODate;
  weight: boolean;
  sleep: boolean;
  water: boolean;
  steps: boolean;
  score: number; // 0..4
};

export function computeDayWWSS(log: DailyLog | null): DayWWSS {
  if (!log) {
    const today = todayYMD();
    return { date: today, weight: false, sleep: false, water: false, steps: false, score: 0 };
  }
  const weight = log.weightKg != null;
  const sleep = log.sleepHours != null;
  const water = log.waterMl != null;
  const steps = log.steps != null;
  const score = [weight, sleep, water, steps].filter(Boolean).length;
  return { date: log.date as ISODate, weight, sleep, water, steps, score };
}

/**
 * Generate a contiguous window of DayWWSS entries ending on `endDate`.
 * If the log for a particular day is missing we still include a record
 * with score 0 so that the UI can render an "unlit" icon for that slot.
 *
 * @param startDate optional ISODate.  If provided the window will be
 *        clipped so that no days earlier than `startDate` are returned.
 */
export function generateWindow(
  logs: DailyLog[],
  days: number = 30,
  endDate: ISODate = todayYMD(),
  startDate?: ISODate
): DayWWSS[] {
  const map = new Map<string, DailyLog>(logs.map((l) => [l.date, l]));
  let out: DayWWSS[] = [];
  // build backwards so that oldest is first
  for (let i = days - 1; i >= 0; i--) {
    const d = toYMD(addDays(new Date(`${endDate}T00:00:00`), -i));
    const log = map.get(d) || null;
    out.push(computeDayWWSS(log));
  }
  if (startDate) {
    out = out.filter((d) => d.date >= startDate);
  }
  return out;
}

// helpers
function toDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * Compute the current streak using a 12‑hour grace period for the
 * previous day.  If today or yesterday is missing and we are still
 * before noon local time, the streak is not considered broken yet.
 */
export function computeCurrentStreak(
  window: DayWWSS[],
  now: Date = new Date()
): number {
  const map = new Map<string, number>(window.map((d) => [d.date, d.score]));
  const today = toYMD(now);
  const yesterday = toYMD(addDays(new Date(`${today}T00:00:00`), -1));
  const isPastNoon = now.getHours() >= 12;

  let streak = 0;
  let cursor = today;

  while (true) {
    const score = map.get(cursor) || 0;
    if (score > 0) {
      streak++;
      cursor = toYMD(addDays(new Date(`${cursor}T00:00:00`), -1));
      continue;
    }

    if (
      (!isPastNoon && cursor === today) ||
      (!isPastNoon && cursor === yesterday)
    ) {
      cursor = toYMD(addDays(new Date(`${cursor}T00:00:00`), -1));
      continue;
    }

    break;
  }

  return streak;
}

/**
 * Determine the longest historical streak in a series of logs.  This
 * ignores grace and only counts days that actually have WWSS data.
 */
export function computeMaxStreakFromLogs(logs: DailyLog[]): number {
  if (logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let max = 0;
  let current = 0;
  let prevDate: ISODate | null = null;

  for (const log of sorted) {
    const hasAny =
      log.weightKg != null ||
      log.sleepHours != null ||
      log.waterMl != null ||
      log.steps != null;
    if (hasAny) {
      if (prevDate) {
        const diff =
          (new Date(`${log.date}T00:00:00`).getTime() -
            new Date(`${prevDate}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diff === 1) {
          current++;
        } else {
          current = 1;
        }
      } else {
        current = 1;
      }
      max = Math.max(max, current);
    } else {
      current = 0;
    }
    prevDate = log.date as ISODate;
  }

  return max;
}

/**
 * Legacy helper kept for compatibility.  See `computeCurrentStreak`.
 */
export function computeStreak(window: DayWWSS[], today: ISODate = todayYMD()): number {
  const map = new Map<string, number>(window.map((d) => [d.date, d.score]));
  let streak = 0;
  let cursor = today;
  while (true) {
    const score = map.get(cursor) || 0;
    if (score > 0) {
      streak++;
      const prev = toYMD(addDays(new Date(`${cursor}T00:00:00`), -1));
      cursor = prev;
      continue;
    }
    break;
  }
  return streak;
}
