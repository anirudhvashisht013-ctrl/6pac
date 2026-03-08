import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { logsRepo, mealsRepo, measurementsRepo, remindersRepo, schedulesRepo, sessionsRepo, targetsRepo } from "@/lib/storage";
import { subscribeDataEvents } from "@/lib/dataEvents";
import {
  configureReminderNotifications,
  getNotificationPermissionStatus,
  openDeviceNotificationSettings,
  requestNotificationPermission,
  subscribeReminderNotificationResponses,
  syncReminderNotificationSchedule,
  type NotificationPermissionStatus,
} from "@/lib/reminders/notifications";
import {
  computeReminderPlan,
  type PendingReminderItem,
  type ReminderTab,
  type SnoozeChoice,
} from "@/lib/reminders/engine";
import {
  buildDefaultReminderState,
  mergeReminderStateDefaults,
} from "@/lib/reminders/defaults";
import type { ReminderSettings, ReminderState } from "@/lib/types";

type TabCounts = Partial<Record<ReminderTab, number>>;
type ReminderSettingsPatch = {
  enabled?: boolean;
  measurement?: Partial<ReminderSettings["measurement"]>;
  weeklyPlan?: Partial<ReminderSettings["weeklyPlan"]>;
  workout?: Partial<ReminderSettings["workout"]>;
  dailyLogging?: Partial<ReminderSettings["dailyLogging"]>;
  quietHours?: Partial<ReminderSettings["quietHours"]>;
  maxNotificationsPerDay?: number;
};

export type ReminderContextValue = {
  state: ReminderState;
  pendingItems: PendingReminderItem[];
  tabCounts: TabCounts;
  permissionStatus: NotificationPermissionStatus;
  isLoading: boolean;
  refresh: () => Promise<void>;
  updateSettings: (patch: ReminderSettingsPatch) => Promise<void>;
  requestOsPermission: () => Promise<NotificationPermissionStatus>;
  openOsSettings: () => Promise<void>;
  snoozeItem: (item: PendingReminderItem, choice: SnoozeChoice) => Promise<void>;
  dismissItemForCycle: (item: PendingReminderItem) => Promise<void>;
  openPendingTarget: (item: PendingReminderItem) => void;
};

const ReminderContext = createContext<ReminderContextValue | null>(null);

const REFRESH_INTERVAL_MS = 60 * 1000;

function nextWeekendAtTen(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay();
  const diffToSat = day <= 6 ? (6 - day + 7) % 7 : 6;
  d.setDate(d.getDate() + (diffToSat === 0 ? 7 : diffToSat));
  d.setHours(10, 0, 0, 0);
  return d;
}

