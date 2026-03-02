// lib/models.ts

export type ISODate = `${number}-${number}-${number}`; // "YYYY-MM-DD"

export type Sex = "male" | "female" | "other";
export type GoalType = "lean" | "recomp" | "buffed";

export type DailySnapshot = {
  date: ISODate;

  // body + recovery
  weightKg: number | null;
  sleepHours: number | null;

  // activity
  steps: number | null;
  waterMl: number | null;

  // nutrition totals (final numbers used for analytics)
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;

  // training summary (analytics-friendly)
  didWorkout: boolean;
  workoutMinutes: number | null;
  workoutName: string | null;
  workoutSessionIds: string[]; // can be empty

  // adherence flags (optional but powerful for filters)
  hitCalories: boolean | null;
  hitProtein: boolean | null;
  hitSteps: boolean | null;
  hitWater: boolean | null;

  // misc
  supplementsTaken: boolean | null;
  notes: string | null;

  // timestamps
  updatedAt?: any;
};

export type MealEntry = {
  id: string;
  date: ISODate;
  mealName: string;
  notes: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  createdAt?: any;
  updatedAt?: any;
};

export type WorkoutSession = {
  id: string;
  date: ISODate;
  workoutTemplateId: string | null; // optional for now
  workoutNameSnapshot: string;
  startedAt: string; // ISO timestamp
  endedAt: string | null;
  completed: boolean;
  durationMin: number | null;

  // keep this flexible; we can add exercise details later
  updatedAt?: any;
};

export type BodyMeasurementEntry = {
  date: ISODate; // using date as id (1 check-in per day). Change if needed.
  waist: number | null;
  chest: number | null;
  shoulders: number | null;
  armsR: number | null;
  armsL: number | null;
  thighR: number | null;
  thighL: number | null;
  bicepsR: number | null;
  bicepsL: number | null;
  bodyFatPercent: number | null;
  notes: string | null;
  createdAt?: any;
};