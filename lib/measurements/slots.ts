import { addDays, todayYMD } from "@/lib/dates";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";

export type MeasurementSlot = {
  date: ISODate;
  scheduledAt: Date;
};

export type SlotStatus = "done" | "upcoming" | "missed";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_ANCHOR_TIME = "T06:15:00";
const MAX_SLOT_GUARD = 220;

export function monthKeyFromYMD(ymd: string): string {
  return ymd.slice(0, 7);
}

export function ymdFromDate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}` as ISODate;
}

export function isISODateString(value: unknown): value is ISODate {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

export function parseTimestampDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const withToDate = value as { toDate?: () => unknown; seconds?: unknown };
    if (typeof withToDate.toDate === "function") {
      try {
        const d = withToDate.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }

    if (typeof withToDate.seconds === "number" && Number.isFinite(withToDate.seconds)) {
      const d = new Date(withToDate.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

export function hasAnyNumeric(entry: BodyMeasurementEntry | null | undefined): boolean {
  if (!entry) return false;

  const nums = [
    entry.waist,
    entry.chest,
    entry.shoulders,
    entry.armsR,
    entry.armsL,
    entry.thighR,
    entry.thighL,
    entry.bicepsR,
    entry.bicepsL,
    entry.bodyFatPercent,
  ];
  return nums.some((v) => typeof v === "number");
}

export function sortByDate(entries: BodyMeasurementEntry[]): BodyMeasurementEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export function resolveMeasurementAnchor(entries: BodyMeasurementEntry[]): Date | null {
  if (entries.length === 0) return null;
  const sorted = sortByDate(entries);
  const firstReal = sorted.find((e) => hasAnyNumeric(e)) ?? sorted[0];

  const fromLogged = parseTimestampDate(firstReal.loggedAt);
  if (fromLogged) return fromLogged;

  const fromCreated = parseTimestampDate(firstReal.createdAt);
  if (fromCreated) return fromCreated;

  const fallback = new Date(`${firstReal.date}${DEFAULT_ANCHOR_TIME}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function buildCadenceSlots(
  anchor: Date | null,
  rangeEndYMD: ISODate,
  now: Date = new Date()
): MeasurementSlot[] {
  if (!anchor) return [];

  const start = new Date(anchor);
  const end = new Date(`${rangeEndYMD}T23:59:59`);

  const anchorH = start.getHours();
  const anchorM = start.getMinutes();
  const slots: MeasurementSlot[] = [];

  let current = new Date(start);
  current.setSeconds(0, 0);
  current.setHours(anchorH, anchorM, 0, 0);

  let guard = 0;
  while (current.getTime() <= end.getTime() && guard < MAX_SLOT_GUARD) {
    slots.push({ date: ymdFromDate(current), scheduledAt: new Date(current) });
    current = addDays(current, 15);
    guard += 1;
  }

  if (slots.length > 0) {
    const last = slots[slots.length - 1];
    if (last.scheduledAt.getTime() < now.getTime()) {
      const next = addDays(last.scheduledAt, 15);
      slots.push({ date: ymdFromDate(next), scheduledAt: next });
    }
  }

  return slots;
}

export function deriveMonthKeys(
  anchor: Date | null,
  slots: MeasurementSlot[],
  today: ISODate = todayYMD()
): string[] {
  if (!anchor) return [monthKeyFromYMD(today)];
  const keys = Array.from(new Set(slots.map((s) => monthKeyFromYMD(s.date))));
  keys.sort();
  return keys;
}

export function slotStatus(
  slot: MeasurementSlot,
  entry: BodyMeasurementEntry | null,
  now: Date
): SlotStatus {
  if (entry && hasAnyNumeric(entry)) return "done";
  if (slot.scheduledAt.getTime() > now.getTime()) return "upcoming";
  return "missed";
}

export function prevRealEntryBefore(
  sortedEntries: BodyMeasurementEntry[],
  date: ISODate
): BodyMeasurementEntry | null {
  for (let i = sortedEntries.length - 1; i >= 0; i -= 1) {
    const entry = sortedEntries[i];
    if (entry.date >= date) continue;
    if (hasAnyNumeric(entry)) return entry;
  }
  return null;
}

export function latestRealEntryOnOrBefore(
  sortedEntries: BodyMeasurementEntry[],
  date: ISODate
): BodyMeasurementEntry | null {
  for (let i = sortedEntries.length - 1; i >= 0; i -= 1) {
    const entry = sortedEntries[i];
    if (entry.date > date) continue;
    if (hasAnyNumeric(entry)) return entry;
  }
  return null;
}

export function canLogMeasurementDay(scheduledYMD: ISODate, now: Date = new Date()): boolean {
  const [y, m, d] = scheduledYMD.split("-").map(Number);
  const slotDay = new Date(y, m - 1, d).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return slotDay <= todayMidnight;
}
