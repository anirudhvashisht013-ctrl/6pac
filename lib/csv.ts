// lib/csv.ts
import type { DailySnapshot } from "@/lib/models";

function esc(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function dailySnapshotsToCSV(rows: DailySnapshot[]): string {
  const headers = [
    "date",
    "weightKg",
    "sleepHours",
    "steps",
    "waterMl",
    "calories",
    "proteinG",
    "carbsG",
    "fatG",
    "didWorkout",
    "workoutMinutes",
    "workoutName",
    "supplementsTaken",
    "notes",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.date,
        r.weightKg,
        r.sleepHours,
        r.steps,
        r.waterMl,
        r.calories,
        r.proteinG,
        r.carbsG,
        r.fatG,
        r.didWorkout,
        r.workoutMinutes,
        r.workoutName,
        r.supplementsTaken,
        r.notes,
      ].map(esc).join(",")
    ),
  ];

  return lines.join("\n");
}