import type { ISODate } from "@/lib/models";
import type { BodyMeasurementEntry } from "@/lib/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODateString(value: unknown): value is ISODate {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

export function measurementDocId(input: { date?: unknown; id?: unknown }): string | null {
  if (isISODateString(input.date)) return input.date;

  if (typeof input.id === "string") {
    const trimmed = input.id.trim();
    if (trimmed.length > 0) return trimmed;
  }

  if (typeof input.date === "string") {
    const trimmed = input.date.trim();
    if (trimmed.length > 0) return trimmed;
  }

  return null;
}

export function normalizeMeasurementEntry(entry: BodyMeasurementEntry): BodyMeasurementEntry {
  const key = measurementDocId(entry);
  if (!key) return entry;

  return {
    ...entry,
    date: isISODateString(entry.date) ? entry.date : key,
    id: key,
  };
}