function resolveSnooze(choice: SnoozeChoice, now: Date): string {
  if (choice === "1h") {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
  if (choice === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  return nextWeekendAtTen(now).toISOString();
}

function dismissUntilForItem(item: PendingReminderItem, now: Date): string {
  const d = new Date(now);
  if (item.type === "weeklyPlan") {
    d.setDate(d.getDate() + 3);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

function shallowEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function comparableState(state: ReminderState | null): unknown {
  if (!state) return null;
  return {
    ...state,
    updatedAt: "__ignore__",
    runtime: {
      ...state.runtime,
      updatedAt: "__ignore__",
    },
  };
}

function mergeSettings(base: ReminderSettings, patch: ReminderSettingsPatch): ReminderSettings {
  return {
    ...base,
    ...patch,
    measurement: {
      ...base.measurement,
      ...(patch.measurement || {}),
    },
    weeklyPlan: {
      ...base.weeklyPlan,
      ...(patch.weeklyPlan || {}),
    },
    workout: {
      ...base.workout,
      ...(patch.workout || {}),
    },
    dailyLogging: {
      ...base.dailyLogging,
      ...(patch.dailyLogging || {}),
    },
    quietHours: {
      ...base.quietHours,
      ...(patch.quietHours || {}),
    },
  };
}

function buildTabCounts(items: PendingReminderItem[]): TabCounts {
  const counts: TabCounts = {};
  for (const item of items) {
    counts[item.tab] = (counts[item.tab] || 0) + 1;
  }
  return counts;
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<ReminderState>(() => buildDefaultReminderState());
  const [pendingItems, setPendingItems] = useState<PendingReminderItem[]>([]);
  const [tabCounts, setTabCounts] = useState<TabCounts>({});
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("unknown");
  const [isLoading, setIsLoading] = useState(true);

  const stateRef = useRef<ReminderState>(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    const uid = user?.id;
    if (!uid) {
      setIsLoading(false);
      setPendingItems([]);
      setTabCounts({});
      await syncReminderNotificationSchedule([]);
      return;
    }

    setIsLoading(true);

    const [rawState, logs, meals, targets, schedules, sessions, measurements, permission] = await Promise.all([
      remindersRepo.get(uid),
      logsRepo.getAll(uid),
      mealsRepo.getAll(uid),
      targetsRepo.getAll(uid),
      schedulesRepo.getAll(uid),
      sessionsRepo.getAll(uid),
      measurementsRepo.getAll(uid),
      getNotificationPermissionStatus(),
    ]);

    const merged = mergeReminderStateDefaults(rawState);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const plan = computeReminderPlan({
      now: new Date(),
      timezone,
      settings: merged.settings,
      runtime: {
        ...merged.runtime,
        permissionStatus: permission,
      },
      canSendOsNotifications: permission === "granted",
      logs,
      meals,
      targets,
      schedules,
      sessions,
      measurements,
    });

    const candidateState: ReminderState = {
      ...merged,
      runtime: {
        ...merged.runtime,
        permissionStatus: permission,
        ...plan.runtimePatch,
      },
    };

    const hasMaterialChange = !shallowEqualJson(
      comparableState(rawState ? mergeReminderStateDefaults(rawState) : null),
      comparableState(candidateState)
    );

    const nextState: ReminderState = hasMaterialChange
      ? {
          ...candidateState,
          runtime: {
            ...candidateState.runtime,
            updatedAt: new Date().toISOString(),
          },
        }
      : merged;

    if (hasMaterialChange) {
      await remindersRepo.saveLocal(uid, nextState);
    }

    if (permission === "granted" && merged.settings.enabled) {
      await syncReminderNotificationSchedule(plan.notifications);
    } else {
      await syncReminderNotificationSchedule([]);
    }

    setState(nextState);
    setPendingItems(plan.pendingItems);
    setTabCounts(buildTabCounts(plan.pendingItems));
    setPermissionStatus(permission);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const uid = user?.id;

    if (!uid) {
      setState(buildDefaultReminderState());
      setPendingItems([]);
      setTabCounts({});
      setPermissionStatus("unknown");
      setIsLoading(false);
      void syncReminderNotificationSchedule([]);
      return;
    }

    void configureReminderNotifications();
    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void refresh();
      }
    });

    const dataSub = subscribeDataEvents((event) => {
      if (event.uid === uid) {
        void refresh();
      }
    });

    let isMounted = true;
    let removeResponseSub: () => void = () => {};

    void subscribeReminderNotificationResponses((deepLink) => {
      router.push(deepLink as any);
    }).then((unsubscribe) => {
      if (!isMounted) {
        unsubscribe();
        return;
      }
      removeResponseSub = unsubscribe;
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      dataSub();
      isMounted = false;
      removeResponseSub();
    };
  }, [refresh, user?.id]);

  const persistState = useCallback(
    async (
      updater: (prev: ReminderState) => ReminderState,
      opts?: { syncSettings?: boolean }
    ) => {
      const uid = user?.id;
      if (!uid) return;
      const next = updater(stateRef.current);
      setState(next);
      stateRef.current = next;
      await remindersRepo.saveLocal(uid, next);
      if (opts?.syncSettings) {
        await remindersRepo.syncSettings(uid, next);
      }
      await refresh();
    },
    [refresh, user?.id]
  );

  const updateSettings = useCallback(
    async (patch: ReminderSettingsPatch) => {
      await persistState(
        (prev) => ({
          ...prev,
          settings: mergeSettings(prev.settings, patch),
          updatedAt: new Date().toISOString(),
        }),
        { syncSettings: true }
      );
    },
    [persistState]
  );

  const requestOsPermission = useCallback(async () => {
    const status = await requestNotificationPermission();
    setPermissionStatus(status);

    await persistState((prev) => ({
      ...prev,
      runtime: {
        ...prev.runtime,
        permissionStatus: status,
        lastPermissionPromptAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    return status;
  }, [persistState]);

  const openOsSettings = useCallback(async () => {
    await openDeviceNotificationSettings();
  }, []);

  const snoozeItem = useCallback(
    async (item: PendingReminderItem, choice: SnoozeChoice) => {
      await persistState((prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          snoozedUntil: {
            ...(prev.runtime.snoozedUntil || {}),
            [item.id]: resolveSnooze(choice, new Date()),
          },
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [persistState]
  );

  const dismissItemForCycle = useCallback(
    async (item: PendingReminderItem) => {
      if (!item.allowDismiss) return;

      await persistState((prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          dismissedCycles: {
            ...(prev.runtime.dismissedCycles || {}),
            [item.cycleKey]: dismissUntilForItem(item, new Date()),
          },
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [persistState]
  );

  const openPendingTarget = useCallback((item: PendingReminderItem) => {
    router.push(item.ctaPath as any);
  }, []);

  const value = useMemo<ReminderContextValue>(
    () => ({
      state,
      pendingItems,
      tabCounts,
      permissionStatus,
      isLoading,
      refresh,
      updateSettings,
      requestOsPermission,
      openOsSettings,
      snoozeItem,
      dismissItemForCycle,
      openPendingTarget,
    }),
    [
      state,
      pendingItems,
      tabCounts,
      permissionStatus,
      isLoading,
      refresh,
      updateSettings,
      requestOsPermission,
      openOsSettings,
      snoozeItem,
      dismissItemForCycle,
      openPendingTarget,
    ]
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders(): ReminderContextValue {
  const ctx = useContext(ReminderContext);
  if (!ctx) {
    throw new Error("useReminders must be used within ReminderProvider");
  }
  return ctx;
}
