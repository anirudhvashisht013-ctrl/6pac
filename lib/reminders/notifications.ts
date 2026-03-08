import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import type { ReminderNotificationPlan } from "@/lib/reminders/engine";

const REMINDER_KIND = "6pac-reminder";
const ANDROID_CHANNEL_ID = "reminders";

let configured = false;
let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null;

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined" | "unknown";

type ExpoNotificationsModule = typeof import("expo-notifications");

function isExpoGoAndroid(): boolean {
  if (Platform.OS !== "android") return false;

  const executionEnvironment = (Constants as any).executionEnvironment;
  const appOwnership = (Constants as any).appOwnership;
  return executionEnvironment === "storeClient" || appOwnership === "expo";
}

async function getNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (!isNotificationsSupported()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then((mod) => mod)
      .catch((error) => {
        console.warn("Notifications module unavailable:", error);
        return null;
      });
  }

  return notificationsModulePromise;
}

function normalizeStatus(status: string | undefined): NotificationPermissionStatus {
  if (status === "granted" || status === "denied" || status === "undetermined") {
    return status;
  }
  return "unknown";
}

export function isNotificationsSupported(): boolean {
  return Platform.OS !== "web" && !isExpoGoAndroid();
}

export async function configureReminderNotifications(): Promise<void> {
  if (configured || !isNotificationsSupported()) return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

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
  const Notifications = await getNotificationsModule();
  if (!Notifications) return "unknown";

  try {
    const result = await Notifications.getPermissionsAsync();
    return normalizeStatus(result.status);
  } catch {
    return "unknown";
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return "unknown";

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
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === REMINDER_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

export async function syncReminderNotificationSchedule(plan: ReminderNotificationPlan[]): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

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
      } as any,
    } as any);
  }
}

export async function subscribeReminderNotificationResponses(
  onDeepLink: (deepLink: string) => void
): Promise<() => void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => undefined;
  }

  const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const deepLink = response?.notification?.request?.content?.data?.deepLink;
    if (typeof deepLink === "string" && deepLink.length > 0) {
      onDeepLink(deepLink);
    }
  });

  return () => {
    responseSub.remove();
  };
}
