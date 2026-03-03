import type { BodyMeasurementEntry } from "@/lib/models";
import { exportTextFile } from "@/lib/export/fileExport";
import { hasAnyNumeric, parseTimestampDate } from "@/lib/measurements/slots";

const INCH_PER_CM = 0.3937007874;

function quoteCsvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toInches(value: number | null): string {
  return typeof value === "number" ? (value * INCH_PER_CM).toFixed(2) : "";
}

function toPercent(value: number | null): string {
  return typeof value === "number" ? value.toFixed(2) : "";
}

export function buildMeasurementsCsv(entries: BodyMeasurementEntry[]): string {
  const header = [
    "scheduled_date",
    "logged_at",
    "waist_in",
    "chest_in",
    "shoulders_in",
    "armsR_in",
    "armsL_in",
    "thighR_in",
    "thighL_in",
    "bicepsR_in",
    "bicepsL_in",
    "bodyFatPercent",
    "notes",
  ];

  const rows = entries
    .filter((e) => hasAnyNumeric(e))
    .map((e) => {
      const loggedAt = parseTimestampDate(e.loggedAt) ?? parseTimestampDate(e.createdAt);
      const loggedAtIso = loggedAt ? loggedAt.toISOString() : "";

      return [
        e.date,
        loggedAtIso,
        toInches(e.waist),
        toInches(e.chest),
        toInches(e.shoulders),
        toInches(e.armsR),
        toInches(e.armsL),
        toInches(e.thighR),
        toInches(e.thighL),
        toInches(e.bicepsR),
        toInches(e.bicepsL),
        toPercent(e.bodyFatPercent),
        (e.notes || "").replace(/\n/g, " ").replace(/,/g, " "),
      ];
    });

  return [header, ...rows].map((r) => r.map(quoteCsvCell).join(",")).join("\n") + "\n";
}

export async function exportMeasurementsCsv(entries: BodyMeasurementEntry[]): Promise<void> {
  const csv = buildMeasurementsCsv(entries);
  const dateSuffix = new Date().toISOString().slice(0, 10);

  await exportTextFile({
    filename: `sixpac-body-measurements-${dateSuffix}.csv`,
    text: csv,
    mimeType: "text/csv",
    dialogTitle: "Export Measurements CSV",
  });
}
