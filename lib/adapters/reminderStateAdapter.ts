import type {
  ReminderRuntime,
  ReminderSettings,
  ReminderSettingsMirrorDoc,
  ReminderState,
} from "@/lib/types";
import { mergeReminderStateDefaults } from "@/lib/reminders/defaults";

const DEV_MODE = typeof __DEV__ !== "undefined" && __DEV__;

export type ReminderStateBoundary = {
  // Durable user preferences that may be mirrored to cloud.
  settings: ReminderSettings;
  // Local operational state for snoozes, dismissals, permission recency, and last-run markers.
  runtime: ReminderRuntime;
  createdAt: string;
  updatedAt: string;
};

function logReminderRecovery(message: string, state: ReminderState | null, context?: string) {
  if (!DEV_MODE) return;
  const label = context ? ` [${context}]` : "";
  console.warn(`[reminder-state]${label} ${message}`, {
    id: state?.id,
    version: state?.version,
  });
}

export function normalizeReminderStateRecord(
  state: ReminderState | null,
  context?: string
): ReminderState {
  const normalized = mergeReminderStateDefaults(state);

  if (!state) {
    logReminderRecovery("missing reminder state; using defaults", state, context);
    return normalized;
  }

  const recovered: string[] = [];

  if (state.id !== "primary") recovered.push("id");
  if (state.version !== 1) recovered.push("version");
  if (!state.settings || typeof state.settings !== "object") recovered.push("settings");
  if (!state.runtime || typeof state.runtime !== "object") recovered.push("runtime");
  if (!state.settings?.measurement || typeof state.settings.measurement !== "object") {
    recovered.push("settings.measurement");
  }
  if (!state.settings?.weeklyPlan || typeof state.settings.weeklyPlan !== "object") {
    recovered.push("settings.weeklyPlan");
  }
  if (!state.settings?.workout || typeof state.settings.workout !== "object") {
    recovered.push("settings.workout");
  }
  if (!state.settings?.dailyLogging || typeof state.settings.dailyLogging !== "object") {
    recovered.push("settings.dailyLogging");
  }
  if (!state.settings?.quietHours || typeof state.settings.quietHours !== "object") {
    recovered.push("settings.quietHours");
  }
  if (!state.runtime?.snoozedUntil || typeof state.runtime.snoozedUntil !== "object") {
    recovered.push("runtime.snoozedUntil");
  }
  if (!state.runtime?.dismissedCycles || typeof state.runtime.dismissedCycles !== "object") {
    recovered.push("runtime.dismissedCycles");
  }

  if (recovered.length > 0) {
    logReminderRecovery(`recovered reminder boundary fields: ${recovered.join(", ")}`, state, context);
  }

  return normalized;
}

export function toReminderStateBoundary(
  state: ReminderState | null,
  context?: string
): ReminderStateBoundary {
  const normalized = normalizeReminderStateRecord(state, context);
  return {
    settings: normalized.settings,
    runtime: normalized.runtime,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
}

export function getReminderSettingsBoundary(
  state: ReminderState | null,
  context?: string
): ReminderSettings {
  return toReminderStateBoundary(state, context).settings;
}

export function getReminderRuntimeBoundary(
  state: ReminderState | null,
  context?: string
): ReminderRuntime {
  return toReminderStateBoundary(state, context).runtime;
}

export function withReminderSettingsBoundary(
  state: ReminderState | null,
  settings: ReminderSettings
): ReminderState {
  const normalized = normalizeReminderStateRecord(state, "settings-boundary");
  return {
    ...normalized,
    settings,
  };
}

export function withReminderRuntimeBoundary(
  state: ReminderState | null,
  runtime: ReminderRuntime
): ReminderState {
  const normalized = normalizeReminderStateRecord(state, "runtime-boundary");
  return {
    ...normalized,
    runtime,
  };
}

export function toReminderSettingsMirrorBoundary(state: ReminderState | null): ReminderSettingsMirrorDoc {
  const boundary = toReminderStateBoundary(state, "settings-mirror");
  return {
    id: "primary",
    version: 1,
    settings: boundary.settings,
    createdAt: boundary.createdAt,
    updatedAt: boundary.updatedAt,
  };
}
