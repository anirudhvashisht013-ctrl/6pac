import { getMondayYMD, toYMD } from "@/lib/dates";
import { parseTimestampDate } from "@/lib/measurements/slots";
import type {
  BodyMeasurementEntry,
  DailyLog,
  MealEntry,
  ReminderRuntime,
  ReminderSettings,
  WeeklyTarget,
  WeekSchedule,
  WorkoutSession,
} from "@/lib/types";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type ReminderTab = "index" | "week" | "workouts" | "nutrition" | "profile";
export type PendingReminderType =
  | "measurementOnboarding"
  | "measurements"
  | "dailyEssentials"
  | "nutritionLogging"
  | "weeklyPlan"
  | "weeklyTargets";
export type SnoozeChoice = "1h" | "tomorrow" | "weekend";

export type PendingReminderItem = {
  id: string;
  cycleKey: string;
  type: PendingReminderType;
  tab: ReminderTab;
  priority: number;
  title: string;
  reason: string;
  ctaLabel: string;
  ctaPath: string;
  allowDismiss: boolean;
  snoozeChoices: SnoozeChoice[];
};

export type ReminderNotificationPlan = {
  id: string;
  fireAt: string;
  title: string;
  body: string;
  deepLink: string;
  priority: number;
  sourceIds: string[];
};

export type ReminderEngineInput = {
  now: Date;
  timezone: string;
  settings: ReminderSettings;
  runtime: ReminderRuntime;
  canSendOsNotifications: boolean;
  logs: DailyLog[];
  meals: MealEntry[];
  targets: WeeklyTarget[];
  schedules: WeekSchedule[];
  sessions: WorkoutSession[];
  measurements: BodyMeasurementEntry[];
};

export type ReminderEngineOutput = {
  pendingItems: PendingReminderItem[];
  notifications: ReminderNotificationPlan[];
  runtimePatch: Partial<ReminderRuntime>;
};

type NotificationCandidate = {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  deepLink: string;
  priority: number;
};

function hasMeasurementValues(entry: BodyMeasurementEntry): boolean {
  return [
    entry.waist,
    entry.chest,
    entry.shoulders,
    entry.armsR,
    entry.armsL,
    entry.thighR,
    entry.thighL,
    entry.bicepsR,
    entry.bicepsL,
    entry.bodyFatPercent,
  ].some((value) => typeof value === "number");
}

