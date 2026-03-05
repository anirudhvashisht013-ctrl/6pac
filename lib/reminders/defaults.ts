import type { ReminderState, ReminderSettings } from "@/lib/types";

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  measurement: {
    enabled: true,
    time: "09:00",
  },
  weeklyPlan: {
    enabled: true,
    time: "18:00",
  },
  workout: {
    enabled: true,
    time: "17:30",
    leadMinutes: 30,
  },
  dailyLogging: {
    enabled: true,
    time: "20:00",
    sendOsNotification: true,
  },
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "07:00",
  },
  maxNotificationsPerDay: 2,
};

export function buildDefaultReminderState(nowIso: string = new Date().toISOString()): ReminderState {
  return {
    id: "primary",
    version: 1,
    settings: DEFAULT_REMINDER_SETTINGS,
    runtime: {
      permissionStatus: "unknown",
      lastPermissionPromptAt: null,
      lastMeasurementCompletedAt: null,
      lastWeeklyPlanCompletedWeek: null,
      lastWorkoutCompletedAt: null,
      lastDailyLoggingCompletedDate: null,
      snoozedUntil: {},
      dismissedCycles: {},
      timezone: undefined,
      updatedAt: nowIso,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function mergeReminderStateDefaults(
  state: ReminderState | null,
  nowIso: string = new Date().toISOString()
): ReminderState {
  const base = buildDefaultReminderState(nowIso);
  if (!state) return base;

  return {
    ...base,
    ...state,
    settings: {
      ...base.settings,
      ...(state.settings || {}),
      measurement: {
        ...base.settings.measurement,
        ...(state.settings?.measurement || {}),
      },
      weeklyPlan: {
        ...base.settings.weeklyPlan,
        ...(state.settings?.weeklyPlan || {}),
      },
      workout: {
        ...base.settings.workout,
        ...(state.settings?.workout || {}),
      },
      dailyLogging: {
        ...base.settings.dailyLogging,
        ...(state.settings?.dailyLogging || {}),
      },
      quietHours: {
        ...base.settings.quietHours,
        ...(state.settings?.quietHours || {}),
      },
      maxNotificationsPerDay:
        typeof state.settings?.maxNotificationsPerDay === "number"
          ? state.settings.maxNotificationsPerDay
          : base.settings.maxNotificationsPerDay,
    },
    runtime: {
      ...base.runtime,
      ...(state.runtime || {}),
      snoozedUntil: {
        ...(base.runtime.snoozedUntil || {}),
        ...(state.runtime?.snoozedUntil || {}),
      },
      dismissedCycles: {
        ...(base.runtime.dismissedCycles || {}),
        ...(state.runtime?.dismissedCycles || {}),
      },
    },
  };
}
