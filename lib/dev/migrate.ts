import AsyncStorage from "@react-native-async-storage/async-storage";
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";
import { localCacheRepo } from "@/lib/storage";

export type MigrationResult = {
  timestamp: string;
  uid: string;
  logsMigrated: number;
  mealsMigrated: number;
  sessionsMigrated: number;
  templatesMigrated: number;
  exercisesMigrated: number;
  targetsMigrated: number;
  schedulesMigrated: number;
  measurementsMigrated: number;
  remindersMigrated: number;
  total: number;
  status: "success" | "partial" | "error";
  error?: string;
};

const MIGRATION_KEY = (uid: string) => `@6pac:migrated_at:${uid}`;

export async function hasBeenMigrated(uid: string): Promise<boolean> {
  const val = await AsyncStorage.getItem(MIGRATION_KEY(uid));
  return val != null;
}

export async function getMigrationStatus(uid: string): Promise<{
  migrated: boolean;
  migratedAt: string | null;
}> {
  const migratedAt = await AsyncStorage.getItem(MIGRATION_KEY(uid));
  return {
    migrated: migratedAt != null,
    migratedAt,
  };
}

export async function migrateAllDataToCloud(uid: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    timestamp: new Date().toISOString(),
    uid,
    logsMigrated: 0,
    mealsMigrated: 0,
    sessionsMigrated: 0,
    templatesMigrated: 0,
    exercisesMigrated: 0,
    targetsMigrated: 0,
    schedulesMigrated: 0,
    measurementsMigrated: 0,
    remindersMigrated: 0,
    total: 0,
    status: "success",
  };

  let failures = 0;

  try {
    const snapshot = await localCacheRepo.getSnapshot(uid);

    for (const log of snapshot.logs) {
      try {
        await cloudMirrorRepo.upsertLog(uid, log);
        result.logsMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate log ${log.date}:`, e);
      }
    }

    for (const meal of snapshot.meals) {
      try {
        await cloudMirrorRepo.upsertMeal(uid, meal);
        result.mealsMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate meal ${meal.id}:`, e);
      }
    }

    for (const session of snapshot.sessions) {
      try {
        await cloudMirrorRepo.upsertSession(uid, session);
        result.sessionsMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate session ${session.id}:`, e);
      }
    }

    for (const template of snapshot.templates) {
      try {
        await cloudMirrorRepo.upsertTemplate(uid, template);
        result.templatesMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate template ${template.id}:`, e);
      }
    }

    for (const exercise of snapshot.exercises) {
      try {
        await cloudMirrorRepo.upsertExercise(uid, exercise);
        result.exercisesMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate exercise ${exercise.id}:`, e);
      }
    }

    for (const target of snapshot.targets) {
      try {
        await cloudMirrorRepo.upsertTarget(uid, target);
        result.targetsMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate target ${target.weekStartDate}:`, e);
      }
    }

    for (const schedule of snapshot.schedules) {
      try {
        await cloudMirrorRepo.upsertSchedule(uid, schedule);
        result.schedulesMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate schedule ${schedule.weekStartDate}:`, e);
      }
    }

    for (const measurement of snapshot.measurements) {
      try {
        await cloudMirrorRepo.upsertMeasurement(uid, measurement);
        result.measurementsMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error(`Failed to migrate measurement ${measurement.date}:`, e);
      }
    }

    if (snapshot.reminders) {
      try {
        await cloudMirrorRepo.upsertReminderSettings(uid, {
          id: "primary",
          version: 1,
          settings: snapshot.reminders.settings,
          createdAt: snapshot.reminders.createdAt,
          updatedAt: snapshot.reminders.updatedAt,
        });
        result.remindersMigrated += 1;
      } catch (e) {
        failures += 1;
        console.error("Failed to migrate reminder settings:", e);
      }
    }

    result.total =
      result.logsMigrated +
      result.mealsMigrated +
      result.sessionsMigrated +
      result.templatesMigrated +
      result.exercisesMigrated +
      result.targetsMigrated +
      result.schedulesMigrated +
      result.measurementsMigrated +
      result.remindersMigrated;

    if (failures > 0) {
      result.status = "partial";
      result.error = `${failures} items failed to migrate`;
    } else {
      await AsyncStorage.setItem(MIGRATION_KEY(uid), result.timestamp);
    }

    console.log("Migration completed:", result);
    return result;
  } catch (error) {
    result.status = "error";
    result.error = String(error);
    console.error("Migration failed:", error);
    return result;
  }
}
