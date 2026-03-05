import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFeedbackToast } from '@/context/FeedbackToastContext';
import { workoutsRepo, schedulesRepo, sessionsRepo } from '@/lib/storage';
import { getMondayYMD, todayYMD } from '@/lib/dates';
import type { WorkoutTemplate, WeekSchedule, WorkoutSession } from '@/lib/types';
import * as Crypto from 'expo-crypto';

function latestByStartedAt(sessions: WorkoutSession[]): WorkoutSession | null {
  if (sessions.length === 0) return null;
  return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null;
}

export default function WorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast, showUndoToast } = useFeedbackToast();
  const today = todayYMD();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [todaySessions, setTodaySessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const weekStart = getMondayYMD();
    const [tmpl, sched, allSessions] = await Promise.all([
      workoutsRepo.getAll(user.id),
      schedulesRepo.getByWeek(user.id, weekStart),
      sessionsRepo.getAll(user.id),
    ]);
    setTemplates(tmpl);
    setSchedule(sched);
    setTodaySessions(allSessions.filter(s => s.date === today));
    setLoading(false);
  }, [user, today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isWeekReady = !!schedule && schedule.days.every(d => d.status !== 'unplanned');
  const todaySchedule = schedule?.days.find(d => d.date === today);
  const todayTemplate = todaySchedule?.workoutTemplateId
    ? templates.find(t => t.id === todaySchedule.workoutTemplateId) || null
    : null;
  const hasCompletedTodaySession = todaySessions.some((session) => session.completed);

  const activeTodaySessionForTemplate = (templateId: string) =>
    latestByStartedAt(
      todaySessions.filter((session) => !session.completed && session.workoutTemplateId === templateId)
    );

  const handleDeleteTemplate = (id: string, name: string) => {
    if (!user) return;

    const deletedTemplate = templates.find((template) => template.id === id);
    if (!deletedTemplate) return;
    const deletedIndex = templates.findIndex((template) => template.id === id);

    const restoreTemplate = () => {
      setTemplates((prev) => {
        if (prev.some((template) => template.id === deletedTemplate.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(Math.max(deletedIndex, 0), next.length), 0, deletedTemplate);
        return next;
      });
    };

    setTemplates((prev) => prev.filter((template) => template.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    showUndoToast({
      message: `${name} deleted`,
      durationMs: 10000,
      onUndo: restoreTemplate,
      onCommit: async () => {
        try {
          await workoutsRepo.delete(user.id, id);
          await load();
        } catch (error) {
          restoreTemplate();
          throw error;
        }
      },
      onCommitErrorMessage: 'Unable to delete workout. Please try again.',
    });
  };

  const startWorkout = async (template: WorkoutTemplate) => {
    if (!user) return;
    const now = new Date().toISOString();
    const session: WorkoutSession = {
      id: Crypto.randomUUID(),
      date: today,
      workoutTemplateId: template.id,
        workoutNameSnapshot: template.name,
        sessionBlocks: template.blocks,
        startedAt: now,
        endedAt: null,
        completed: false,
        blockPerformances: template.blocks.map(b => ({
          blockId: b.id,
          completed: false,
          ...(b.type === 'gym'
            ? {
                sets: Array.from(
                  { length: Math.max(1, b.sets || 1) },
                  () => ({ weight: null, reps: null, completed: false })
                ),
              }
            : {}),
          ...(b.type === 'cardio' ? { minutesCompleted: 0 } : {}),
        })),
      };
    await sessionsRepo.save(user.id, session);
    showToast({ message: 'Workout started', tone: 'success' });
    router.push({ pathname: '/player', params: { sessionId: session.id } });
  };

  const resumeWorkout = (sessionId: string) => {
    router.push({ pathname: '/player', params: { sessionId } });
  };

  const startOrResumeWorkout = async (template: WorkoutTemplate) => {
    const active = activeTodaySessionForTemplate(template.id);
    if (active) {
      resumeWorkout(active.id);
      return;
    }
    await startWorkout(template);
  };

  const blockCount = (t: WorkoutTemplate) => {
    const gym = t.blocks.filter(b => b.type === 'gym').length;
    const cardio = t.blocks.filter(b => b.type === 'cardio').length;
    const rest = t.blocks.filter(b => b.type === 'rest').length;
    const parts = [];
    if (gym) parts.push(`${gym} exercise${gym > 1 ? 's' : ''}`);
    if (cardio) parts.push(`${cardio} cardio`);
    if (rest) parts.push(`${rest} rest`);
    return parts.join(' · ');
  };

  if (loading) {
    return (
      <View style={[styles.centerFlex, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 20),
          paddingBottom: 100,
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Workouts</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push({ pathname: '/editor', params: { id: 'new' } })}
          >
            <Ionicons name="add" size={22} color={C.bg} />
          </Pressable>
        </View>

        {todayTemplate && (
          <View style={styles.todaySection}>
            <Text style={styles.todaySectionTitle}>Today&apos;s Workout</Text>
            <View style={styles.todayCard}>
              <View style={styles.todayCardHeader}>
                <View style={styles.todayCardLeft}>
                  <MaterialCommunityIcons name="dumbbell" size={20} color={C.primary} />
                  <Text style={styles.todayCardName}>{todayTemplate.name}</Text>
                </View>
                {todaySessions.some(s => s.completed) && (
                  <Ionicons name="checkmark-circle" size={22} color={C.success} />
                )}
              </View>
              <Text style={styles.todayCardBlocks}>{blockCount(todayTemplate)}</Text>
              {!isWeekReady ? (
                <View style={styles.lockedBanner}>
                  <Ionicons name="lock-closed-outline" size={14} color={C.warning} />
                  <Text style={styles.lockedText}>Plan entire week to unlock</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => startOrResumeWorkout(todayTemplate)}
                >
                  <Ionicons name="play" size={16} color={C.bg} />
                  <Text style={styles.startBtnText}>
                    {activeTodaySessionForTemplate(todayTemplate.id)
                      ? 'Resume Workout'
                      : hasCompletedTodaySession
                        ? 'Start Again'
                        : 'Start Workout'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Templates</Text>
          <Text style={styles.sectionCount}>{templates.length}</Text>
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={C.border} />
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptySubtitle}>Create your first workout template to get started</Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push({ pathname: '/editor', params: { id: 'new' } })}
            >
              <Ionicons name="add" size={18} color={C.bg} />
              <Text style={styles.emptyBtnText}>Create template</Text>
            </Pressable>
          </View>
        ) : (
          templates.map(t => (
            <Pressable
              key={t.id}
              style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/editor', params: { id: t.id } })}
              onLongPress={() => handleDeleteTemplate(t.id, t.name)}
            >
              <View style={styles.templateLeft}>
                <View style={styles.templateIcon}>
                  <MaterialCommunityIcons name="dumbbell" size={20} color={C.primary} />
                </View>
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateBlocks}>{blockCount(t)}</Text>
                </View>
              </View>
              <View style={styles.templateRight}>
                <Pressable
                  style={({ pressed }) => [styles.playBtn, !isWeekReady && styles.playBtnDisabled, pressed && { opacity: 0.8 }]}
                  onPress={() => isWeekReady && startOrResumeWorkout(t)}
                >
                  <Ionicons name="play" size={14} color={isWeekReady ? C.bg : C.textMuted} />
                </Pressable>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  todaySection: { marginBottom: 24 },
  todaySectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary, marginBottom: 10 },
  todayCard: {
    backgroundColor: C.surface2, borderRadius: 16, borderWidth: 1.5,
    borderColor: C.primary + '40', padding: 16, gap: 10,
  },
  todayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayCardName: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  todayCardBlocks: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  lockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.warningBg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.warning + '40',
  },
  lockedText: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.warning },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    height: 48, borderRadius: 12, backgroundColor: C.primary,
  },
  startBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.bg },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary },
  sectionCount: {
    backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
    fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.textMuted,
    borderWidth: 1, borderColor: C.border,
  },
  templateCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 8,
  },
  templateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  templateIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  templateInfo: { gap: 3, flex: 1 },
  templateName: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.text },
  templateBlocks: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  templateRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnDisabled: { backgroundColor: C.surface3 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.textSecondary },
  emptySubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, height: 44,
    marginTop: 8,
  },
  emptyBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.bg },
});
