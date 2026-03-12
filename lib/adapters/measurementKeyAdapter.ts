import type { ISODate } from "@/lib/models";
import type { BodyMeasurementEntry } from "@/lib/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEV_MODE = typeof __DEV__ !== "undefined" && __DEV__;

type MeasurementIdentityInput = {
  date?: unknown;
  id?: unknown;
};

export type MeasurementKeySource = "date" | "id" | "date_fallback" | "missing";

export type MeasurementKeyResolution = {
  key: string | null;
  canonicalDate: ISODate | null;
  source: MeasurementKeySource;
};

export function isCanonicalMeasurementDate(value: unknown): value is ISODate {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

function normalizeStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function warnMeasurementIdentity(message: string, input: MeasurementIdentityInput, context?: string) {
  if (!DEV_MODE) return;
  const label = context ? ` [${context}]` : "";
  console.warn(`[measurement-key]${label} ${message}`, {
    date: input.date,
    id: input.id,
  });
}

export function resolveMeasurementKey(input: MeasurementIdentityInput): MeasurementKeyResolution {
  if (isCanonicalMeasurementDate(input.date)) {
    return {
      key: input.date,
      canonicalDate: input.date,
      source: "date",
    };
  }

  const normalizedId = normalizeStringValue(input.id);
  if (normalizedId) {
    return {
      key: normalizedId,
      canonicalDate: isCanonicalMeasurementDate(normalizedId) ? normalizedId : null,
      source: "id",
    };
  }

  const normalizedDate = normalizeStringValue(input.date);
  if (normalizedDate) {
    return {
      key: normalizedDate,
      canonicalDate: isCanonicalMeasurementDate(normalizedDate) ? normalizedDate : null,
      source: "date_fallback",
    };
  }

  return {
    key: null,
    canonicalDate: null,
    source: "missing",
  };
}

export function normalizeMeasurementDateParam(raw: string | undefined, fallbackDate: ISODate): ISODate {
  if (isCanonicalMeasurementDate(raw)) {
    return raw;
  }

  const resolution = resolveMeasurementKey({ date: raw });
  if (resolution.source !== "missing") {
    warnMeasurementIdentity("invalid measurement route date; falling back", { date: raw }, "route");
  }

  return fallbackDate;
}

export function isMeasurementForDate(input: MeasurementIdentityInput, date: string): boolean {
  const resolution = resolveMeasurementKey(input);
  return resolution.canonicalDate === date || resolution.key === date;
}

export function normalizeMeasurementEntryKey<T extends BodyMeasurementEntry>(
  entry: T,
  context?: string
): T {
  const resolution = resolveMeasurementKey(entry);
  const normalizedDate = normalizeStringValue(entry.date);
  const normalizedId = normalizeStringValue(entry.id);

  if (isCanonicalMeasurementDate(entry.date) && normalizedId && normalizedId !== entry.date) {
    warnMeasurementIdentity(
      "conflicting measurement identity; canonical date wins over legacy id",
      entry,
      context
    );
  } else if (resolution.source === "id" || resolution.source === "date_fallback") {
    warnMeasurementIdentity("using legacy/fallback measurement identity", entry, context);
  } else if (resolution.source === "missing") {
    warnMeasurementIdentity("measurement is missing a stable key", entry, context);
  } else if (normalizedDate && !isCanonicalMeasurementDate(normalizedDate)) {
    warnMeasurementIdentity("measurement has a non-canonical date string", entry, context);
  }

  if (!resolution.key) return entry;

  return {
    ...entry,
    date: resolution.canonicalDate ?? entry.date ?? resolution.key,
    id: resolution.key,
  };
}

export function normalizeMeasurementEntries(
  entries: BodyMeasurementEntry[],
  context?: string
): BodyMeasurementEntry[] {
  const deduped = new Map<string, BodyMeasurementEntry>();
  const keyless: BodyMeasurementEntry[] = [];

  entries.forEach((entry, index) => {
    const normalized = normalizeMeasurementEntryKey(entry, context ? `${context}:${index}` : undefined);
    const resolution = resolveMeasurementKey(normalized);
    if (!resolution.key) {
      keyless.push(normalized);
      return;
    }

    if (deduped.has(resolution.key)) {
      warnMeasurementIdentity(
        "duplicate logical measurement key encountered; keeping the latest normalized row",
        normalized,
        context
      );
    }
    deduped.set(resolution.key, normalized);
  });

  return [...deduped.values(), ...keyless];
}

export function getCanonicalMeasurementDate(input: MeasurementIdentityInput): ISODate | null {
  return resolveMeasurementKey(input).canonicalDate;
}

export function compareMeasurementDates(a: MeasurementIdentityInput, b: MeasurementIdentityInput): number {
  const aResolved = resolveMeasurementKey(a);
  const bResolved = resolveMeasurementKey(b);
  const left = aResolved.canonicalDate ?? aResolved.key ?? "";
  const right = bResolved.canonicalDate ?? bResolved.key ?? "";
  return left.localeCompare(right);
}
