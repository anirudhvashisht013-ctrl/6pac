export const mirrorCollections = {
  dailyLogs: "daily_logs",
  nutritionEntries: "nutrition_entries",
  weeklyTargets: "weekly_targets",
  weeklyPlans: "weekly_plans",
  workoutTemplates: "workout_templates",
  exercises: "exercises",
  workoutSessions: "workout_sessions",
  bodyMeasurements: "body_measurements",
  reminderSettings: "reminder_settings",
  dailySummaries: "daily_summaries",
  syncTombstones: "sync_tombstones",
} as const;

export type MirrorCollectionName =
  (typeof mirrorCollections)[keyof typeof mirrorCollections];

export const mirrorCollectionAliases: Record<MirrorCollectionName, readonly string[]> = {
  [mirrorCollections.dailyLogs]: ["logs_v1"],
  [mirrorCollections.nutritionEntries]: ["meals_v1"],
  [mirrorCollections.weeklyTargets]: ["targets_v1"],
  [mirrorCollections.weeklyPlans]: ["schedules_v1"],
  [mirrorCollections.workoutTemplates]: ["templates_v1"],
  [mirrorCollections.exercises]: ["exercises_v1"],
  [mirrorCollections.workoutSessions]: ["sessions_v1"],
  [mirrorCollections.bodyMeasurements]: ["measurements_local_v1"],
  [mirrorCollections.reminderSettings]: ["reminders_v1"],
  [mirrorCollections.dailySummaries]: [],
  [mirrorCollections.syncTombstones]: ["tombstones_v1"],
};

const legacyToCanonical = Object.entries(mirrorCollectionAliases).reduce<Record<string, string>>(
  (acc, [canonical, aliases]) => {
    for (const alias of aliases) acc[alias] = canonical;
    return acc;
  },
  {}
);

export function getMirrorReadCollections(primary: MirrorCollectionName): readonly string[] {
  return [primary, ...mirrorCollectionAliases[primary]];
}

export function toCanonicalMirrorCollectionName(name: string): string {
  return legacyToCanonical[name] || name;
}
