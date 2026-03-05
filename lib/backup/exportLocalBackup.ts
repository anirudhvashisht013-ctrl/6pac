import { Platform } from "react-native";
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
import { getUserProfile } from "@/lib/userProfile";

type BackupPayload = {
  version: 1;
  exportedAt: string;
  uid: string;
  profile: unknown;
  logs: unknown[];
  meals: unknown[];
  targets: unknown[];
  schedules: unknown[];
  templates: unknown[];
  sessions: unknown[];
  measurements: unknown[];
  reminders: unknown | null;
};

export async function exportLocalBackup(uid: string): Promise<void> {
  const [profile, logs, meals, targets, schedules, templates, sessions, measurements, reminders] = await Promise.all([
    getUserProfile(uid).catch(() => null),
    logsRepo.getAll(uid),
    mealsRepo.getAll(uid),
    targetsRepo.getAll(uid),
    schedulesRepo.getAll(uid),
    workoutsRepo.getAll(uid),
    sessionsRepo.getAll(uid),
    measurementsRepo.getAll(uid),
    remindersRepo.get(uid),
  ]);

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    uid,
    profile,
    logs,
    meals,
    targets,
    schedules,
    templates,
    sessions,
    measurements,
    reminders,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `sixpac-backup-${uid}-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FSMod: any = await import("expo-file-system");
  const SharingMod: any = await import("expo-sharing");
  const FileSystem = FSMod?.default ?? FSMod;
  const Sharing = SharingMod?.default ?? SharingMod;

  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const path = `${baseDir}${filename}`;

  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType?.UTF8 ?? "utf8",
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "application/json",
      dialogTitle: "Export Local Backup",
    });
  }
}
