import { exportTextFile } from "@/lib/export/fileExport";
import { localCacheRepo } from "@/lib/storage";
import type { LocalDataSnapshot } from "@/lib/storage";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function exportAsJSON(uid: string): Promise<string> {
  const data = await localCacheRepo.getSnapshot(uid);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      userId: uid,
      ...data,
    },
    null,
    2
  );
}

function buildLogsCsv(data: LocalDataSnapshot): string[] {
  const lines = ["=== DAILY LOGS ===", "date,weight_kg,sleep_hours,water_ml,steps,notes"];
  for (const log of data.logs) {
    lines.push(
      [
        log.date,
        log.weightKg ?? "",
        log.sleepHours ?? "",
        log.waterMl ?? "",
        log.steps ?? "",
        log.notes ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines;
}

function buildMealsCsv(data: LocalDataSnapshot): string[] {
  const lines = ["=== MEALS ===", "date,meal_name,calories,protein_g,carbs_g,fat_g,notes"];
  for (const meal of data.meals) {
    lines.push(
      [
        meal.date,
        meal.mealName,
        meal.calories ?? "",
        meal.proteinG ?? "",
        meal.carbsG ?? "",
        meal.fatG ?? "",
        meal.notes ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines;
}

function buildSessionsCsv(data: LocalDataSnapshot): string[] {
  const lines = ["=== WORKOUTS ===", "date,workout_name,duration_min,completed"];

  const getDurationMin = (startedAt: string, endedAt: string | null): number | "" => {
    if (!endedAt) return "";
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(endedAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return "";
    return Math.round((endMs - startMs) / 60000);
  };

  for (const session of data.sessions) {
    lines.push(
      [
        session.date,
        session.workoutNameSnapshot,
        getDurationMin(session.startedAt, session.endedAt),
        session.completed,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines;
}

function buildMeasurementsCsv(data: LocalDataSnapshot): string[] {
  const lines = [
    "=== BODY MEASUREMENTS ===",
    "date,waist_cm,chest_cm,shoulders_cm,arms_r_cm,arms_l_cm,thigh_r_cm,thigh_l_cm,biceps_r_cm,biceps_l_cm,body_fat_percent",
  ];

  for (const m of data.measurements) {
    lines.push(
      [
        m.date,
        m.waist ?? "",
        m.chest ?? "",
        m.shoulders ?? "",
        m.armsR ?? "",
        m.armsL ?? "",
        m.thighR ?? "",
        m.thighL ?? "",
        m.bicepsR ?? "",
        m.bicepsL ?? "",
        m.bodyFatPercent ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines;
}

function buildExercisesCsv(data: LocalDataSnapshot): string[] {
  const lines = [
    "=== EXERCISES ===",
    "name,movement_type,primary_muscle,target_muscles,equipment,alternative_ids,video_urls,coaching_cues",
  ];

  for (const exercise of data.exercises) {
    lines.push(
      [
        exercise.name,
        exercise.movementType,
        exercise.primaryMuscleGroup,
        exercise.targetMuscles.join("; "),
        exercise.equipment ?? "",
        exercise.alternativeExerciseIds.join("; "),
        exercise.referenceVideoUrls.join("; "),
        exercise.coachingCues,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return lines;
}

export async function exportAsCSV(uid: string): Promise<string> {
  const data = await localCacheRepo.getSnapshot(uid);
  return [
    ...buildLogsCsv(data),
    "",
    ...buildMealsCsv(data),
    "",
    ...buildSessionsCsv(data),
    "",
    ...buildExercisesCsv(data),
    "",
    ...buildMeasurementsCsv(data),
  ].join("\n");
}

export async function exportAsJSONFile(uid: string): Promise<void> {
  const json = await exportAsJSON(uid);
  const timestamp = new Date().toISOString().slice(0, 10);
  await exportTextFile({
    filename: `sixpac-export-${uid}-${timestamp}.json`,
    text: json,
    mimeType: "application/json",
    dialogTitle: "Export JSON",
  });
}

export async function exportAsCSVFile(uid: string): Promise<void> {
  const csv = await exportAsCSV(uid);
  const timestamp = new Date().toISOString().slice(0, 10);
  await exportTextFile({
    filename: `sixpac-export-${uid}-${timestamp}.csv`,
    text: csv,
    mimeType: "text/csv",
    dialogTitle: "Export CSV",
  });
}
