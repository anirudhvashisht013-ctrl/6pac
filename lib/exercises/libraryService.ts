import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { MAX_REFERENCE_VIDEO_URLS } from '@/lib/exercises/constants';
import { exercisesRepo, workoutsRepo } from '@/lib/storage';
import type { ExerciseLibraryItem, ExerciseMovementType, WorkoutTemplate } from '@/lib/types';

const DEFAULT_PRIMARY_MUSCLE = 'Uncategorized';
const BOOTSTRAP_KEY = (uid: string) => `@6pac:exercise_library_bootstrap_v1:${uid}`;

export type ExerciseDraft = {
  id?: string;
  name: string;
  coachingCues?: string;
  referenceVideoUrls?: string[];
  movementType?: ExerciseMovementType;
  primaryMuscleGroup?: string;
  targetMuscles?: string[];
  equipment?: string | null;
  alternativeExerciseIds?: string[];
};

export type DeleteExerciseResult = {
  templatesUpdated: number;
  alternativesUpdated: number;
};

function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function normalizeExerciseName(input: string): string {
  return normalizeWhitespace(input).toLowerCase();
}

function normalizeMuscleGroup(input: string | undefined): string {
  const value = normalizeWhitespace(input || '');
  return value || DEFAULT_PRIMARY_MUSCLE;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const clean = normalizeWhitespace(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const url of urls) {
    const clean = normalizeWhitespace(url);
    if (!clean) continue;
    const key = clean.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next.slice(0, MAX_REFERENCE_VIDEO_URLS);
}

function buildExercisePayload(
  draft: ExerciseDraft,
  existing: ExerciseLibraryItem | null,
  nowIso: string,
  fallbackId?: string
): ExerciseLibraryItem {
  const name = normalizeWhitespace(draft.name);
  if (!name) throw new Error('Exercise name is required');

  const id = existing?.id || fallbackId || draft.id || Crypto.randomUUID();

  return {
    id,
    name,
    normalizedName: normalizeExerciseName(name),
    coachingCues: normalizeWhitespace(draft.coachingCues || existing?.coachingCues || ''),
    referenceVideoUrls: dedupeUrls(draft.referenceVideoUrls || existing?.referenceVideoUrls || []),
    movementType: draft.movementType || existing?.movementType || 'compound',
    primaryMuscleGroup: normalizeMuscleGroup(draft.primaryMuscleGroup || existing?.primaryMuscleGroup),
    targetMuscles: uniqueStrings(draft.targetMuscles || existing?.targetMuscles || []),
    equipment: normalizeWhitespace(draft.equipment || existing?.equipment || '') || null,
    alternativeExerciseIds: draft.alternativeExerciseIds || existing?.alternativeExerciseIds || [],
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
}

async function persistAlternativeLinkUpdates(
  uid: string,
  exercise: ExerciseLibraryItem,
  allById: Map<string, ExerciseLibraryItem>,
  previousAlternativeIds: string[]
): Promise<number> {
  const nextAlternativeIds = Array.from(
    new Set(
      (exercise.alternativeExerciseIds || []).filter((id) => id !== exercise.id && allById.has(id))
    )
  );

  const previous = new Set(previousAlternativeIds);
  const next = new Set(nextAlternativeIds);
  const nowIso = new Date().toISOString();
  let alternativesUpdated = 0;

  for (const altId of next) {
    const alt = allById.get(altId);
    if (!alt) continue;

    const nextAltIds = Array.from(new Set([...(alt.alternativeExerciseIds || []), exercise.id])).filter(
      (id) => id !== alt.id
    );

    if (nextAltIds.length === (alt.alternativeExerciseIds || []).length) continue;

    const updated: ExerciseLibraryItem = {
      ...alt,
      alternativeExerciseIds: nextAltIds,
      updatedAt: nowIso,
    };
    await exercisesRepo.save(uid, updated);
    allById.set(updated.id, updated);
    alternativesUpdated += 1;
  }

  for (const removedAltId of previous) {
    if (next.has(removedAltId)) continue;
    const alt = allById.get(removedAltId);
    if (!alt) continue;

    const nextAltIds = (alt.alternativeExerciseIds || []).filter((id) => id !== exercise.id);
    if (nextAltIds.length === (alt.alternativeExerciseIds || []).length) continue;

    const updated: ExerciseLibraryItem = {
      ...alt,
      alternativeExerciseIds: nextAltIds,
      updatedAt: nowIso,
    };
    await exercisesRepo.save(uid, updated);
    allById.set(updated.id, updated);
    alternativesUpdated += 1;
  }

  const currentAlternativeIds = exercise.alternativeExerciseIds || [];
  const alternativesChanged =
    currentAlternativeIds.length !== nextAlternativeIds.length ||
    currentAlternativeIds.some((id) => !next.has(id));

  if (alternativesChanged) {
    const normalized: ExerciseLibraryItem = {
      ...exercise,
      alternativeExerciseIds: nextAlternativeIds,
      updatedAt: nowIso,
    };
    await exercisesRepo.save(uid, normalized);
    allById.set(normalized.id, normalized);
  }

  return alternativesUpdated;
}

export async function upsertExercise(uid: string, draft: ExerciseDraft): Promise<ExerciseLibraryItem> {
  const all = await exercisesRepo.getAll(uid);
  const allById = new Map(all.map((exercise) => [exercise.id, exercise]));
  const existing = draft.id ? allById.get(draft.id) || null : null;
  const nowIso = new Date().toISOString();

  const payload = buildExercisePayload(draft, existing, nowIso);
  const duplicate = all.find(
    (item) => item.normalizedName === payload.normalizedName && item.id !== payload.id
  );
  if (duplicate) {
    throw new Error(`Exercise "${payload.name}" already exists`);
  }

  const previousAlternativeIds = existing?.alternativeExerciseIds || [];

  const safeAlternativeIds = Array.from(
    new Set((payload.alternativeExerciseIds || []).filter((id) => id !== payload.id && allById.has(id)))
  );

  const normalizedPayload: ExerciseLibraryItem = {
    ...payload,
    alternativeExerciseIds: safeAlternativeIds,
  };

  await exercisesRepo.save(uid, normalizedPayload);
  allById.set(normalizedPayload.id, normalizedPayload);

  const alternativesUpdated = await persistAlternativeLinkUpdates(
    uid,
    normalizedPayload,
    allById,
    previousAlternativeIds
  );

  if (alternativesUpdated > 0) {
    const fresh = await exercisesRepo.getById(uid, normalizedPayload.id);
    if (fresh) return fresh;
  }

  return normalizedPayload;
}

function detachDeletedExerciseFromTemplate(
  template: WorkoutTemplate,
  deletedExercise: ExerciseLibraryItem
): WorkoutTemplate | null {
  let changed = false;

  const blocks = template.blocks.map((block) => {
    if (block.type !== 'gym' || block.exerciseId !== deletedExercise.id) return block;

    changed = true;
    return {
      ...block,
      exerciseId: null,
      exerciseName: block.exerciseName || deletedExercise.name,
      referenceVideoUrls:
        block.referenceVideoUrls && block.referenceVideoUrls.length > 0
          ? block.referenceVideoUrls
          : deletedExercise.referenceVideoUrls,
    };
  });

  if (!changed) return null;

  return {
    ...template,
    blocks,
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteExercise(uid: string, exerciseId: string): Promise<DeleteExerciseResult> {
  const [exercise, allExercises, templates] = await Promise.all([
    exercisesRepo.getById(uid, exerciseId),
    exercisesRepo.getAll(uid),
    workoutsRepo.getAll(uid),
  ]);

  if (!exercise) return { templatesUpdated: 0, alternativesUpdated: 0 };

  let alternativesUpdated = 0;
  const nowIso = new Date().toISOString();

  for (const item of allExercises) {
    if (item.id === exerciseId) continue;
    if (!item.alternativeExerciseIds.includes(exerciseId)) continue;

    const updated: ExerciseLibraryItem = {
      ...item,
      alternativeExerciseIds: item.alternativeExerciseIds.filter((id) => id !== exerciseId),
      updatedAt: nowIso,
    };
    await exercisesRepo.save(uid, updated);
    alternativesUpdated += 1;
  }

  let templatesUpdated = 0;
  for (const template of templates) {
    const detached = detachDeletedExerciseFromTemplate(template, exercise);
    if (!detached) continue;
    await workoutsRepo.save(uid, detached);
    templatesUpdated += 1;
  }

  await exercisesRepo.delete(uid, exerciseId);

  return { templatesUpdated, alternativesUpdated };
}

function getPreferredMovementTypeFromLegacy(templateNote: string | undefined): ExerciseMovementType {
  const note = (templateNote || '').toLowerCase();
  if (note.includes('single joint') || note.includes('isolation')) return 'isolation';
  return 'compound';
}

function buildExerciseFromLegacyBlock(
  id: string,
  name: string,
  notes: string | undefined,
  urls: string[] | undefined,
  nowIso: string
): ExerciseLibraryItem {
  const cleanName = normalizeWhitespace(name);
  return {
    id,
    name: cleanName,
    normalizedName: normalizeExerciseName(cleanName),
    coachingCues: normalizeWhitespace(notes || ''),
    referenceVideoUrls: dedupeUrls(urls || []),
    movementType: getPreferredMovementTypeFromLegacy(notes),
    primaryMuscleGroup: DEFAULT_PRIMARY_MUSCLE,
    targetMuscles: [],
    equipment: null,
    alternativeExerciseIds: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function ensureExerciseLibraryInitialized(uid: string): Promise<void> {
  const [templates, existingExercises] = await Promise.all([
    workoutsRepo.getAll(uid),
    exercisesRepo.getAll(uid),
  ]);

  const nowIso = new Date().toISOString();
  const byId = new Map(existingExercises.map((exercise) => [exercise.id, exercise]));
  const byNormalizedName = new Map(existingExercises.map((exercise) => [exercise.normalizedName, exercise]));

  const newExercises: ExerciseLibraryItem[] = [];

  for (const template of templates) {
    let changed = false;

    const blocks = template.blocks.map((block) => {
      if (block.type !== 'gym') return block;

      const snapshotName = normalizeWhitespace(block.exerciseName || '');

      if (block.exerciseId) {
        if (!byId.has(block.exerciseId)) {
          const fallbackName = snapshotName || `Exercise ${block.exerciseId.slice(0, 6)}`;
          const generated = buildExerciseFromLegacyBlock(
            block.exerciseId,
            fallbackName,
            block.notes,
            block.referenceVideoUrls,
            nowIso
          );
          byId.set(generated.id, generated);
          byNormalizedName.set(generated.normalizedName, generated);
          newExercises.push(generated);
        }
        return block;
      }

      if (!snapshotName) return block;

      const normalized = normalizeExerciseName(snapshotName);
      let selected = byNormalizedName.get(normalized) || null;

      if (!selected) {
        selected = buildExerciseFromLegacyBlock(Crypto.randomUUID(), snapshotName, block.notes, block.referenceVideoUrls, nowIso);
        byId.set(selected.id, selected);
        byNormalizedName.set(selected.normalizedName, selected);
        newExercises.push(selected);
      }

      changed = true;
      return {
        ...block,
        exerciseId: selected.id,
        exerciseName: block.exerciseName || selected.name,
      };
    });

    if (changed) {
      await workoutsRepo.save(uid, {
        ...template,
        blocks,
        updatedAt: nowIso,
      });
    }
  }

  for (const exercise of newExercises) {
    await exercisesRepo.save(uid, exercise);
  }

  const allExercises = await exercisesRepo.getAll(uid);
  const allById = new Map(allExercises.map((exercise) => [exercise.id, exercise]));
  const now = new Date().toISOString();

  for (const exercise of allExercises) {
    const cleaned = Array.from(
      new Set((exercise.alternativeExerciseIds || []).filter((id) => id !== exercise.id && allById.has(id)))
    );
    const changed =
      cleaned.length !== exercise.alternativeExerciseIds.length ||
      exercise.alternativeExerciseIds.some((id) => !cleaned.includes(id));

    if (changed) {
      const updated = {
        ...exercise,
        alternativeExerciseIds: cleaned,
        updatedAt: now,
      };
      await exercisesRepo.save(uid, updated);
      allById.set(updated.id, updated);
    }
  }

  const refreshed = await exercisesRepo.getAll(uid);
  const refreshedById = new Map(refreshed.map((exercise) => [exercise.id, exercise]));

  for (const exercise of refreshed) {
    for (const altId of exercise.alternativeExerciseIds) {
      const alt = refreshedById.get(altId);
      if (!alt) continue;
      if (alt.alternativeExerciseIds.includes(exercise.id)) continue;

      const updatedAlt = {
        ...alt,
        alternativeExerciseIds: [...alt.alternativeExerciseIds, exercise.id],
        updatedAt: now,
      };
      await exercisesRepo.save(uid, updatedAlt);
      refreshedById.set(updatedAlt.id, updatedAlt);
    }
  }

  await AsyncStorage.setItem(BOOTSTRAP_KEY(uid), '1');
}

export function groupExercisesByPrimaryMuscle(exercises: ExerciseLibraryItem[]): {
  title: string;
  data: ExerciseLibraryItem[];
}[] {
  const byGroup = new Map<string, ExerciseLibraryItem[]>();

  for (const exercise of exercises) {
    const group = normalizeMuscleGroup(exercise.primaryMuscleGroup);
    const current = byGroup.get(group) || [];
    current.push(exercise);
    byGroup.set(group, current);
  }

  return Array.from(byGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({
      title,
      data: [...data].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function formatExerciseMeta(exercise: ExerciseLibraryItem): string {
  const parts = [exercise.movementType, exercise.primaryMuscleGroup];
  if (exercise.equipment) parts.push(exercise.equipment);
  return parts.join(' • ');
}
