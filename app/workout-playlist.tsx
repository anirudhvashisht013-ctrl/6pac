import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFeedbackToast } from '@/context/FeedbackToastContext';
import { exercisesRepo, sessionsRepo, workoutsRepo } from '@/lib/storage';
import {
  getWorkoutSessionDisplayName,
  getWorkoutSessionSnapshotBoundary,
} from '@/lib/adapters/workoutSessionSnapshotAdapter';
import { upsertExercise, type ExerciseDraft } from '@/lib/exercises/libraryService';
import ExercisePickerModal from '@/components/ExercisePickerModal';
import ExerciseFormModal from '@/components/ExerciseFormModal';
import type {
  BlockPerformance,
  ExerciseLibraryItem,
  WorkoutBlock,
  WorkoutTemplate,
  WorkoutSession,
} from '@/lib/types';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function WorkoutPlaylistScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast, showUndoToast } = useFeedbackToast();
  const { sessionId, currentBlockIdx } = useLocalSearchParams<{ sessionId: string; currentBlockIdx?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [exerciseById, setExerciseById] = useState<Map<string, ExerciseLibraryItem>>(new Map());
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [draftPerformances, setDraftPerformances] = useState<BlockPerformance[]>([]);
  const [draftSessionBlocks, setDraftSessionBlocks] = useState<WorkoutBlock[]>([]);

  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showExerciseSourceModal, setShowExerciseSourceModal] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showExerciseCreateModal, setShowExerciseCreateModal] = useState(false);
  const [exerciseCreateInitial, setExerciseCreateInitial] = useState<ExerciseDraft | undefined>(undefined);
  const [editingSetsBlockId, setEditingSetsBlockId] = useState<string | null>(null);

  const sessionSnapshot = useMemo(
    () =>
      session
        ? getWorkoutSessionSnapshotBoundary(session, {
            workoutTemplateId: template?.id ?? session.workoutTemplateId ?? null,
            workoutName: template?.name ?? null,
            blocks: template?.blocks ?? null,
          })
        : null,
    [session, template]
  );

  const sessionDisplayName = useMemo(
    () =>
      session
        ? getWorkoutSessionDisplayName(session, {
            workoutTemplateId: template?.id ?? session.workoutTemplateId ?? null,
            workoutName: template?.name ?? null,
            blocks: template?.blocks ?? null,
          })
        : "Workout",
    [session, template]
  );

  useEffect(() => {
    (async () => {
      if (!user || !sessionId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const [loadedSession, exercises] = await Promise.all([
        sessionsRepo.getById(user.id, sessionId),
        exercisesRepo.getAll(user.id),
      ]);

      if (!loadedSession) {
        setLoading(false);
        router.back();
        return;
      }

      const loadedTemplate = loadedSession.workoutTemplateId
        ? await workoutsRepo.getById(user.id, loadedSession.workoutTemplateId)
        : null;
      if (!loadedTemplate) {
        setLoading(false);
        router.back();
        return;
      }

      const sessionSnapshotBoundary = getWorkoutSessionSnapshotBoundary(loadedSession, {
        workoutTemplateId: loadedTemplate.id,
        workoutName: loadedTemplate.name,
        blocks: loadedTemplate.blocks,
      });

      const parsedIdx = Number.parseInt(currentBlockIdx || '', 10);
      const firstIncomplete = loadedSession.blockPerformances.findIndex((item) => !item.completed);
      const fallbackIdx = firstIncomplete >= 0
        ? firstIncomplete
        : Math.max(0, loadedSession.blockPerformances.length - 1);
      const resolvedIdx = Number.isFinite(parsedIdx)
        ? clamp(parsedIdx, 0, Math.max(0, loadedSession.blockPerformances.length - 1))
        : fallbackIdx;

      const sortedExercises = exercises.sort((a, b) => a.name.localeCompare(b.name));

      setSession(loadedSession);
      setTemplate(loadedTemplate);
      setDraftPerformances(loadedSession.blockPerformances);
      setDraftSessionBlocks(sessionSnapshotBoundary.sessionBlocks || []);
      setActiveBlockIdx(resolvedIdx);
      setExerciseLibrary(sortedExercises);
      setExerciseById(new Map(sortedExercises.map((exercise) => [exercise.id, exercise])));
      setLoading(false);
    })();
  }, [user, sessionId, currentBlockIdx]);

  const blocksById = useMemo(
    () => new Map(draftSessionBlocks.map((block) => [block.id, block] as const)),
    [draftSessionBlocks]
  );

  const rows = useMemo(() => {
    return draftPerformances
      .map((performance, idx) => {
        const block = blocksById.get(performance.blockId);
        return block ? { performance, block, idx } : null;
      })
      .filter((row): row is { performance: BlockPerformance; block: WorkoutBlock; idx: number } => !!row);
  }, [draftPerformances, blocksById]);

  const originalSessionBlockIds = useMemo(
    () => (session?.sessionBlocks || template?.blocks || []).map((block) => block.id),
    [session?.sessionBlocks, template?.blocks]
  );

  const hasChanges = useMemo(() => {
    if (!session) return false;

    const perfChanged =
      session.blockPerformances.length !== draftPerformances.length ||
      draftPerformances.some((item, idx) => item.blockId !== session.blockPerformances[idx]?.blockId);

    const blocksChanged =
      originalSessionBlockIds.length !== draftSessionBlocks.length ||
      draftSessionBlocks.some((block, idx) => block.id !== originalSessionBlockIds[idx]);

    return perfChanged || blocksChanged;
  }, [session, draftPerformances, originalSessionBlockIds, draftSessionBlocks]);

  const isLocked = useCallback(
    (idx: number) => idx <= activeBlockIdx || !!draftPerformances[idx]?.completed,
    [activeBlockIdx, draftPerformances]
  );

  const canMove = useCallback(
    (idx: number, dir: -1 | 1) => {
      const target = idx + dir;
      if (target < 0 || target >= draftPerformances.length) return false;
      return !isLocked(idx) && !isLocked(target);
    },
    [draftPerformances.length, isLocked]
  );

  const moveRow = useCallback((idx: number, dir: -1 | 1) => {
    if (!canMove(idx, dir)) return;
    const target = idx + dir;
    setDraftPerformances((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [canMove]);

  const removeRow = useCallback((idx: number) => {
    if (isLocked(idx)) return;

    const removedPerformance = draftPerformances[idx];
    if (!removedPerformance) return;
    const removedBlock = draftSessionBlocks.find((block) => block.id === removedPerformance.blockId);
    if (!removedBlock) return;

    setDraftPerformances((prev) => prev.filter((_, i) => i !== idx));
    setDraftSessionBlocks((prev) => prev.filter((block) => block.id !== removedBlock.id));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showUndoToast({
      message: 'Block removed',
      durationMs: 10000,
      onUndo: () => {
        setDraftPerformances((prev) => {
          if (prev.some((item) => item.blockId === removedPerformance.blockId)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(idx, 0), next.length), 0, removedPerformance);
          return next;
        });
        setDraftSessionBlocks((prev) => {
          if (prev.some((item) => item.id === removedBlock.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(idx, 0), next.length), 0, removedBlock);
          return next;
        });
      },
      onCommit: () => undefined,
    });
  }, [isLocked, draftPerformances, draftSessionBlocks, showUndoToast]);

  const updateSetsForBlock = useCallback((
    blockId: string,
    updater: (current: NonNullable<BlockPerformance['sets']>) => NonNullable<BlockPerformance['sets']>
  ) => {
    setDraftPerformances((prev) => prev.map((performance) => {
      if (performance.blockId !== blockId) return performance;
      const currentSets = performance.sets && performance.sets.length > 0
        ? performance.sets
        : [{ weight: null, reps: null, completed: false }];
      return {
        ...performance,
        sets: updater([...currentSets]),
      };
    }));
  }, []);

  const updateEditingSets = useCallback((updater: (current: NonNullable<BlockPerformance['sets']>) => NonNullable<BlockPerformance['sets']>) => {
    if (!editingSetsBlockId) return;
    updateSetsForBlock(editingSetsBlockId, updater);
  }, [editingSetsBlockId, updateSetsForBlock]);

  const removeSetWithUndo = useCallback((setIdx: number) => {
    if (!editingSetsBlockId) return;

    const perf = draftPerformances.find((item) => item.blockId === editingSetsBlockId) || null;
    const currentSets = perf?.sets && perf.sets.length > 0
      ? perf.sets
      : [{ weight: null, reps: null, completed: false }];
    const removedSet = currentSets[setIdx];
    if (!removedSet) return;

    const blockId = editingSetsBlockId;
    updateSetsForBlock(blockId, (current) => {
      if (current.length <= 1) return [{ weight: null, reps: null, completed: false }];
      return current.filter((_, idx) => idx !== setIdx);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    showUndoToast({
      message: 'Set removed',
      durationMs: 10000,
      onUndo: () => {
        updateSetsForBlock(blockId, (current) => {
          const next = [...current];
          next.splice(Math.min(Math.max(setIdx, 0), next.length), 0, removedSet);
          return next;
        });
      },
      onCommit: () => undefined,
    });
  }, [editingSetsBlockId, draftPerformances, showUndoToast, updateSetsForBlock]);

  const appendBlock = useCallback((block: WorkoutBlock, performance: BlockPerformance) => {
    setDraftSessionBlocks((prev) => [...prev, block]);
    setDraftPerformances((prev) => [...prev, performance]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const addExerciseBlock = useCallback((exercise: ExerciseLibraryItem) => {
    const blockId = Crypto.randomUUID();

    appendBlock(
      {
        id: blockId,
        type: 'gym',
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        referenceVideoUrls: exercise.referenceVideoUrls,
        notes: '',
      },
      {
        blockId,
        completed: false,
        sets: [{ weight: null, reps: null, completed: false }],
      }
    );
  }, [appendBlock]);

  const addCardioBlock = () => {
    const blockId = Crypto.randomUUID();

    appendBlock(
      {
        id: blockId,
        type: 'cardio',
        cardioName: 'Cardio',
        minutes: 20,
        notes: '',
      },
      {
        blockId,
        completed: false,
        minutesCompleted: 0,
      }
    );

    setShowAddTypeModal(false);
  };

  const addRestBlock = () => {
    const blockId = Crypto.randomUUID();

    appendBlock(
      {
        id: blockId,
        type: 'rest',
        label: 'Rest',
        seconds: 60,
      },
      {
        blockId,
        completed: false,
      }
    );

    setShowAddTypeModal(false);
  };

  const openExercisePicker = () => {
    setShowAddTypeModal(false);
    setShowExerciseSourceModal(false);
    setShowExercisePicker(true);
  };

  const launchQuickCreateExercise = (nameFromSearch: string) => {
    setShowExercisePicker(false);
    setShowExerciseSourceModal(false);
    setExerciseCreateInitial({ name: nameFromSearch || '' });
    setShowExerciseCreateModal(true);
  };

  const saveQuickCreatedExercise = async (draft: ExerciseDraft) => {
    if (!user) return;

    const savedExercise = await upsertExercise(user.id, draft);
    const refreshed = (await exercisesRepo.getAll(user.id)).sort((a, b) => a.name.localeCompare(b.name));

    setExerciseLibrary(refreshed);
    setExerciseById(new Map(refreshed.map((exercise) => [exercise.id, exercise])));

    addExerciseBlock(savedExercise);
  };

  const saveReorder = async () => {
    if (!user || !session) return;
    setSaving(true);

    try {
      const updated: WorkoutSession = {
        ...session,
        sessionBlocks: draftSessionBlocks,
        blockPerformances: draftPerformances,
      };

      await sessionsRepo.save(user.id, updated);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast({ message: 'Workout playlist saved', tone: 'success' });
      router.back();
    } catch (error) {
      showToast({ message: 'Unable to save playlist changes. Please try again.', tone: 'error' });
      console.warn('save workout playlist failed', error);
    } finally {
      setSaving(false);
    }
  };

  const getGymName = (block: WorkoutBlock, perf: BlockPerformance) => {
    if (block.type !== 'gym') return '';
    const activeExerciseId = perf.exerciseIdOverride || block.exerciseId || null;
    return (activeExerciseId ? exerciseById.get(activeExerciseId)?.name : null) || block.exerciseName || 'Exercise';
  };

  const editingSetsPerf = useMemo(() => {
    if (!editingSetsBlockId) return null;
    return draftPerformances.find((performance) => performance.blockId === editingSetsBlockId) || null;
  }, [editingSetsBlockId, draftPerformances]);

  const editingSetsBlock = useMemo(() => {
    if (!editingSetsBlockId) return null;
    return draftSessionBlocks.find((block) => block.id === editingSetsBlockId) || null;
  }, [editingSetsBlockId, draftSessionBlocks]);

  const currentWorkoutExercises = useMemo(() => {
    const ids = Array.from(
      new Set(
        draftSessionBlocks
          .filter((block) => block.type === 'gym' && !!block.exerciseId)
          .map((block) => block.exerciseId as string)
      )
    );

    return ids
      .map((id) => exerciseById.get(id))
      .filter((exercise): exercise is ExerciseLibraryItem => !!exercise)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [draftSessionBlocks, exerciseById]);

  if (loading) {
    return (
      <View style={[styles.centerFlex, { backgroundColor: C.bg }]}> 
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (!session || !template) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Workout Playlist</Text>
          <Text style={styles.headerSubtitle}>{sessionDisplayName}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            (!hasChanges || saving) && styles.saveBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={saveReorder}
          disabled={!hasChanges || saving}
        >
          {saving ? <ActivityIndicator size="small" color={C.bg} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.helperCard}>
          <Text style={styles.helperTitle}>Reorder upcoming blocks</Text>
          <Text style={styles.helperText}>
            Completed and current blocks are locked. Only upcoming blocks can move.
          </Text>
        </View>

        {rows.map(({ block, performance, idx }) => {
          const completed = !!performance.completed;
          const current = idx === activeBlockIdx;
          const locked = isLocked(idx);
          const isGym = block.type === 'gym';

          const title =
            isGym
              ? getGymName(block, performance)
              : block.type === 'cardio'
                ? block.cardioName || 'Cardio'
                : block.label || 'Rest';

          const subtitle =
            block.type === 'gym'
              ? 'Exercise'
              : block.type === 'cardio'
                ? `Cardio · ${block.minutes || 0} min`
                : `Rest · ${block.seconds || 60}s`;

          return (
            <View
              key={`${performance.blockId}-${idx}`}
              style={[
                styles.rowCard,
                current && styles.rowCardCurrent,
                completed && styles.rowCardCompleted,
              ]}
            >
              <View style={styles.rowLeft}>
                <View style={styles.statusIcon}>
                  {completed ? (
                    <Ionicons name="checkmark-circle" size={20} color={C.success} />
                  ) : current ? (
                    <Ionicons name="play-circle" size={20} color={C.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={18} color={C.borderLight} />
                  )}
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, completed && styles.rowTitleDone]}>{title}</Text>
                  <Text style={styles.rowSubtitle}>
                    {current ? 'Now playing' : subtitle}
                  </Text>
                </View>
              </View>

              <View style={styles.rowControls}>
                {isGym && (
                  <Pressable
                    style={({ pressed }) => [styles.rowActionBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => setEditingSetsBlockId(block.id)}
                  >
                    <Ionicons name="create-outline" size={15} color={C.primary} />
                  </Pressable>
                )}

                {locked ? (
                  <View style={styles.lockedPill}>
                    <Ionicons name="lock-closed-outline" size={12} color={C.textMuted} />
                    <Text style={styles.lockedPillText}>Locked</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.moveButtons}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.moveBtn,
                          !canMove(idx, -1) && styles.moveBtnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => moveRow(idx, -1)}
                        disabled={!canMove(idx, -1)}
                      >
                        <Ionicons name="chevron-up" size={16} color={canMove(idx, -1) ? C.textSecondary : C.borderLight} />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.moveBtn,
                          !canMove(idx, 1) && styles.moveBtnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => moveRow(idx, 1)}
                        disabled={!canMove(idx, 1)}
                      >
                        <Ionicons name="chevron-down" size={16} color={canMove(idx, 1) ? C.textSecondary : C.borderLight} />
                      </Pressable>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.deleteRowBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => removeRow(idx)}
                    >
                      <Ionicons name="trash-outline" size={15} color={C.error} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.addBlockBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setShowAddTypeModal(true)}
        >
          <Ionicons name="add" size={18} color={C.primary} />
          <Text style={styles.addBlockBtnText}>Add New Block</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showAddTypeModal} transparent animationType="fade" onRequestClose={() => setShowAddTypeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddTypeModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Block Type</Text>

            <Pressable style={styles.modalOption} onPress={() => {
              setShowAddTypeModal(false);
              setShowExerciseSourceModal(true);
            }}>
              <MaterialCommunityIcons name="dumbbell" size={18} color={C.primary} />
              <Text style={styles.modalOptionText}>Exercise</Text>
            </Pressable>

            <Pressable style={styles.modalOption} onPress={addCardioBlock}>
              <Ionicons name="bicycle-outline" size={18} color={C.secondary} />
              <Text style={styles.modalOptionText}>Cardio</Text>
            </Pressable>

            <Pressable style={styles.modalOption} onPress={addRestBlock}>
              <Ionicons name="timer-outline" size={18} color={C.textSecondary} />
              <Text style={styles.modalOptionText}>Rest</Text>
            </Pressable>

            <Pressable style={styles.modalCancelBtn} onPress={() => setShowAddTypeModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showExerciseSourceModal} transparent animationType="fade" onRequestClose={() => setShowExerciseSourceModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowExerciseSourceModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Exercise Block</Text>
            <Text style={styles.modalSubtitle}>From current workout, exercise library, or create new.</Text>

            {currentWorkoutExercises.length > 0 && (
              <View style={styles.quickExercisesWrap}>
                <Text style={styles.quickExercisesLabel}>Current workout exercises</Text>
                <View style={styles.quickExercisesGrid}>
                  {currentWorkoutExercises.map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      style={styles.quickExerciseBtn}
                      onPress={() => {
                        addExerciseBlock(exercise);
                        setShowExerciseSourceModal(false);
                      }}
                    >
                      <Text style={styles.quickExerciseText} numberOfLines={1}>{exercise.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Pressable style={styles.modalOption} onPress={openExercisePicker}>
              <Ionicons name="search" size={18} color={C.primary} />
              <Text style={styles.modalOptionText}>Browse All Exercises</Text>
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setShowExerciseSourceModal(false);
                setExerciseCreateInitial({ name: '' });
                setShowExerciseCreateModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={C.primary} />
              <Text style={styles.modalOptionText}>Create New Exercise</Text>
            </Pressable>

            <Pressable style={styles.modalCancelBtn} onPress={() => setShowExerciseSourceModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ExercisePickerModal
        visible={showExercisePicker}
        exercises={exerciseLibrary}
        onSelect={(exercise) => {
          addExerciseBlock(exercise);
          setShowExercisePicker(false);
        }}
        onClose={() => setShowExercisePicker(false)}
        onCreateFromQuery={launchQuickCreateExercise}
      />

      <ExerciseFormModal
        visible={showExerciseCreateModal}
        title="Create Exercise"
        initialValue={exerciseCreateInitial}
        existingExercises={exerciseLibrary}
        onClose={() => setShowExerciseCreateModal(false)}
        onSave={saveQuickCreatedExercise}
      />

      <Modal
        visible={!!editingSetsBlockId}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingSetsBlockId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editSetsCard}>
            <View style={styles.editSetsHeader}>
              <Text style={styles.modalTitle}>Edit Logged Sets</Text>
              <Pressable style={styles.closeBtn} onPress={() => setEditingSetsBlockId(null)}>
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              {editingSetsBlock && editingSetsPerf
                ? getGymName(editingSetsBlock, editingSetsPerf)
                : 'Exercise'}
            </Text>

            <ScrollView
              style={styles.editSetsList}
              contentContainerStyle={styles.editSetsListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(editingSetsPerf?.sets && editingSetsPerf.sets.length > 0
                ? editingSetsPerf.sets
                : [{ weight: null, reps: null, completed: false }]).map((set, setIdx) => (
                <View key={setIdx} style={styles.editSetRow}>
                  <Text style={styles.editSetNum}>Set {setIdx + 1}</Text>
                  <View style={styles.editSetInputs}>
                    <TextInput
                      style={styles.editSetInput}
                      value={set.weight != null ? String(set.weight) : ''}
                      onChangeText={(value) => {
                        updateEditingSets((current) => {
                          current[setIdx] = {
                            ...current[setIdx],
                            weight: value.trim() ? parseFloat(value) || null : null,
                          };
                          return current;
                        });
                      }}
                      placeholder="Weight"
                      placeholderTextColor={C.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={styles.editSetInput}
                      value={set.reps != null ? String(set.reps) : ''}
                      onChangeText={(value) => {
                        updateEditingSets((current) => {
                          current[setIdx] = {
                            ...current[setIdx],
                            reps: value.trim() ? parseInt(value, 10) || null : null,
                          };
                          return current;
                        });
                      }}
                      placeholder="Reps"
                      placeholderTextColor={C.textMuted}
                      keyboardType="numeric"
                    />
                    <Pressable
                      style={styles.removeSetBtn}
                      onPress={() => removeSetWithUndo(setIdx)}
                    >
                      <Ionicons name="trash-outline" size={15} color={C.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.addSetBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                updateEditingSets((current) => [
                  ...current,
                  { weight: null, reps: null, completed: false },
                ]);
              }}
            >
              <Ionicons name="add" size={16} color={C.primary} />
              <Text style={styles.addSetBtnText}>Add Set</Text>
            </Pressable>

            <Pressable
              style={styles.modalSaveBtn}
              onPress={() => setEditingSetsBlockId(null)}
            >
              <Text style={styles.modalSaveBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  headerSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  saveBtn: {
    minWidth: 64,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  helperCard: {
    borderRadius: 12,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 4,
    marginBottom: 4,
  },
  helperTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.textSecondary },
  helperText: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  rowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowCardCurrent: { borderColor: C.primary + '80', backgroundColor: C.primaryBg },
  rowCardCompleted: { opacity: 0.85 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface3,
  },
  rowTextWrap: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.text },
  rowTitleDone: { textDecorationLine: 'line-through', color: C.textMuted },
  rowSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  rowControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  rowActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  lockedPillText: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: C.textMuted },
  moveButtons: { flexDirection: 'row', gap: 6 },
  moveBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface3,
  },
  moveBtnDisabled: { opacity: 0.45 },
  deleteRowBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.error + '55',
    backgroundColor: C.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBlockBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  addBlockBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    gap: 10,
    maxHeight: '86%',
  },
  modalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  modalSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  modalOptionText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary },
  modalCancelBtn: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: C.surface2,
  },
  modalCancelText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.textSecondary },
  quickExercisesWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    padding: 10,
    gap: 8,
  },
  quickExercisesLabel: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted },
  quickExercisesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickExerciseBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  quickExerciseText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.primary },
  editSetsCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '88%',
    gap: 10,
  },
  editSetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editSetsList: {
    maxHeight: 320,
  },
  editSetsListContent: {
    gap: 8,
    paddingVertical: 2,
  },
  editSetRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    padding: 10,
    gap: 8,
  },
  editSetNum: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  editSetInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editSetInput: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    paddingHorizontal: 10,
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: C.text,
    textAlign: 'center',
  },
  removeSetBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.error + '55',
    backgroundColor: C.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addSetBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.primary },
  modalSaveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.bg },
});
