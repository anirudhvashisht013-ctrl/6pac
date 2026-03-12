import type { BodyMeasurementEntry } from "@/lib/types";
import {
  compareMeasurementDates,
  isMeasurementForDate,
  normalizeMeasurementEntries,
} from "@/lib/adapters/measurementKeyAdapter";

export function getMeasurementByDate(
  measurements: BodyMeasurementEntry[],
  date: string
): BodyMeasurementEntry | null {
  return normalizeMeasurementEntries(measurements, "local-query:getByDate").find((entry) =>
    isMeasurementForDate(entry, date)
  ) || null;
}

export function getMeasurementRange(
  measurements: BodyMeasurementEntry[],
  start: string,
  end: string
): BodyMeasurementEntry[] {
  return normalizeMeasurementEntries(measurements, "local-query:getRange")
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort(compareMeasurementDates);
}
