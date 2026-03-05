import test from "node:test";
import assert from "node:assert/strict";
import { computeReminderPlan } from "@/lib/reminders/engine";
import { DEFAULT_REMINDER_SETTINGS } from "@/lib/reminders/defaults";
import type { ReminderRuntime, ReminderSettings } from "@/lib/types";

function makeRuntime(): ReminderRuntime {
  return {
    permissionStatus: "granted",
    snoozedUntil: {},
    dismissedCycles: {},
  };
}

function makeSettings(patch?: Partial<ReminderSettings>): ReminderSettings {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    ...(patch || {}),
    measurement: {
      ...DEFAULT_REMINDER_SETTINGS.measurement,
      ...(patch?.measurement || {}),
    },
    weeklyPlan: {
      ...DEFAULT_REMINDER_SETTINGS.weeklyPlan,
      ...(patch?.weeklyPlan || {}),
    },
    workout: {
      ...DEFAULT_REMINDER_SETTINGS.workout,
      ...(patch?.workout || {}),
    },
    dailyLogging: {
      ...DEFAULT_REMINDER_SETTINGS.dailyLogging,
      ...(patch?.dailyLogging || {}),
    },
    quietHours: {
      ...DEFAULT_REMINDER_SETTINGS.quietHours,
      ...(patch?.quietHours || {}),
    },
  };
}

test("shows onboarding pending when no measurements exist", () => {
  const out = computeReminderPlan({
    now: new Date("2026-03-04T08:00:00"),
    timezone: "Asia/Kolkata",
    settings: makeSettings(),
    runtime: makeRuntime(),
    canSendOsNotifications: true,
    logs: [],
    meals: [],
    targets: [],
    schedules: [],
    sessions: [],
    measurements: [],
  });

  assert.equal(out.pendingItems[0]?.type, "measurementOnboarding");
});

test("measurement due tomorrow schedules countdown notification without tab dot", () => {
  const out = computeReminderPlan({
    now: new Date("2026-03-15T10:00:00"),
    timezone: "Asia/Kolkata",
    settings: makeSettings({ measurement: { time: "09:00", enabled: true } }),
    runtime: makeRuntime(),
    canSendOsNotifications: true,
    logs: [],
    meals: [],
    targets: [],
    schedules: [],
    sessions: [],
    measurements: [
      {
        date: "2026-03-01",
        waist: 82,
        chest: null,
        shoulders: null,
        armsR: null,
        armsL: null,
        thighR: null,
        thighL: null,
        bicepsR: null,
        bicepsL: null,
        bodyFatPercent: null,
        notes: null,
        loggedAt: "2026-03-01T09:00:00.000",
      },
    ],
  });

  assert.ok(!out.pendingItems.some((item) => item.type === "measurements"));
  assert.ok(out.notifications.some((item) => item.id.startsWith("measurement:day-of")));
});

test("weekly plan pending appears Sunday evening when next week is not ready", () => {
  const out = computeReminderPlan({
    now: new Date("2026-03-08T19:30:00"),
    timezone: "Asia/Kolkata",
    settings: makeSettings({ weeklyPlan: { enabled: true, time: "18:00" } }),
    runtime: makeRuntime(),
    canSendOsNotifications: true,
    logs: [],
    meals: [],
    targets: [],
    schedules: [],
    sessions: [],
    measurements: [],
  });

  assert.ok(out.pendingItems.some((item) => item.type === "weeklyPlan"));
});

test("daily logging pending appears after threshold when essentials are missing", () => {
  const out = computeReminderPlan({
    now: new Date("2026-03-04T21:00:00"),
    timezone: "Asia/Kolkata",
    settings: makeSettings({ dailyLogging: { enabled: true, time: "20:00", sendOsNotification: true } }),
    runtime: makeRuntime(),
    canSendOsNotifications: true,
    logs: [
      {
        date: "2026-03-04",
        weightKg: null,
        sleepHours: null,
        waterMl: null,
        steps: null,
        supplementsTaken: null,
        caloriesManual: null,
        notes: null,
        updatedAt: "2026-03-04T08:00:00.000Z",
      },
    ],
    meals: [],
    targets: [],
    schedules: [],
    sessions: [],
    measurements: [],
  });

  const daily = out.pendingItems.find((item) => item.type === "dailyEssentials");
  assert.ok(daily);
  assert.match(daily?.reason || "", /Missing:/);
});

test("quiet hours shift late reminders to next allowed window", () => {
  const out = computeReminderPlan({
    now: new Date("2026-03-04T10:00:00"),
    timezone: "Asia/Kolkata",
    settings: makeSettings({
      dailyLogging: { enabled: true, time: "23:00", sendOsNotification: true },
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    }),
    runtime: makeRuntime(),
    canSendOsNotifications: true,
    logs: [
      {
        date: "2026-03-04",
        weightKg: null,
        sleepHours: null,
        waterMl: null,
        steps: null,
        supplementsTaken: null,
        caloriesManual: null,
        notes: null,
        updatedAt: "2026-03-04T08:00:00.000Z",
      },
    ],
    meals: [],
    targets: [],
    schedules: [],
    sessions: [],
    measurements: [],
  });

  const dailyNotification = out.notifications.find((item) => item.id.startsWith("daily-logging"));
  assert.ok(dailyNotification);
  assert.equal(new Date(dailyNotification!.fireAt).getHours(), 7);
});

test("multiple same-day notifications collapse into one summary", () => {
  const out = computeReminderPlan({
    now: new Date("2026-03-15T08:30:00"),
    timezone: "Asia/Kolkata",
    settings: makeSettings({
      measurement: { enabled: true, time: "09:00" },
      dailyLogging: { enabled: true, time: "20:00", sendOsNotification: true },
    }),
    runtime: makeRuntime(),
    canSendOsNotifications: true,
    logs: [
      {
        date: "2026-03-15",
        weightKg: null,
        sleepHours: null,
        waterMl: null,
        steps: null,
        supplementsTaken: null,
        caloriesManual: null,
        notes: null,
        updatedAt: "2026-03-15T08:00:00.000Z",
      },
    ],
    meals: [],
    targets: [],
    schedules: [],
    sessions: [],
    measurements: [
      {
        date: "2026-03-01",
        waist: 80,
        chest: null,
        shoulders: null,
        armsR: null,
        armsL: null,
        thighR: null,
        thighL: null,
        bicepsR: null,
        bicepsL: null,
        bodyFatPercent: null,
        notes: null,
        loggedAt: "2026-03-01T09:00:00.000Z",
      },
    ],
  });

  const day = "2026-03-15";
  const dayNotifs = out.notifications.filter((item) => item.fireAt.startsWith(day));
  assert.equal(dayNotifs.length, 1);
  assert.equal(dayNotifs[0].id, "summary:2026-03-15");
});
