import * as Crypto from 'expo-crypto';
import type {
  WorkoutTemplate, WeekSchedule, DailyLog, MealEntry, WeeklyTarget
} from './types';
import { workoutsRepo, schedulesRepo, logsRepo, mealsRepo, targetsRepo } from './storage';
import { getMondayYMD, addDays, toYMD } from './dates';

function uuid(): string {
  return Crypto.randomUUID();
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

export async function seedUserData(userId: string): Promise<void> {
  const existingTemplates = await workoutsRepo.getAll(userId);
  if (existingTemplates.length > 0) return;

  const now = new Date().toISOString();
  const weekStart = getMondayYMD();

  const templates: WorkoutTemplate[] = [
    {
      id: uuid(),
      name: 'Upper Body Push',
      createdAt: now,
      updatedAt: now,
      blocks: [
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Barbell Bench Press',
          sets: 4, repsOption: '8',
          referenceVideoUrls: [],
          notes: 'Keep shoulder blades retracted',
        },
        { id: uuid(), type: 'rest', seconds: 90, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Overhead Press',
          sets: 3, repsOption: '10',
          referenceVideoUrls: [],
          notes: 'Brace core throughout',
        },
        { id: uuid(), type: 'rest', seconds: 60, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Cable Tricep Pushdown',
          sets: 3, repsOption: '12',
          referenceVideoUrls: [],
        },
        { id: uuid(), type: 'rest', seconds: 60, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Incline Dumbbell Press',
          sets: 3, repsOption: '10',
          referenceVideoUrls: [],
        },
      ],
    },
    {
      id: uuid(),
      name: 'Lower Body Power',
      createdAt: now,
      updatedAt: now,
      blocks: [
        {
          id: uuid(), type: 'cardio',
          cardioName: 'Treadmill Warm-up',
          minutes: 5,
          notes: 'Easy pace',
        },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Barbell Back Squat',
          sets: 4, repsOption: '6',
          referenceVideoUrls: [],
          notes: 'Depth below parallel',
        },
        { id: uuid(), type: 'rest', seconds: 120, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Romanian Deadlift',
          sets: 3, repsOption: '10',
          referenceVideoUrls: [],
        },
        { id: uuid(), type: 'rest', seconds: 90, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Leg Press',
          sets: 3, repsOption: '12',
          referenceVideoUrls: [],
        },
        { id: uuid(), type: 'rest', seconds: 60, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Calf Raises',
          sets: 4, repsOption: '15',
          referenceVideoUrls: [],
        },
      ],
    },
    {
      id: uuid(),
      name: 'Cardio & Core',
      createdAt: now,
      updatedAt: now,
      blocks: [
        {
          id: uuid(), type: 'cardio',
          cardioName: 'Stationary Bike',
          minutes: 15,
          notes: 'Moderate resistance',
        },
        { id: uuid(), type: 'rest', seconds: 60, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Cable Crunches',
          sets: 3, repsOption: '15',
          referenceVideoUrls: [],
        },
        { id: uuid(), type: 'rest', seconds: 45, label: 'Rest' },
        {
          id: uuid(), type: 'gym',
          exerciseName: 'Plank Hold',
          sets: 3, repsOption: 'Until Failure',
          referenceVideoUrls: [],
          notes: '60 sec target',
        },
        { id: uuid(), type: 'rest', seconds: 45, label: 'Rest' },
        {
          id: uuid(), type: 'cardio',
          cardioName: 'Rowing Machine',
          minutes: 10,
          notes: 'Steady pace',
        },
      ],
    },
  ];

  for (const t of templates) {
    await workoutsRepo.save(userId, t);
  }

  const schedule: WeekSchedule = {
    weekStartDate: weekStart,
    days: [
      { date: weekStart, status: 'planned_workout', workoutTemplateId: templates[0].id },
      { date: addDays(weekStart, 1), status: 'planned_workout', workoutTemplateId: templates[1].id },
      { date: addDays(weekStart, 2), status: 'unplanned', workoutTemplateId: null },
      { date: addDays(weekStart, 3), status: 'rest', workoutTemplateId: null },
      { date: addDays(weekStart, 4), status: 'planned_workout', workoutTemplateId: templates[2].id },
      { date: addDays(weekStart, 5), status: 'rest', workoutTemplateId: null },
      { date: addDays(weekStart, 6), status: 'rest', workoutTemplateId: null },
    ],
  };
  await schedulesRepo.save(userId, schedule);

  const target: WeeklyTarget = {
    weekStartDate: weekStart,
    dailyCaloriesTarget: 2400,
    dailyStepsTarget: 8000,
    dailyWaterMlTarget: 2500,
    weightGoalType: 'maintain',
    createdAt: now,
    updatedAt: now,
  };
  await targetsRepo.save(userId, target);

  const dailyLogs: DailyLog[] = [
    {
      date: dateOffset(-4),
      weightKg: 78.5,
      sleepHours: 7.5,
      waterMl: 2200,
      steps: 6800,
      supplementsTaken: true,
      caloriesManual: null,
      notes: 'Felt good today',
      updatedAt: now,
    },
    {
      date: dateOffset(-3),
      weightKg: 78.2,
      sleepHours: 8,
      waterMl: 2600,
      steps: 9200,
      supplementsTaken: true,
      caloriesManual: null,
      notes: null,
      updatedAt: now,
    },
    {
      date: dateOffset(-2),
      weightKg: 78.4,
      sleepHours: 6.5,
      waterMl: 1800,
      steps: 7100,
      supplementsTaken: false,
      caloriesManual: null,
      notes: 'Short on sleep',
      updatedAt: now,
    },
    {
      date: dateOffset(-1),
      weightKg: 78.0,
      sleepHours: 7,
      waterMl: 2400,
      steps: 8500,
      supplementsTaken: true,
      caloriesManual: null,
      notes: null,
      updatedAt: now,
    },
  ];

  for (const log of dailyLogs) {
    await logsRepo.save(userId, log);
  }

  const meals: MealEntry[] = [
    {
      id: uuid(), date: dateOffset(-3),
      mealName: 'Breakfast', notes: 'Oats with berries',
      calories: 450, proteinG: 18, carbsG: 70, fatG: 8,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-3),
      mealName: 'Lunch', notes: 'Chicken rice bowl',
      calories: 650, proteinG: 45, carbsG: 60, fatG: 12,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-3),
      mealName: 'Dinner', notes: 'Salmon and vegetables',
      calories: 520, proteinG: 38, carbsG: 30, fatG: 22,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-2),
      mealName: 'Breakfast', notes: 'Greek yogurt and granola',
      calories: 380, proteinG: 22, carbsG: 45, fatG: 10,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-2),
      mealName: 'Lunch', notes: 'Turkey wrap',
      calories: 480, proteinG: 35, carbsG: 50, fatG: 14,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-2),
      mealName: 'Dinner', notes: 'Beef stir fry',
      calories: 620, proteinG: 42, carbsG: 55, fatG: 18,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-1),
      mealName: 'Breakfast', notes: 'Protein shake and banana',
      calories: 350, proteinG: 30, carbsG: 40, fatG: 5,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-1),
      mealName: 'Lunch', notes: 'Pasta bolognese',
      calories: 720, proteinG: 38, carbsG: 80, fatG: 20,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(-1),
      mealName: 'Dinner', notes: 'Grilled chicken salad',
      calories: 420, proteinG: 40, carbsG: 20, fatG: 16,
      createdAt: now, updatedAt: now,
    },
    {
      id: uuid(), date: dateOffset(0),
      mealName: 'Breakfast', notes: 'Eggs and toast',
      calories: 400, proteinG: 25, carbsG: 35, fatG: 15,
      createdAt: now, updatedAt: now,
    },
  ];

  for (const meal of meals) {
    await mealsRepo.save(userId, meal);
  }
}
