import type { BodyMeasurementEntry } from "@/lib/types";

export function getMeasurementByDate(
  measurements: BodyMeasurementEntry[],
  date: string
): BodyMeasurementEntry | null {
  return measurements.find((entry) => entry.date === date) || null;
}

export function getMeasurementRange(
  measurements: BodyMeasurementEntry[],
  start: string,
  end: string
): BodyMeasurementEntry[] {
  return measurements
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}
