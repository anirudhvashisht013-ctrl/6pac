import type { BlockPerformance, GymSet, WorkoutBlock, WorkoutSession } from "@/lib/types";

const DEV_MODE = typeof __DEV__ !== "undefined" && __DEV__;

export type WorkoutSessionExecutionState = "in_progress" | "completed" | "missed";

export type WorkoutSessionSnapshotBoundary = {
  workoutTemplateId: string | null;
  workoutNameSnapshot: string;
  sessionBlocks?: WorkoutBlock[];
  blockPerformances: BlockPerformance[];
  executionState: WorkoutSessionExecutionState;
};

export type WorkoutSessionSnapshotFallback = {
  workoutTemplateId?: string | null;
  workoutName?: string | null;
  blocks?: WorkoutBlock[] | null;
};

type NormalizeWorkoutSessionOptions = {
  existingSession?: WorkoutSession | null;
  fallback?: WorkoutSessionSnapshotFallback;
  context?: string;
};

function logSessionInvariantRecovery(
  session: WorkoutSession,
  recovered: string[],
  context?: string
) {
  if (!DEV_MODE || recovered.length === 0) return;
  const label = context ? ` [${context}]` : "";
  console.warn(`[workout-session]${label} recovered execution snapshot for ${session.id || "<missing-id>"}`, recovered);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWorkoutTemplateId(value: unknown): string | null {
  return asNonEmptyString(value);
}

function normalizeSessionBlocks(value: unknown): WorkoutBlock[] | undefined {
  return Array.isArray(value) ? (value as WorkoutBlock[]) : undefined;
}

function normalizePerformanceSets(value: unknown): GymSet[] | undefined {
  return Array.isArray(value) ? (value as GymSet[]) : undefined;
}

function normalizeBlockPerformanceEntry(value: unknown): BlockPerformance | null {
  if (!value || typeof value !== "object") return null;
  const perf = value as BlockPerformance;
  const blockId = asNonEmptyString(perf.blockId);
  if (!blockId) return null;

  const normalized: BlockPerformance = {
    ...perf,
    blockId,
    completed: !!perf.completed,
  };

  if (perf.exerciseIdOverride === null) {
    normalized.exerciseIdOverride = null;
  } else {
    const normalizedExerciseIdOverride = normalizeWorkoutTemplateId(perf.exerciseIdOverride);
    if (normalizedExerciseIdOverride) {
      normalized.exerciseIdOverride = normalizedExerciseIdOverride;
    }
  }

  const normalizedSets = normalizePerformanceSets(perf.sets);
  if (normalizedSets) {
    normalized.sets = normalizedSets;
  }

  return normalized;
}

function defaultSetsForBlock(block: WorkoutBlock): GymSet[] | undefined {
  if (block.type !== "gym") return undefined;
  return Array.from({ length: Math.max(1, block.sets || 1) }, () => ({
    weight: null,
    reps: null,
    completed: false,
  }));
}

function defaultPerformanceForBlock(block: WorkoutBlock): BlockPerformance {
  return {
    blockId: block.id,
    completed: false,
    ...(block.type === "gym" ? { sets: defaultSetsForBlock(block) } : {}),
  };
}

function buildUsableBlockPerformances(
  rawPerformances: unknown,
  blocks: WorkoutBlock[] | undefined,
  recovered: string[]
): BlockPerformance[] {
  const normalizedPerformances = Array.isArray(rawPerformances)
    ? rawPerformances
        .map(normalizeBlockPerformanceEntry)
        .filter((item): item is BlockPerformance => !!item)
    : [];

  if (!Array.isArray(rawPerformances)) {
    recovered.push("blockPerformances");
  }

  if (!blocks || blocks.length === 0) {
    return normalizedPerformances;
  }

  const byBlockId = new Map<string, BlockPerformance>();
  let hadPerformanceRepair = normalizedPerformances.length !== (Array.isArray(rawPerformances) ? rawPerformances.length : 0);

  for (const perf of normalizedPerformances) {
    if (byBlockId.has(perf.blockId)) {
      hadPerformanceRepair = true;
    }
    byBlockId.set(perf.blockId, perf);
  }

  const blockIds = new Set(blocks.map((block) => block.id));
  const aligned = blocks.map((block) => {
    const existing = byBlockId.get(block.id);
    if (!existing) {
      hadPerformanceRepair = true;
      return defaultPerformanceForBlock(block);
    }
    return existing;
  });

  const orphanPerformances = normalizedPerformances.filter((perf) => !blockIds.has(perf.blockId));
  if (orphanPerformances.length > 0) {
    hadPerformanceRepair = true;
  }

  if (hadPerformanceRepair) {
    recovered.push("blockPerformances");
  }

  return [...aligned, ...orphanPerformances];
}

function resolveExecutionState(session: WorkoutSession, recovered: string[]): WorkoutSessionExecutionState {
  if (session.completed) {
    if (session.missed) {
      recovered.push("missed");
    }
    return "completed";
  }

  if (session.missed) {
    return "missed";
  }

  return "in_progress";
}

function resolveStableString(
  current: unknown,
  existing: unknown,
  field: string,
  recovered: string[]
): string | null {
  const currentValue = asNonEmptyString(current);
  if (currentValue) return currentValue;

  const existingValue = asNonEmptyString(existing);
  if (existingValue) {
    recovered.push(field);
    return existingValue;
  }

  return null;
}

function buildNormalizedSession(
  session: WorkoutSession,
  options?: NormalizeWorkoutSessionOptions
): WorkoutSession {
  const recovered: string[] = [];
  const existing = options?.existingSession ?? null;
  const fallback = options?.fallback;

  const id = resolveStableString(session.id, existing?.id, "id", recovered) ?? "";
  const date = resolveStableString(session.date, existing?.date, "date", recovered) ?? "";
  const startedAt = resolveStableString(session.startedAt, existing?.startedAt, "startedAt", recovered) ?? "";
  const endedAt = session.endedAt === null ? null : resolveStableString(session.endedAt, existing?.endedAt, "endedAt", recovered);
  const sessionBlocks =
    normalizeSessionBlocks(session.sessionBlocks) ??
    normalizeSessionBlocks(existing?.sessionBlocks) ??
    normalizeSessionBlocks(fallback?.blocks);

  if (!normalizeSessionBlocks(session.sessionBlocks) && normalizeSessionBlocks(existing?.sessionBlocks)) {
    recovered.push("sessionBlocks");
  } else if (!normalizeSessionBlocks(session.sessionBlocks) && normalizeSessionBlocks(fallback?.blocks)) {
    recovered.push("sessionBlocks");
  } else if (session.sessionBlocks != null && !Array.isArray(session.sessionBlocks)) {
    recovered.push("sessionBlocks");
  }

  const workoutTemplateId =
    normalizeWorkoutTemplateId(session.workoutTemplateId) ??
    normalizeWorkoutTemplateId(existing?.workoutTemplateId) ??
    normalizeWorkoutTemplateId(fallback?.workoutTemplateId) ??
    null;

  if (normalizeWorkoutTemplateId(session.workoutTemplateId) == null) {
    if (normalizeWorkoutTemplateId(existing?.workoutTemplateId) != null) {
      recovered.push("workoutTemplateId");
    } else if (normalizeWorkoutTemplateId(fallback?.workoutTemplateId) != null) {
      recovered.push("workoutTemplateId");
    }
  }

  const workoutNameSnapshot =
    resolveStableString(session.workoutNameSnapshot, existing?.workoutNameSnapshot, "workoutNameSnapshot", recovered) ??
    asNonEmptyString(fallback?.workoutName) ??
    "Workout";

  if (!asNonEmptyString(session.workoutNameSnapshot) && asNonEmptyString(fallback?.workoutName)) {
    recovered.push("workoutNameSnapshot");
  }

  const blockPerformances = buildUsableBlockPerformances(
    Array.isArray(session.blockPerformances) ? session.blockPerformances : existing?.blockPerformances,
    sessionBlocks,
    recovered
  );

  const executionState = resolveExecutionState(session, recovered);

  logSessionInvariantRecovery(session, recovered, options?.context);

  return {
    ...session,
    id,
    date,
    startedAt,
    endedAt,
    workoutTemplateId,
    workoutNameSnapshot,
    sessionBlocks,
    blockPerformances,
    missed: executionState === "missed",
    completed: executionState === "completed",
  };
}

export function normalizeWorkoutSessionRecord(
  session: WorkoutSession,
  options?: NormalizeWorkoutSessionOptions
): WorkoutSession {
  return buildNormalizedSession(session, options);
}

export function prepareWorkoutSessionForSave(
  session: WorkoutSession,
  options?: NormalizeWorkoutSessionOptions
): WorkoutSession {
  const normalized = buildNormalizedSession(session, {
    ...options,
    context: options?.context ?? "save",
  });

  if (!asNonEmptyString(normalized.id)) {
    throw new Error("workout session missing stable id");
  }
  if (!asNonEmptyString(normalized.date)) {
    throw new Error(`workout session ${normalized.id} missing stable date`);
  }
  if (!asNonEmptyString(normalized.startedAt)) {
    throw new Error(`workout session ${normalized.id} missing stable startedAt`);
  }

  return normalized;
}

export function getWorkoutSessionExecutionState(session: WorkoutSession): WorkoutSessionExecutionState {
  return resolveExecutionState(session, []);
}

export function getWorkoutSessionSnapshotBoundary(
  session: WorkoutSession,
  fallback?: WorkoutSessionSnapshotFallback
): WorkoutSessionSnapshotBoundary {
  const normalized = normalizeWorkoutSessionRecord(session, {
    fallback,
    context: "snapshot-boundary",
  });

  return {
    workoutTemplateId: normalized.workoutTemplateId ?? fallback?.workoutTemplateId ?? null,
    workoutNameSnapshot: normalized.workoutNameSnapshot || asNonEmptyString(fallback?.workoutName) || "Workout",
    sessionBlocks: normalized.sessionBlocks || normalizeSessionBlocks(fallback?.blocks),
    blockPerformances: normalized.blockPerformances,
    executionState: getWorkoutSessionExecutionState(normalized),
  };
}

export function getWorkoutSessionDisplayName(
  session: WorkoutSession,
  fallback?: WorkoutSessionSnapshotFallback
): string {
  const boundary = getWorkoutSessionSnapshotBoundary(session, fallback);
  return boundary.workoutNameSnapshot || "Workout";
}
