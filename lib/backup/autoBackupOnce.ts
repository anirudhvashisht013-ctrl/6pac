import AsyncStorage from "@react-native-async-storage/async-storage";
import { backupLocalDataToCloud } from "@/lib/backup/backupToCloud";

// Bump the version when the backup payload changes or when existing users need a
// one-time repair pass to republish local-first data to Firestore.
const AUTO_BACKUP_KEY = (uid: string) => `@6pac:auto_backup_done:v2:${uid}`;

export async function ensureAutoBackupOnce(uid: string): Promise<boolean> {
  const key = AUTO_BACKUP_KEY(uid);
  const done = await AsyncStorage.getItem(key);
  if (done === "1") return false;

  await backupLocalDataToCloud(uid);
  await AsyncStorage.setItem(key, "1");
  return true;
}
