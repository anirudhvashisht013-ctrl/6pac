import type { ISODate } from "@/lib/models";
import type { BodyMeasurementEntry } from "@/lib/types";
import { normalizeMeasurementDateParam } from "@/lib/adapters/measurementKeyAdapter";

const CM_PER_IN = 2.54;
const IN_PER_CM = 0.3937007874;

export const MEASUREMENT_FORM_KEYS = [
  "waist",
  "chest",
  "shoulders",
  "armsR",
  "armsL",
  "thighR",
  "thighL",
  "bicepsR",
  "bicepsL",
] as const;

export type MeasurementFormKey = (typeof MEASUREMENT_FORM_KEYS)[number];
export type MeasurementFormValues = Record<MeasurementFormKey, string>;

export function parseNumberInput(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "");

  if (!cleaned) return null;

  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toCm(inch: number): number {
  return inch * CM_PER_IN;
}

function formatInchesFromCm(cm: number | null): string {
  if (typeof cm !== "number" || !Number.isFinite(cm)) return "";
  const inVal = cm * IN_PER_CM;
  const fixed = inVal.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

function emptyFormValues(): MeasurementFormValues {
  return {
    waist: "",
    chest: "",
    shoulders: "",
    armsR: "",
    armsL: "",
    thighR: "",
    thighL: "",
    bicepsR: "",
    bicepsL: "",
  };
}

export function hydrateMeasurementForm(entry: BodyMeasurementEntry | null): {
  form: MeasurementFormValues;
  bodyFat: string;
  notes: string;
} {
  const form = emptyFormValues();
  if (!entry) {
    return { form, bodyFat: "", notes: "" };
  }

  for (const key of MEASUREMENT_FORM_KEYS) {
    form[key] = formatInchesFromCm(entry[key]);
  }

  return {
    form,
    bodyFat:
      typeof entry.bodyFatPercent === "number" && Number.isFinite(entry.bodyFatPercent)
        ? String(entry.bodyFatPercent)
        : "",
    notes: entry.notes || "",
  };
}

export function resolveMeasurementDate(raw: string | undefined, fallbackDate: string): ISODate {
  return normalizeMeasurementDateParam(raw, fallbackDate as ISODate);
}

export function buildMeasurementEntryFromForm(input: {
  date: ISODate;
  form: MeasurementFormValues;
  bodyFat: string;
  notes: string;
  loggedAt: string;
}): BodyMeasurementEntry {
  const toCmOrNull = (key: MeasurementFormKey) => {
    const parsed = parseNumberInput(input.form[key]);
    return parsed == null ? null : toCm(parsed);
  };

  const bodyFatParsed = parseNumberInput(input.bodyFat);

  return {
    schemaVersion: 1,
    date: input.date,
    waist: toCmOrNull("waist"),
    chest: toCmOrNull("chest"),
    shoulders: toCmOrNull("shoulders"),
    armsR: toCmOrNull("armsR"),
    armsL: toCmOrNull("armsL"),
    thighR: toCmOrNull("thighR"),
    thighL: toCmOrNull("thighL"),
    bicepsR: toCmOrNull("bicepsR"),
    bicepsL: toCmOrNull("bicepsL"),
    bodyFatPercent: bodyFatParsed == null ? null : bodyFatParsed,
    notes: input.notes.trim() || null,
    loggedAt: input.loggedAt,
  };
}