function parseClock(value: string, fallback: string): { h: number; m: number } {
  const src = /^\d{2}:\d{2}$/.test(value) ? value : fallback;
  const [h, m] = src.split(":").map((v) => Number(v));
  return {
    h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0,
    m: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function ymdFromDate(d: Date): string {
  return toYMD(d);
}

function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

function withClock(base: Date | string, clock: string, fallback = "09:00"): Date {
  const source = typeof base === "string" ? dateFromYmd(base) : new Date(base);
  const { h, m } = parseClock(clock, fallback);
  source.setHours(h, m, 0, 0);
  return source;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function inQuietHours(d: Date, start: string, end: string): boolean {
  const startParts = parseClock(start, "22:00");
  const endParts = parseClock(end, "07:00");
  const mins = minuteOfDay(d);
  const startMin = startParts.h * 60 + startParts.m;
  const endMin = endParts.h * 60 + endParts.m;

  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return mins >= startMin && mins < endMin;
  }
  return mins >= startMin || mins < endMin;
}

function shiftOutOfQuietHours(d: Date, settings: ReminderSettings): Date {
  if (!settings.quietHours.enabled) return d;
  if (!inQuietHours(d, settings.quietHours.start, settings.quietHours.end)) return d;

  const shifted = new Date(d);
  const start = parseClock(settings.quietHours.start, "22:00");
  const end = parseClock(settings.quietHours.end, "07:00");
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  const mins = minuteOfDay(shifted);

  if (startMin < endMin) {
    shifted.setHours(end.h, end.m, 0, 0);
    return shifted;
  }

  if (mins >= startMin) {
    shifted.setDate(shifted.getDate() + 1);
  }

  shifted.setHours(end.h, end.m, 0, 0);
  return shifted;
}

function isWeekReady(schedule: WeekSchedule | null | undefined): boolean {
  if (!schedule) return false;
  return schedule.days.length > 0 && schedule.days.every((day) => day.status !== "unplanned");
}

function latestCompletedMeasurementAt(
  measurements: BodyMeasurementEntry[],
  preferredClock: string
): string | null {
  const completed = measurements
    .filter(hasMeasurementValues)
    .map((entry) => {
      const ts =
        parseTimestampDate(entry.loggedAt)?.toISOString() ||
        parseTimestampDate(entry.updatedAt)?.toISOString() ||
        withClock(entry.date, preferredClock).toISOString();
      return {
        at: ts,
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  return completed.length > 0 ? completed[completed.length - 1].at : null;
}

function isSuppressed(
  itemId: string,
  cycleKey: string,
  runtime: ReminderRuntime,
  nowMs: number
): boolean {
  void itemId;
  void cycleKey;
  void runtime;
  void nowMs;
  return false;
}

function cleanRuntime(runtime: ReminderRuntime, nowMs: number): Partial<ReminderRuntime> {
  void runtime;
  void nowMs;
  return {
    snoozedUntil: {},
    dismissedCycles: {},
  };
}

function finalizeNotificationPlan(
  candidates: NotificationCandidate[],
  now: Date,
  settings: ReminderSettings,
  canSendOsNotifications: boolean
): ReminderNotificationPlan[] {
  if (!settings.enabled || !canSendOsNotifications) return [];

  const minFireAt = now.getTime() + MINUTE_MS;

  const shifted = candidates
    .map((candidate) => {
      const shiftedAt = shiftOutOfQuietHours(candidate.fireAt, settings);
      return { ...candidate, fireAt: shiftedAt };
    })
    .filter((candidate) => candidate.fireAt.getTime() >= minFireAt)
    .sort((a, b) => {
      if (a.fireAt.getTime() !== b.fireAt.getTime()) {
        return a.fireAt.getTime() - b.fireAt.getTime();
      }
      return a.priority - b.priority;
    });

  const byDay = new Map<string, NotificationCandidate[]>();
  for (const candidate of shifted) {
    const dayKey = ymdFromDate(candidate.fireAt);
    const list = byDay.get(dayKey) || [];
    list.push(candidate);
    byDay.set(dayKey, list);
  }

  const plan: ReminderNotificationPlan[] = [];

  for (const [dayKey, list] of byDay.entries()) {
    const ordered = [...list].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.fireAt.getTime() - b.fireAt.getTime();
    });

    if (ordered.length === 1) {
      const first = ordered[0];
      plan.push({
        id: first.id,
        fireAt: first.fireAt.toISOString(),
        title: first.title,
        body: first.body,
        deepLink: first.deepLink,
        priority: first.priority,
        sourceIds: [first.id],
      });
      continue;
    }

    const first = ordered[0];
    plan.push({
      id: `summary:${dayKey}`,
      fireAt: first.fireAt.toISOString(),
      title: "You have pending 6Pac actions",
      body: `You have ${ordered.length} reminders waiting. Open pending actions to clear them.`,
      deepLink: "/(tabs)",
      priority: first.priority,
      sourceIds: ordered.map((item) => item.id),
    });
  }

  const byFinalDay = new Map<string, ReminderNotificationPlan[]>();
  for (const item of plan) {
    const day = item.fireAt.slice(0, 10);
    const list = byFinalDay.get(day) || [];
    list.push(item);
    byFinalDay.set(day, list);
  }

  const capped: ReminderNotificationPlan[] = [];
  for (const list of byFinalDay.values()) {
    const sorted = [...list].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.fireAt.localeCompare(b.fireAt);
    });
    capped.push(...sorted.slice(0, Math.max(1, settings.maxNotificationsPerDay || 2)));
  }

  return capped.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

function latestCompletedWorkoutIso(sessions: WorkoutSession[]): string | null {
  const completed = sessions
    .filter((session) => session.completed)
    .map((session) => session.endedAt || session.startedAt)
    .filter((v): v is string => !!v)
    .sort();
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

function daysAgoText(fromIso: string, now: Date): string {
  const from = new Date(fromIso);
  const nowMid = new Date(now);
  nowMid.setHours(0, 0, 0, 0);
  const fromMid = new Date(from);
  fromMid.setHours(0, 0, 0, 0);
  const diffDays = Math.max(0, Math.floor((nowMid.getTime() - fromMid.getTime()) / DAY_MS));
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export function computeReminderPlan(input: ReminderEngineInput): ReminderEngineOutput {
  const {
    now,
    timezone,
    settings,
    runtime,
    canSendOsNotifications,
    logs,
    meals,
    targets,
    schedules,
    sessions,
    measurements,
  } = input;

  const pendingItems: PendingReminderItem[] = [];
  const notificationCandidates: NotificationCandidate[] = [];
  const nowMs = now.getTime();

  const runtimePatch: Partial<ReminderRuntime> = {
    ...cleanRuntime(runtime, nowMs),
    timezone,
  };

  if (!settings.enabled) {
    return {
      pendingItems: [],
      notifications: [],
      runtimePatch,
    };
  }

  const today = ymdFromDate(now);

  // Measurement reminders and pending.
  if (settings.measurement.enabled) {
    const lastMeasurementIso = latestCompletedMeasurementAt(measurements, settings.measurement.time);
    runtimePatch.lastMeasurementCompletedAt = lastMeasurementIso;

    if (!lastMeasurementIso) {
      const pending: PendingReminderItem = {
        id: "measurement:onboarding",
        cycleKey: "measurement:onboarding",
        type: "measurementOnboarding",
        tab: "profile",
        priority: 0,
        title: "Set your first body measurement",
        reason: "No baseline measurement exists yet.",
        ctaLabel: "Start Measurement",
        ctaPath: "/profile-measurements",
        allowDismiss: false,
        snoozeChoices: ["tomorrow"],
      };

      if (!isSuppressed(pending.id, pending.cycleKey, runtime, nowMs)) {
        pendingItems.push(pending);
      }
    } else {
      const lastAt = new Date(lastMeasurementIso);
      const dueBase = addDays(lastAt, 15);
      const dueAt = withClock(dueBase, settings.measurement.time, "09:00");
      const dayBeforeAt = addDays(withClock(dueAt, settings.measurement.time, "09:00"), -1);
      const dayOfCountdownAt = new Date(dueAt.getTime() - HOUR_MS);
      const dueYmd = ymdFromDate(dueAt);

      const cycleKey = `measurement:${dueYmd}`;
      const itemId = `measurement:${dueYmd}`;
      const suppressed = isSuppressed(itemId, cycleKey, runtime, nowMs);
      const reason = `Last measurement was ${daysAgoText(lastMeasurementIso, now)} ago.`;

      let title: string | null = null;
      if (nowMs >= dueAt.getTime()) {
        title = "Body measurement overdue";
      } else if (today === dueYmd) {
        title = "Body measurement due today";
      }

      if (title && !suppressed) {
        pendingItems.push({
          id: itemId,
          cycleKey,
          type: "measurements",
          tab: "profile",
          priority: 1,
          title,
          reason,
          ctaLabel: "Log Measurement",
          ctaPath: "/profile-measurements",
          allowDismiss: false,
          snoozeChoices: ["1h", "tomorrow"],
        });
      }

      if (!suppressed) {
        if (dayBeforeAt.getTime() > nowMs) {
          notificationCandidates.push({
            id: `measurement:day-before:${dueYmd}`,
            fireAt: dayBeforeAt,
            title: "Measurement reminder",
            body: "Body measurement due tomorrow.",
            deepLink: "/profile-measurements",
            priority: 1,
          });
        }

        if (dayOfCountdownAt.getTime() > nowMs) {
          notificationCandidates.push({
            id: `measurement:day-of:${dueYmd}`,
            fireAt: dayOfCountdownAt,
            title: "Measurement day in 60 min",
            body: "You are one hour away from today’s body check-in.",
            deepLink: "/profile-measurements",
            priority: 1,
          });
        }

        if (nowMs >= dueAt.getTime()) {
          const horizonDays = 7;
          for (let i = 0; i < horizonDays; i += 1) {
            const day = addDays(withClock(today, settings.measurement.time), i);
            if (day.getTime() <= nowMs + MINUTE_MS) continue;
            notificationCandidates.push({
              id: `measurement:overdue:${dueYmd}:${ymdFromDate(day)}`,
              fireAt: day,
              title: "Body measurement still pending",
              body: "Measurement is overdue. Log once to reset your 15-day cycle.",
              deepLink: "/profile-measurements",
              priority: 1,
            });
          }
        }
      }
    }
  }

  // Weekly planning reminder for next week.
  if (settings.weeklyPlan.enabled) {
    const thisWeekStart = getMondayYMD(now);
    const thisWeekDate = dateFromYmd(thisWeekStart);
    const sundayDate = addDays(thisWeekDate, 6);
    const nextWeekStart = ymdFromDate(addDays(thisWeekDate, 7));
    const sundayReminderAt = withClock(sundayDate, settings.weeklyPlan.time, "18:00");

    const nextWeekSchedule = schedules.find((schedule) => schedule.weekStartDate === nextWeekStart);
    const ready = isWeekReady(nextWeekSchedule);
    const currentWeekSchedule = schedules.find((schedule) => schedule.weekStartDate === thisWeekStart);
    const currentWeekReady = isWeekReady(currentWeekSchedule);
    const currentWeekTarget = targets.find((target) => target.weekStartDate === thisWeekStart) || null;
    const hasCurrentWeekTarget =
      !!currentWeekTarget &&
      Number.isFinite(currentWeekTarget.dailyCaloriesTarget) &&
      Number.isFinite(currentWeekTarget.dailyStepsTarget) &&
      Number.isFinite(currentWeekTarget.dailyWaterMlTarget);

    const currentCycleKey = `weekly-plan:current:${thisWeekStart}`;
    const currentItemId = currentCycleKey;
    const currentSuppressed = isSuppressed(currentItemId, currentCycleKey, runtime, nowMs);

    if (!currentWeekReady && !currentSuppressed) {
      pendingItems.push({
        id: currentItemId,
        cycleKey: currentCycleKey,
        type: "weeklyPlan",
        tab: "week",
        priority: 2,
        title: "Finish this week setup",
        reason: "This week still has unplanned workout days.",
        ctaLabel: "Open Weekly Plan",
        ctaPath: "/(tabs)/week",
        allowDismiss: true,
        snoozeChoices: ["1h", "weekend"],
      });
    }

    const targetCycleKey = `weekly-targets:${thisWeekStart}`;
    const targetItemId = targetCycleKey;
    const targetSuppressed = isSuppressed(targetItemId, targetCycleKey, runtime, nowMs);

    if (!hasCurrentWeekTarget && !targetSuppressed) {
      pendingItems.push({
        id: targetItemId,
        cycleKey: targetCycleKey,
        type: "weeklyTargets",
        tab: "week",
        priority: 2,
        title: "Set weekly targets",
        reason: "This week is missing calorie, steps, or water targets.",
        ctaLabel: "Open Weekly Plan",
        ctaPath: "/(tabs)/week",
        allowDismiss: true,
        snoozeChoices: ["1h", "weekend"],
      });
    }

    if (ready) {
      runtimePatch.lastWeeklyPlanCompletedWeek = nextWeekStart;
    }

    const suppressed = isSuppressed(`weekly-plan:${nextWeekStart}`, `weekly-plan:${nextWeekStart}`, runtime, nowMs);

    if (!ready && !suppressed && sundayReminderAt.getTime() > nowMs) {
      notificationCandidates.push({
        id: `weekly-plan:${nextWeekStart}`,
        fireAt: sundayReminderAt,
        title: "Weekly planning reminder",
        body: "Set your plan for next week before Monday starts.",
        deepLink: "/(tabs)/week",
        priority: 2,
      });
    }

  }

  const latestWorkout = latestCompletedWorkoutIso(sessions);
  if (latestWorkout) {
    runtimePatch.lastWorkoutCompletedAt = latestWorkout;
  }

  // Daily logging nudge.
  if (settings.dailyLogging.enabled) {
    const todayLog = logs.find((log) => log.date === today) || null;
    const todayMeals = meals.filter((meal) => meal.date === today);

    const missingEssentials: string[] = [];
    const hasMealData =
      todayMeals.length > 0 &&
      todayMeals.some(
        (meal) =>
          meal.calories != null ||
          meal.proteinG != null ||
          meal.carbsG != null ||
          meal.fatG != null
      );

    if (todayLog?.weightKg == null) missingEssentials.push("weight");
    if (todayLog?.steps == null) missingEssentials.push("steps");
    if (todayLog?.sleepHours == null) missingEssentials.push("sleep");
    if (todayLog?.waterMl == null) missingEssentials.push("water");

    if (missingEssentials.length === 0) {
      runtimePatch.lastDailyLoggingCompletedDate = today;
    }

    const nudgeAt = withClock(today, settings.dailyLogging.time, "20:00");
    const essentialsCycleKey = `daily-essentials:${today}`;
    const essentialsItemId = essentialsCycleKey;
    const essentialsSuppressed = isSuppressed(essentialsItemId, essentialsCycleKey, runtime, nowMs);

    if (missingEssentials.length > 0 && !essentialsSuppressed) {
      pendingItems.push({
        id: essentialsItemId,
        cycleKey: essentialsCycleKey,
        type: "dailyEssentials",
        tab: "index",
        priority: 3,
        title: "Complete today’s SSWW",
        reason: `Missing: ${missingEssentials.join(", ")}.`,
        ctaLabel: "Open Today",
        ctaPath: "/(tabs)",
        allowDismiss: true,
        snoozeChoices: ["1h", "tomorrow"],
      });
    }

    const nutritionCycleKey = `nutrition-logging:${today}`;
    const nutritionItemId = nutritionCycleKey;
    const nutritionSuppressed = isSuppressed(nutritionItemId, nutritionCycleKey, runtime, nowMs);

    if (!hasMealData && !nutritionSuppressed) {
      pendingItems.push({
        id: nutritionItemId,
        cycleKey: nutritionCycleKey,
        type: "nutritionLogging",
        tab: "nutrition",
        priority: 3,
        title: "Log nutrition for today",
        reason: "Calories/macros are still missing from nutrition entries.",
        ctaLabel: "Open Nutrition",
        ctaPath: "/(tabs)/nutrition",
        allowDismiss: true,
        snoozeChoices: ["1h", "tomorrow"],
      });
    }

    if (
      (missingEssentials.length > 0 || !hasMealData) &&
      settings.dailyLogging.sendOsNotification &&
      nudgeAt.getTime() > nowMs
    ) {
      notificationCandidates.push({
        id: `daily-logging:${today}`,
        fireAt: nudgeAt,
        title: "Daily logging reminder",
        body: "You still have daily essentials to log.",
        deepLink: "/(tabs)",
        priority: 3,
      });
    }
  }

  const notifications = finalizeNotificationPlan(
    notificationCandidates,
    now,
    settings,
    canSendOsNotifications
  );

  const orderedPending = pendingItems.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.title.localeCompare(b.title);
  });

  return {
    pendingItems: orderedPending,
    notifications,
    runtimePatch,
  };
}
