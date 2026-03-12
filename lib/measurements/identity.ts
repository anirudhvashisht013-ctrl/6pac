import type { ISODate } from "@/lib/models";
import type { BodyMeasurementEntry } from "@/lib/types";
import {
  isCanonicalMeasurementDate,
  normalizeMeasurementEntryKey,
  resolveMeasurementKey,
} from "@/lib/adapters/measurementKeyAdapter";

export function isISODateString(value: unknown): value is ISODate {
  return isCanonicalMeasurementDate(value);
}

export function measurementDocId(input: { date?: unknown; id?: unknown }): string | null {
  return resolveMeasurementKey(input).key;
}

export function normalizeMeasurementEntry(entry: BodyMeasurementEntry): BodyMeasurementEntry {
  return normalizeMeasurementEntryKey(entry);
}
