// app/player.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { MAX_REFERENCE_VIDEO_URLS } from '@/lib/exercises/constants';
import { todayYMD } from '@/lib/dates';
import { exercisesRepo, sessionsRepo, workoutsRepo } from '@/lib/storage';
import { confirm } from '@/lib/ui/confirm';
import type { ExerciseLibraryItem, WorkoutSession, WorkoutTemplate, GymSet } from '@/lib/types';
import {
  fetchWorkoutQuotesFromInternet,
  getFallbackWorkoutQuotes,
  pickRandomWorkoutQuote,
  type WorkoutQuote,
} from '@/lib/workouts/quotes';

import ReferenceVideosSection from '@/components/ReferenceVideosSection';
import { fetchYouTubeMeta, type ReferenceVideoMeta } from '@/lib/youtube';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [exercisesById, setExercisesById] = useState<Map<string, ExerciseLibraryItem>>(new Map());

  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);

  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const restTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [videoMetaMap, setVideoMetaMap] = useState<Record<string, ReferenceVideoMeta | undefined>>({});
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [completionQuote, setCompletionQuote] = useState<WorkoutQuote>(() =>
    pickRandomWorkoutQuote(getFallbackWorkoutQuotes())
  );

  const navigateToWorkouts = useCallback(() => {
    router.replace('/(tabs)/workouts');
  }, []);

  const loadSessionState = useCallback(async () => {
    if (!user || !sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const s = await sessionsRepo.getById(user.id, sessionId);
    if (!s) {
      setLoading(false);
      navigateToWorkouts();
      return;
    }

    const firstIncompleteIdx = s.blockPerformances.findIndex((item) => !item.completed);
    const resumeIdx =
      firstIncompleteIdx >= 0
        ? firstIncompleteIdx
        : Math.max(0, s.blockPerformances.length - 1);

    setCurrentBlockIdx(resumeIdx);
    setFinished(!!s.completed);
    setSession(s);

    const t = await workoutsRepo.getById(user.id, s.workoutTemplateId);
    setTemplate(t);

    const exercises = await exercisesRepo.getAll(user.id);
    setExercisesById(new Map(exercises.map((exercise) => [exercise.id, exercise])));

    setLoading(false);
  }, [user, sessionId, navigateToWorkouts]);

  useFocusEffect(
    useCallback(() => {
      void loadSessionState();
    }, [loadSessionState])
  );

  const saveSession = useCallback(async (
    updates: Partial<WorkoutSession>,
    opts?: { syncToCloud?: boolean }
  ) => {
    if (!user || !session) return;
    const updated = { ...session, ...updates };
    await sessionsRepo.save(user.id, updated, opts);
    setSession(updated);
    return updated;
  }, [user, session]);

  const effectiveSessionBlocks = useMemo(
    () => session?.sessionBlocks || template?.blocks || [],
    [session?.sessionBlocks, template?.blocks]
  );

  const blocksById = useMemo(
    () => new Map(effectiveSessionBlocks.map((item) => [item.id, item] as const)),
    [effectiveSessionBlocks]
  );

  const orderedBlocks = useMemo(() => {
    if (!session || !template) return [];
    return session.blockPerformances
      .map((performance) => blocksById.get(performance.blockId))
      .filter((item): item is WorkoutTemplate['blocks'][number] => !!item);
  }, [session, blocksById]);

  useEffect(() => {
    if (orderedBlocks.length === 0) return;
    setCurrentBlockIdx((prev) => Math.min(prev, orderedBlocks.length - 1));
  }, [orderedBlocks.length]);

  const updateBlockPerformance = useCallback(async (
    blockId: string,
    perf: Partial<{ completed: boolean; exerciseIdOverride: string | null; sets: GymSet[]; minutesCompleted: number }>
  ) => {
    if (!session) return;
    const newPerfs = session.blockPerformances.map(p => (p.blockId === blockId ? { ...p, ...perf } : p));
    await saveSession({ blockPerformances: newPerfs });
  }, [session, saveSession]);

  const updateSet = async (blockId: string, setIdx: number, updates: Partial<GymSet>) => {
    if (!session) return;
    const perf = session.blockPerformances.find(p => p.blockId === blockId);
    if (!perf?.sets) return;

    const newSets = perf.sets.map((s, i) => (i === setIdx ? { ...s, ...updates } : s));
    await updateBlockPerformance(blockId, { sets: newSets });
  };

  const addSet = async (blockId: string) => {
    if (!session) return;
    const perf = session.blockPerformances.find(p => p.blockId === blockId);
    const current = perf?.sets || [];
    await updateBlockPerformance(blockId, {
      sets: [...current, { weight: null, reps: null, completed: false }],
    });
  };

  const removeSet = async (blockId: string, setIdx: number) => {
    if (!session) return;
    const perf = session.blockPerformances.find(p => p.blockId === blockId);
    const current = perf?.sets || [];
    if (current.length <= 1) {
      await updateBlockPerformance(blockId, {
        sets: [{ weight: null, reps: null, completed: false }],
      });
      return;
    }
    await updateBlockPerformance(blockId, {
      sets: current.filter((_, idx) => idx !== setIdx),
    });
  };

  const endWorkout = async () => {
    await saveSession(
      { endedAt: new Date().toISOString(), completed: true, missed: false },
      { syncToCloud: true }
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFinished(true);
  };

  const confirmAndEndWorkout = async () => {
    const ok = await confirm({
      title: 'End workout now?',
      message: 'This will finish your workout and save your current progress.',
      okText: 'End Workout',
      cancelText: 'Keep Training',
      destructive: true,
    });
    if (!ok) return;
    await endWorkout();
  };

  // Auto-advance to next block (used when rest ends)
  const handleAutoAdvance = useCallback(() => {
    if (orderedBlocks.length === 0) return;

    setCurrentBlockIdx(prev => {
      const next = prev + 1;
      if (next < orderedBlocks.length) return next;
      return prev;
    });
  }, [orderedBlocks.length]);

  // Rest timer lifecycle: whenever current block becomes "rest", start timer for that block.seconds.
  useEffect(() => {
    if (orderedBlocks.length === 0) return;

    const block = orderedBlocks[currentBlockIdx];
    if (!block || block.type !== 'rest') {
      if (restTimer.current) clearInterval(restTimer.current);
      restTimer.current = null;
      setRestTimeLeft(0);
      return;
    }

    const initial = block.seconds || 60;
    setRestTimeLeft(initial);

    if (restTimer.current) clearInterval(restTimer.current);
    restTimer.current = setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          if (restTimer.current) clearInterval(restTimer.current);
          restTimer.current = null;

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          handleAutoAdvance();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restTimer.current) clearInterval(restTimer.current);
      restTimer.current = null;
    };
  }, [orderedBlocks, currentBlockIdx, handleAutoAdvance]);

  const skipRest = () => {
    if (restTimer.current) clearInterval(restTimer.current);
    restTimer.current = null;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    handleAutoAdvance();
  };

  const completeBlock = async () => {
    if (!session || orderedBlocks.length === 0) return;

    const block = orderedBlocks[currentBlockIdx];
    await updateBlockPerformance(block.id, { completed: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const nextIdx = currentBlockIdx + 1;
    if (nextIdx >= orderedBlocks.length) {
      await endWorkout();
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentBlockIdx(nextIdx);
  };

  const closeVideo = () => setActiveVideoUrl(null);
  const handlePlay = (url: string) => setActiveVideoUrl(url);

  useEffect(() => {
    if (!session || session.completed || session.endedAt) return;

    const checkForDayEnd = async () => {
      const today = todayYMD();
      if (session.date >= today) return;
      await saveSession(
        { endedAt: new Date().toISOString(), missed: true, completed: false },
        { syncToCloud: true }
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      navigateToWorkouts();
    };

    const timer = setInterval(() => {
      void checkForDayEnd();
    }, 60 * 1000);

    void checkForDayEnd();

    return () => clearInterval(timer);
  }, [session, saveSession, navigateToWorkouts]);

  const ensureMetaLoaded = useCallback(
    async (urls: string[]) => {
      const unique = Array.from(new Set(urls.filter(Boolean))).slice(0, MAX_REFERENCE_VIDEO_URLS);
      const missing = unique.filter(u => !videoMetaMap[u]);

      if (missing.length === 0) return;

      const results = await Promise.all(missing.map(u => fetchYouTubeMeta(u)));
      setVideoMetaMap(prev => {
        const next = { ...prev };
        missing.forEach((u, i) => {
          next[u] = results[i] ?? prev[u];
        });
        return next;
      });
    },
    [videoMetaMap]
  );

  const getPerformanceForBlock = useCallback(
    (blockId: string) => session?.blockPerformances.find((p) => p.blockId === blockId) || null,
    [session]
  );

  const getActiveExerciseIdForBlock = useCallback(
    (block: WorkoutTemplate['blocks'][number] | undefined) => {
      if (!block || block.type !== 'gym') return null;
      const perf = getPerformanceForBlock(block.id);
      return perf?.exerciseIdOverride || block.exerciseId || null;
    },
    [getPerformanceForBlock]
  );

  const getLibraryExerciseForBlock = useCallback(
    (block: WorkoutTemplate['blocks'][number] | undefined) => {
      const activeId = getActiveExerciseIdForBlock(block);
      if (!activeId) return null;
      return exercisesById.get(activeId) || null;
    },
    [exercisesById, getActiveExerciseIdForBlock]
  );

  const getGymBlockName = useCallback(
    (block: WorkoutTemplate['blocks'][number] | undefined) => {
      if (!block || block.type !== 'gym') return '';
      const fromLibrary = getLibraryExerciseForBlock(block)?.name;
      return fromLibrary || block.exerciseName || 'Exercise';
    },
    [getLibraryExerciseForBlock]
  );

  const switchExerciseForBlock = async (blockId: string, nextExerciseId: string | null, baseExerciseId?: string | null) => {
    const nextOverride =
      nextExerciseId && baseExerciseId && nextExerciseId !== baseExerciseId
        ? nextExerciseId
        : null;
    await updateBlockPerformance(blockId, { exerciseIdOverride: nextOverride });
  };

  const openPlaylist = useCallback(() => {
    if (!session) return;
    router.push({
      pathname: '/workout-playlist',
      params: {
        sessionId: session.id,
        currentBlockIdx: String(currentBlockIdx),
      },
    });
  }, [session, currentBlockIdx]);

  /**
   * IMPORTANT FIX:
   * These derived values + this effect MUST live ABOVE any early returns.
   * Otherwise hooks order changes between renders and React crashes.
   */
  const derived = useMemo(() => {
    const b = orderedBlocks[currentBlockIdx];
    const nb = orderedBlocks[currentBlockIdx + 1];
    const currentExercise = getLibraryExerciseForBlock(b);
    const nextExercise = getLibraryExerciseForBlock(nb);

    const currentExerciseUrls =
      b?.type === 'gym'
        ? ((currentExercise?.referenceVideoUrls?.length ? currentExercise.referenceVideoUrls : b.referenceVideoUrls) || []).slice(0, MAX_REFERENCE_VIDEO_URLS)
        : [];
    const nextExerciseUrls =
      nb?.type === 'gym'
        ? ((nextExercise?.referenceVideoUrls?.length ? nextExercise.referenceVideoUrls : nb.referenceVideoUrls) || []).slice(0, MAX_REFERENCE_VIDEO_URLS)
        : [];

    return { block: b, nextBlock: nb, currentExerciseUrls, nextExerciseUrls };
  }, [orderedBlocks, currentBlockIdx, getLibraryExerciseForBlock]);

  useEffect(() => {
    if (!template) return;

    if (derived.block?.type === 'gym') ensureMetaLoaded(derived.currentExerciseUrls);
    if (derived.block?.type === 'rest') ensureMetaLoaded(derived.nextExerciseUrls);
  }, [
    template,
    derived.block?.type,
    derived.currentExerciseUrls,
    derived.nextExerciseUrls,
    ensureMetaLoaded,
  ]);

  useEffect(() => {
    if (!session || !derived.block || derived.block.type !== 'gym') return;
    const perf = session.blockPerformances.find((p) => p.blockId === derived.block?.id);
    if (perf?.sets && perf.sets.length > 0) return;
    void updateBlockPerformance(derived.block.id, {
      sets: [{ weight: null, reps: null, completed: false }],
    });
  }, [session, derived.block, updateBlockPerformance]);

  useEffect(() => {
    if (!finished) return;

    const seed = session?.id || `${Date.now()}`;
    setCompletionQuote(pickRandomWorkoutQuote(getFallbackWorkoutQuotes(), seed));

    let active = true;
    void fetchWorkoutQuotesFromInternet().then((remoteQuotes) => {
      if (!active) return;
      setCompletionQuote(pickRandomWorkoutQuote(remoteQuotes, seed));
    });

    return () => {
      active = false;
    };
  }, [finished, session?.id]);

  // --------- Early returns AFTER all hooks ----------
  if (loading) {
    return (
      <View style={[styles.centerFlex, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (finished) {
    return (
      <View style={[styles.finishedScreen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.finishedIcon}>
          <Ionicons name="trophy" size={48} color={C.warning} />
        </View>
        <Text style={styles.finishedTitle}>Workout Complete!</Text>
        <Text style={styles.finishedSubtitle}>{session?.workoutNameSnapshot}</Text>

        {session?.startedAt && session?.endedAt && (
          <Text style={styles.finishedDuration}>
            Duration:{' '}
            {Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)} min
          </Text>
        )}

        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>&ldquo;{completionQuote.quote}&rdquo;</Text>
          <Text style={styles.quoteAuthor}>- {completionQuote.author}</Text>
          <Text style={styles.quoteAttribution}>Quotes via ZenQuotes API · zenquotes.io</Text>
        </View>

        <Pressable style={styles.doneBtn} onPress={navigateToWorkouts}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (!template || !session || orderedBlocks.length === 0) return null;

  const block = derived.block!;
  const nextBlock = derived.nextBlock;
  const isLastBlock = currentBlockIdx === orderedBlocks.length - 1;
  const perf = getPerformanceForBlock(block.id);
  const progress = `${currentBlockIdx + 1} / ${orderedBlocks.length}`;
  const baseExercise = block.type === 'gym' && block.exerciseId ? exercisesById.get(block.exerciseId) || null : null;
  const activeExercise = block.type === 'gym' ? getLibraryExerciseForBlock(block) : null;
  const switchCandidateIds =
    block.type === 'gym'
      ? Array.from(
          new Set([
            block.exerciseId || '',
            getActiveExerciseIdForBlock(block) || '',
            ...(baseExercise?.alternativeExerciseIds || []),
            ...(activeExercise?.alternativeExerciseIds || []),
          ].filter(Boolean))
        )
      : [];
  const switchOptions =
    block.type === 'gym'
      ? switchCandidateIds
          .map((id) => exercisesById.get(id))
          .filter((exercise): exercise is ExerciseLibraryItem => !!exercise)
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={navigateToWorkouts}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={22} color={C.textSecondary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{template.name}</Text>
          <Text style={styles.headerProgress}>{progress}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.playlistBtn, pressed && { opacity: 0.85 }]}
          onPress={openPlaylist}
        >
          <Ionicons name="reorder-three-outline" size={22} color={C.primary} />
        </Pressable>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(currentBlockIdx / orderedBlocks.length) * 100}%` }]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {block.type === 'rest' ? (
          <View style={styles.restBlock}>
            <View style={styles.restIconWrap}>
              <Ionicons name="timer-outline" size={40} color={C.primary} />
            </View>
            <Text style={styles.restLabel}>{block.label || 'Rest'}</Text>
            <Text style={styles.restTimer}>{restTimeLeft}s</Text>

            {!isLastBlock && (
              <Pressable style={styles.skipBtn} onPress={skipRest}>
                <Text style={styles.skipBtnText}>Next Exercise</Text>
              </Pressable>
            )}
          </View>
        ) : block.type === 'cardio' ? (
          <View style={styles.cardioBlock}>
            <View style={[styles.blockTypeTag, { backgroundColor: C.secondaryBg, borderColor: C.secondary + '40' }]}>
              <Ionicons name="bicycle-outline" size={14} color={C.secondary} />
              <Text style={[styles.blockTypeText, { color: C.secondary }]}>Cardio</Text>
            </View>

            <Text style={styles.blockName}>{block.cardioName}</Text>
            <Text style={styles.blockMeta}>{block.minutes} minutes</Text>

            {block.notes ? <Text style={styles.blockNotes}>{block.notes}</Text> : null}

            <View style={styles.cardioInputRow}>
              <Text style={styles.cardioInputLabel}>Minutes completed</Text>
              <TextInput
                style={styles.cardioInput}
                value={String(perf?.minutesCompleted || 0)}
                onChangeText={v => updateBlockPerformance(block.id, { minutesCompleted: parseInt(v) || 0 })}
                keyboardType="numeric"
                placeholderTextColor={C.textMuted}
              />
            </View>

            <Pressable style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.85 }]} onPress={completeBlock}>
              <Ionicons name="checkmark" size={20} color={C.bg} />
              <Text style={styles.completeBtnText}>
                {isLastBlock ? 'Complete Cardio and End Workout' : 'Complete Cardio'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.gymBlock}>
            <View style={styles.blockTypeTag}>
              <MaterialCommunityIcons name="dumbbell" size={14} color={C.primary} />
              <Text style={styles.blockTypeText}>Exercise</Text>
            </View>

            <View style={styles.blockNameRow}>
              <Text style={styles.blockName}>{getGymBlockName(block)}</Text>
              {switchOptions.length > 1 && (
                <Pressable
                  style={({ pressed }) => [styles.switchBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => setShowSwitchModal(true)}
                >
                  <Ionicons name="swap-horizontal" size={16} color={C.primary} />
                </Pressable>
              )}
            </View>
            <Text style={styles.blockMeta}>{(perf?.sets?.length || 0)} sets logged</Text>

            {block.notes ? <Text style={styles.blockNotes}>{block.notes}</Text> : null}

            <View style={styles.setsHeader}>
              <Text style={[styles.setColHead, { flex: 0.3 }]}>Set</Text>
              <Text style={[styles.setColHead, { flex: 1 }]}>Weight (kg)</Text>
              <Text style={[styles.setColHead, { flex: 1 }]}>Reps</Text>
              <Text style={[styles.setColHead, { flex: 0.4 }]}>Done</Text>
              <Text style={[styles.setColHead, { width: 34 }]}> </Text>
            </View>

            {perf?.sets?.map((set, setIdx) => (
              <View key={setIdx} style={[styles.setRow, set.completed && styles.setRowDone]}>
                <Text style={[styles.setNum, { flex: 0.3 }]}>{setIdx + 1}</Text>

                <TextInput
                  style={[styles.setInput, { flex: 1 }]}
                  value={set.weight != null ? String(set.weight) : ''}
                  onChangeText={v => updateSet(block.id, setIdx, { weight: parseFloat(v) || null })}
                  placeholder="—"
                  placeholderTextColor={C.textMuted}
                  keyboardType="decimal-pad"
                />

                <TextInput
                  style={[styles.setInput, { flex: 1 }]}
                  value={set.reps != null ? String(set.reps) : ''}
                  onChangeText={v => updateSet(block.id, setIdx, { reps: parseInt(v) || null })}
                  placeholder="reps"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                />

                <Pressable
                  style={[styles.setCheck, { flex: 0.4 }, set.completed && styles.setCheckDone]}
                  onPress={() => {
                    updateSet(block.id, setIdx, { completed: !set.completed });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons
                    name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={set.completed ? C.success : C.border}
                  />
                </Pressable>

                <Pressable
                  style={styles.removeSetBtn}
                  onPress={() => {
                    removeSet(block.id, setIdx);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={C.error} />
                </Pressable>
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [styles.addSetBtn, pressed && { opacity: 0.85 }]}
              onPress={() => addSet(block.id)}
            >
              <Ionicons name="add" size={16} color={C.primary} />
              <Text style={styles.addSetText}>Add Set</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.85 }]} onPress={completeBlock}>
              <Ionicons name="checkmark" size={20} color={C.bg} />
              <Text style={styles.completeBtnText}>
                {isLastBlock ? 'Complete Exercise and End Workout' : 'Complete Exercise'}
              </Text>
            </Pressable>

            {/* Exercise videos BELOW the button (your requested UX) */}
            <ReferenceVideosSection
              title="Reference Videos"
              urls={derived.currentExerciseUrls}
              metaMap={videoMetaMap}
              activeUrl={activeVideoUrl}
              onPlay={handlePlay}
              onClose={closeVideo}
            />
          </View>
        )}

        {nextBlock && (
          <View style={styles.nextSection}>
            <Text style={styles.nextLabel}>Up Next</Text>
            <View style={styles.nextCard}>
              {nextBlock.type === 'gym' ? (
                <>
                  <MaterialCommunityIcons name="dumbbell" size={16} color={C.textMuted} />
                  <Text style={styles.nextCardText}>
                    {getGymBlockName(nextBlock)}
                  </Text>
                </>
              ) : nextBlock.type === 'cardio' ? (
                <>
                  <Ionicons name="bicycle-outline" size={16} color={C.textMuted} />
                  <Text style={styles.nextCardText}>
                    {nextBlock.cardioName} · {nextBlock.minutes} min
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="timer-outline" size={16} color={C.textMuted} />
                  <Text style={styles.nextCardText}>
                    {nextBlock.label || 'Rest'} · {nextBlock.seconds}s
                  </Text>
                </>
              )}
              <Pressable
                style={({ pressed }) => [styles.reorderInlineBtn, pressed && { opacity: 0.85 }]}
                onPress={openPlaylist}
              >
                <Ionicons name="reorder-three-outline" size={18} color={C.primary} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Rest screen videos AFTER Up Next (your requested UX) */}
        {block.type === 'rest' && nextBlock?.type === 'gym' && derived.nextExerciseUrls.length > 0 && (
          <ReferenceVideosSection
            title="Reference Videos for next exercise"
            urls={derived.nextExerciseUrls}
            metaMap={videoMetaMap}
            activeUrl={activeVideoUrl}
            onPlay={handlePlay}
            onClose={closeVideo}
          />
        )}
      </ScrollView>

      <Modal visible={showSwitchModal} transparent animationType="fade" onRequestClose={() => setShowSwitchModal(false)}>
        <Pressable style={styles.switchModalOverlay} onPress={() => setShowSwitchModal(false)}>
          <View style={styles.switchModalCard}>
            <Text style={styles.switchModalTitle}>Switch Exercise</Text>
            {switchOptions.map((option) => {
              const isActive = option.id === getActiveExerciseIdForBlock(block);
              return (
                <Pressable
                  key={option.id}
                  style={[styles.switchOptionRow, isActive && styles.switchOptionRowActive]}
                  onPress={async () => {
                    await switchExerciseForBlock(block.id, option.id, block.exerciseId);
                    setShowSwitchModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchOptionName}>{option.name}</Text>
                    <Text style={styles.switchOptionMeta}>
                      {option.movementType} • {option.primaryMuscleGroup}
                    </Text>
                  </View>
                  <Ionicons
                    name={isActive ? 'checkmark-circle' : 'chevron-forward'}
                    size={18}
                    color={isActive ? C.primary : C.textMuted}
                  />
                </Pressable>
              );
            })}
            <Pressable
              style={styles.switchCancelBtn}
              onPress={() => setShowSwitchModal(false)}
            >
              <Text style={styles.switchCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {(block.type !== 'rest' || isLastBlock) && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.8 }]} onPress={confirmAndEndWorkout}>
            <Ionicons name="flag-outline" size={18} color={C.error} />
            <Text style={styles.endBtnText}>End Workout</Text>
          </Pressable>
        </View>
      )}
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
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: C.text },
  headerProgress: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  playlistBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressBar: {
    height: 3,
    backgroundColor: C.surface2,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  restBlock: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  restIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.primary + '40',
  },
  restLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.textSecondary },
  restTimer: { fontFamily: 'Outfit_700Bold', fontSize: 64, color: C.primary },
  skipBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  skipBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary },

  cardioBlock: { gap: 12 },
  gymBlock: { gap: 12 },

  blockTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.primaryBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.primary + '40',
  },
  blockTypeText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.primary },

  blockNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  blockName: { fontFamily: 'Outfit_700Bold', fontSize: 26, color: C.text },
  switchBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockMeta: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textMuted },
  blockNotes: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: C.textMuted,
    backgroundColor: C.surface2,
    borderRadius: 10,
    padding: 12,
  },

  setsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  setColHead: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted, textAlign: 'center' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.surface2,
    gap: 8,
  },
  setRowDone: { opacity: 0.6 },

  setNum: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary, textAlign: 'center' },
  setInput: {
    backgroundColor: C.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    height: 40,
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    color: C.text,
    textAlign: 'center',
  },
  setCheck: { alignItems: 'center', justifyContent: 'center' },
  setCheckDone: {},
  removeSetBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.error + '44',
  },
  addSetBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addSetText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.primary },

  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: C.primary,
    marginTop: 8,
  },
  completeBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },

  cardioInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardioInputLabel: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary, flex: 1 },
  cardioInput: {
    width: 80,
    backgroundColor: C.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    color: C.text,
    textAlign: 'center',
  },

  nextSection: { marginTop: 24 },
  nextLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted, marginBottom: 8 },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  nextCardText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.textSecondary, flex: 1 },
  reorderInlineBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.error + '40',
    backgroundColor: C.errorBg,
  },
  endBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.error },

  finishedScreen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  finishedIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.warning + '60',
    marginBottom: 8,
  },
  finishedTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text },
  finishedSubtitle: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: C.textSecondary },
  finishedDuration: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.textMuted },
  quoteCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  quoteText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: C.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19,
    textAlign: 'center',
  },
  quoteAuthor: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'right',
  },
  quoteAttribution: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: C.textMuted,
    textAlign: 'center',
  },

  doneBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  doneBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },

  switchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  switchModalCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
    maxHeight: '72%',
  },
  switchModalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text, marginBottom: 6 },
  switchOptionRow: {
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchOptionRowActive: {
    borderColor: C.primary + '66',
    backgroundColor: C.primaryBg,
  },
  switchOptionName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.text },
  switchOptionMeta: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted, textTransform: 'capitalize' },
  switchCancelBtn: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface2,
  },
  switchCancelText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.textSecondary },
});
