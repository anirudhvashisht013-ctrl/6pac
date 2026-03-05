import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import type { ReminderNotificationPlan } from "@/lib/reminders/engine";

const REMINDER_KIND = "6pac-reminder";
const ANDROID_CHANNEL_ID = "reminders";

let configured = false;

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined" | "unknown";

function normalizeStatus(status: Notifications.PermissionStatus | undefined): NotificationPermissionStatus {
  if (status === "granted" || status === "denied" || status === "undetermined") {
    return status;
  }
  return "unknown";
}

export function isNotificationsSupported(): boolean {
  return Platform.OS !== "web";
}

export async function configureReminderNotifications(): Promise<void> {
  if (configured || !isNotificationsSupported()) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      vibrationPattern: [0, 200, 150, 200],
      sound: "default",
    });
  }
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (!isNotificationsSupported()) return "unknown";
  try {
    const result = await Notifications.getPermissionsAsync();
    return normalizeStatus(result.status);
  } catch {
    return "unknown";
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationsSupported()) return "unknown";
  try {
    const result = await Notifications.requestPermissionsAsync();
    return normalizeStatus(result.status);
  } catch {
    return "unknown";
  }
}

export async function openDeviceNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // no-op
  }
}

async function cancelReminderNotifications(): Promise<void> {
  if (!isNotificationsSupported()) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === REMINDER_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

export async function syncReminderNotificationSchedule(plan: ReminderNotificationPlan[]): Promise<void> {
  if (!isNotificationsSupported()) return;

  await configureReminderNotifications();
  await cancelReminderNotifications();

  for (const item of plan) {
    const fireAt = new Date(item.fireAt);
    if (Number.isNaN(fireAt.getTime())) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        sound: "default",
        data: {
          kind: REMINDER_KIND,
          reminderId: item.id,
          deepLink: item.deepLink,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
  }
}
