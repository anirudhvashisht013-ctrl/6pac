import {
  logsRepo,
  mealsRepo,
  measurementsRepo,
  remindersRepo,
  schedulesRepo,
  sessionsRepo,
  targetsRepo,
  workoutsRepo,
} from "@/lib/storage";
import { cloudMirrorRepo } from "@/lib/repos/cloudMirrorRepo";

export async function backupLocalDataToCloud(uid: string): Promise<void> {
  const [logs, meals, targets, schedules, templates, sessions, measurements, reminders] = await Promise.all([
    logsRepo.getAll(uid),
    mealsRepo.getAll(uid),
    targetsRepo.getAll(uid),
    schedulesRepo.getAll(uid),
    workoutsRepo.getAll(uid),
    sessionsRepo.getAll(uid),
    measurementsRepo.getAll(uid),
    remindersRepo.get(uid),
  ]);

  await Promise.all([
    ...logs.map((x) => cloudMirrorRepo.upsertLog(uid, x)),
    ...meals.map((x) => cloudMirrorRepo.upsertMeal(uid, x)),
    ...targets.map((x) => cloudMirrorRepo.upsertTarget(uid, x)),
    ...schedules.map((x) => cloudMirrorRepo.upsertSchedule(uid, x)),
    ...templates.map((x) => cloudMirrorRepo.upsertTemplate(uid, x)),
    ...sessions.map((x) => cloudMirrorRepo.upsertSession(uid, x)),
    ...measurements.map((x) => cloudMirrorRepo.upsertMeasurement(uid, x)),
    ...(reminders
      ? [
          cloudMirrorRepo.upsertReminderSettings(uid, {
            id: "primary",
            version: 1,
            settings: reminders.settings,
            createdAt: reminders.createdAt,
            updatedAt: reminders.updatedAt,
          }),
        ]
      : []),
  ]);
}
