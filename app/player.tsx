import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { sessionsRepo, workoutsRepo } from '@/lib/storage';
import type { WorkoutSession, WorkoutTemplate, WorkoutBlock, GymSet } from '@/lib/types';

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const restTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      if (!user || !sessionId) return;
      const s = await sessionsRepo.getById(user.id, sessionId);
      if (!s) { router.back(); return; }
      if (s.completed) { setFinished(true); }
      setSession(s);
      const t = await workoutsRepo.getById(user.id, s.workoutTemplateId);
      setTemplate(t);
      setLoading(false);
    })();
  }, [user, sessionId]);

  useEffect(() => {
    if (!restActive) return;
    restTimer.current = setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(restTimer.current!);
          setRestActive(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          handleAutoAdvance();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(restTimer.current!);
  }, [restActive]);

  const handleAutoAdvance = () => {
    if (!template) return;
    setCurrentBlockIdx(prev => {
      const next = prev + 1;
      if (next < template.blocks.length) {
        const nextBlock = template.blocks[next];
        if (nextBlock.type === 'rest') {
          setRestTimeLeft(nextBlock.seconds || 60);
          setRestActive(true);
        }
        return next;
      }
      return prev;
    });
  };

  const saveSession = async (updates: Partial<WorkoutSession>) => {
    if (!user || !session) return;
    const updated = { ...session, ...updates };
    await sessionsRepo.save(user.id, updated);
    setSession(updated);
    return updated;
  };

  const updateBlockPerformance = async (blockId: string, perf: Partial<{ completed: boolean; sets: GymSet[]; minutesCompleted: number }>) => {
    if (!session) return;
    const newPerfs = session.blockPerformances.map(p =>
      p.blockId === blockId ? { ...p, ...perf } : p
    );
    await saveSession({ blockPerformances: newPerfs });
  };

  const updateSet = async (blockId: string, setIdx: number, updates: Partial<GymSet>) => {
    if (!session) return;
    const perf = session.blockPerformances.find(p => p.blockId === blockId);
    if (!perf?.sets) return;
    const newSets = perf.sets.map((s, i) => i === setIdx ? { ...s, ...updates } : s);
    await updateBlockPerformance(blockId, { sets: newSets });
  };

  const completeBlock = async () => {
    if (!template || !session) return;
    const block = template.blocks[currentBlockIdx];
    await updateBlockPerformance(block.id, { completed: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const nextIdx = currentBlockIdx + 1;
    if (nextIdx >= template.blocks.length) {
      await endWorkout();
    } else {
      const nextBlock = template.blocks[nextIdx];
      setCurrentBlockIdx(nextIdx);
      if (nextBlock.type === 'rest') {
        setRestTimeLeft(nextBlock.seconds || 60);
        setRestActive(true);
      }
    }
  };

  const endWorkout = async () => {
    const updated = await saveSession({ endedAt: new Date().toISOString(), completed: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFinished(true);
  };

  const skipRest = () => {
    clearInterval(restTimer.current!);
    setRestActive(false);
    handleAutoAdvance();
  };

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
            Duration: {Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)} min
          </Text>
        )}
        <Pressable style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (!template || !session) return null;

  const block = template.blocks[currentBlockIdx];
  const nextBlock = template.blocks[currentBlockIdx + 1];
  const perf = session.blockPerformances.find(p => p.blockId === block.id);
  const progress = `${currentBlockIdx + 1} / ${template.blocks.length}`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => {
          Alert.alert('End Workout?', 'Your progress will be saved.', [
            { text: 'Continue', style: 'cancel' },
            { text: 'End', style: 'destructive', onPress: endWorkout },
          ]);
        }} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{template.name}</Text>
          <Text style={styles.headerProgress}>{progress}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((currentBlockIdx) / template.blocks.length) * 100}%` }]} />
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
            <Pressable style={styles.skipBtn} onPress={skipRest}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
          </View>
        ) : block.type === 'cardio' ? (
          <View style={styles.cardioBlock}>
            <View style={styles.blockTypeTag}>
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

            <Pressable
              style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.85 }]}
              onPress={completeBlock}
            >
              <Ionicons name="checkmark" size={20} color={C.bg} />
              <Text style={styles.completeBtnText}>Complete Cardio</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.gymBlock}>
            <View style={styles.blockTypeTag}>
              <MaterialCommunityIcons name="dumbbell" size={14} color={C.primary} />
              <Text style={styles.blockTypeText}>Exercise</Text>
            </View>
            <Text style={styles.blockName}>{block.exerciseName}</Text>
            <Text style={styles.blockMeta}>{block.sets} sets · {block.repsOption} reps</Text>
            {block.notes ? <Text style={styles.blockNotes}>{block.notes}</Text> : null}
            {block.referenceVideoUrls && block.referenceVideoUrls.length > 0 && (
              <View style={styles.videoLinks}>
                <Ionicons name="videocam-outline" size={14} color={C.textMuted} />
                <Text style={styles.videoLinksText}>{block.referenceVideoUrls.length} reference video(s)</Text>
              </View>
            )}

            <View style={styles.setsHeader}>
              <Text style={[styles.setColHead, { flex: 0.3 }]}>Set</Text>
              <Text style={[styles.setColHead, { flex: 1 }]}>Weight (kg)</Text>
              <Text style={[styles.setColHead, { flex: 1 }]}>Reps</Text>
              <Text style={[styles.setColHead, { flex: 0.4 }]}>Done</Text>
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
                  placeholder={block.repsOption === 'Until Failure' ? 'fail' : block.repsOption || '—'}
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
                  <Ionicons name={set.completed ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={set.completed ? C.success : C.border} />
                </Pressable>
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.85 }]}
              onPress={completeBlock}
            >
              <Ionicons name="checkmark" size={20} color={C.bg} />
              <Text style={styles.completeBtnText}>Complete Exercise</Text>
            </Pressable>
          </View>
        )}

        {nextBlock && (
          <View style={styles.nextSection}>
            <Text style={styles.nextLabel}>Up Next</Text>
            <View style={styles.nextCard}>
              {nextBlock.type === 'gym' ? (
                <>
                  <MaterialCommunityIcons name="dumbbell" size={16} color={C.textMuted} />
                  <Text style={styles.nextCardText}>{nextBlock.exerciseName} · {nextBlock.sets}×{nextBlock.repsOption}</Text>
                </>
              ) : nextBlock.type === 'cardio' ? (
                <>
                  <Ionicons name="bicycle-outline" size={16} color={C.textMuted} />
                  <Text style={styles.nextCardText}>{nextBlock.cardioName} · {nextBlock.minutes} min</Text>
                </>
              ) : (
                <>
                  <Ionicons name="timer-outline" size={16} color={C.textMuted} />
                  <Text style={styles.nextCardText}>{nextBlock.label || 'Rest'} · {nextBlock.seconds}s</Text>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {block.type !== 'rest' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.8 }]}
            onPress={endWorkout}
          >
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: C.text },
  headerProgress: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  progressBar: { height: 3, backgroundColor: C.surface2, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  restBlock: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  restIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.primary + '40',
  },
  restLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.textSecondary },
  restTimer: { fontFamily: 'Outfit_700Bold', fontSize: 64, color: C.primary },
  skipBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2,
  },
  skipBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary },
  cardioBlock: { gap: 12 },
  gymBlock: { gap: 12 },
  blockTypeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.primary + '40',
  },
  blockTypeText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.primary },
  blockName: { fontFamily: 'Outfit_700Bold', fontSize: 26, color: C.text },
  blockMeta: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textMuted },
  blockNotes: {
    fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted,
    backgroundColor: C.surface2, borderRadius: 10, padding: 12,
  },
  videoLinks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  videoLinksText: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  setsHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  setColHead: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted, textAlign: 'center' },
  setRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.surface2, gap: 8,
  },
  setRowDone: { opacity: 0.6 },
  setNum: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary, textAlign: 'center' },
  setInput: {
    backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, height: 40, fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text, textAlign: 'center',
  },
  setCheck: { alignItems: 'center', justifyContent: 'center' },
  setCheckDone: {},
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    height: 52, borderRadius: 14, backgroundColor: C.primary, marginTop: 8,
  },
  completeBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },
  cardioInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardioInputLabel: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary, flex: 1 },
  cardioInput: {
    width: 80, backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, height: 44, fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text, textAlign: 'center',
  },
  nextSection: { marginTop: 24 },
  nextLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted, marginBottom: 8 },
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  nextCardText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.textSecondary, flex: 1 },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.error + '40',
    backgroundColor: C.errorBg,
  },
  endBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.error },
  finishedScreen: {
    flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 16,
  },
  finishedIcon: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: C.warningBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.warning + '60',
    marginBottom: 8,
  },
  finishedTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text },
  finishedSubtitle: { fontFamily: 'Outfit_500Medium', fontSize: 17, color: C.textSecondary },
  finishedDuration: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.textMuted },
  doneBtn: {
    width: '100%', height: 52, borderRadius: 14, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  doneBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },
});
