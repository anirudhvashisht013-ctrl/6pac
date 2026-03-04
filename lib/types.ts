export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  dateOfBirth: string;
  sex: 'male' | 'female' | 'other';
  currentWeightKg: number;
  goalType: 'lean' | 'recomp' | 'buffed';
  createdAt: string;

  // computed streak stats (optional)
  currentStreakDays?: number;
  maxStreakDays?: number;
}

export interface DailyLog {
  date: string;
  weightKg: number | null;
  sleepHours: number | null;
  waterMl: number | null;
  steps: number | null;
  supplementsTaken: boolean | null;
  caloriesManual: number | null;
  notes: string | null;
  updatedAt: string;
}

export interface MealEntry {
  id: string;
  date: string;
  mealName: string;
  notes: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyTarget {
  weekStartDate: string;
  dailyCaloriesTarget: number;
  dailyStepsTarget: number;
  dailyWaterMlTarget: number;
  targetWeightKg?: number | null;
  weightGoalType: 'lose' | 'gain' | 'maintain';
  createdAt: string;
  updatedAt: string;
}

export type DayStatus = 'planned_workout' | 'rest' | 'unplanned';

export interface PlannedDay {
  date: string;
  status: DayStatus;
  workoutTemplateId: string | null;
}

export interface WeekSchedule {
  weekStartDate: string;
  days: PlannedDay[];
}

export interface GymSet {
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

export type ExerciseMovementType = 'compound' | 'isolation';

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  normalizedName: string;
  coachingCues: string;
  referenceVideoUrls: string[];
  movementType: ExerciseMovementType;
  primaryMuscleGroup: string;
  targetMuscles: string[];
  equipment: string | null;
  alternativeExerciseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutBlock {
  id: string;
  type: 'gym' | 'cardio' | 'rest';
  exerciseId?: string | null;
  exerciseName?: string;
  sets?: number;
  repsOption?: string;
  referenceVideoUrls?: string[];
  notes?: string;
  cardioName?: string;
  minutes?: number;
  seconds?: number;
  label?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  blocks: WorkoutBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface BlockPerformance {
  blockId: string;
  completed: boolean;
  exerciseIdOverride?: string | null;
  sets?: GymSet[];
  minutesCompleted?: number;
}

export interface WorkoutSession {
  id: string;
  date: string;
  workoutTemplateId: string;
  workoutNameSnapshot: string;
  startedAt: string;
  endedAt: string | null;
  completed: boolean;
  blockPerformances: BlockPerformance[];
}

export interface BodyMeasurementEntry {
  // Legacy local/mirror identifier. New writes use `date` as the canonical key.
  id?: string;
  date: string;
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
  schemaVersion?: 1;
  createdAt?: string;
  loggedAt?: string;
  updatedAt?: string;
}

export type GoalType = 'lean' | 'recomp' | 'buffed';
export type WeightGoalType = 'lose' | 'gain' | 'maintain';
