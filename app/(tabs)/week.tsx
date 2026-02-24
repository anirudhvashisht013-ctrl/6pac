import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import {
  schedulesRepo, targetsRepo, logsRepo, mealsRepo,
  workoutsRepo, sessionsRepo,
} from '@/lib/storage';
import {
  getMondayYMD, getWeekDates, dayLabel, formatDate,
  addDays, todayYMD, monthLabel, getWeekNumber, isFuture,
} from '@/lib/dates';
import type {
  WeekSchedule, WeeklyTarget, PlannedDay, WorkoutTemplate,
  DailyLog, MealEntry, WorkoutSession,
} from '@/lib/types';

const WEEK_OFFSETS = [-2, -1, 0, 1, 2];

type EditingTarget = {
  dailyCaloriesTarget: string;
  dailyStepsTarget: string;
  dailyWaterMlTarget: string;
  weightGoalType: 'lose' | 'gain' | 'maintain';
};

type DayStatus = 'planned_workout' | 'rest' | 'unplanned';

function DayCard({
  day, template, log, meals, target, sessions, onPress, isWeekReady,
}: {
  day: PlannedDay;
  template: WorkoutTemplate | null;
  log: DailyLog | null;
  meals: MealEntry[];
  target: WeeklyTarget | null;
  sessions: WorkoutSession[];
  onPress: () => void;
  isWeekReady: boolean;
}) {
  const today = todayYMD();
  const isToday = day.date === today;
  const future = isFuture(day.date);
  const mealCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalCal = mealCal + (log?.caloriesManual || 0);

  const calMet = target && totalCal > 0
    ? totalCal >= target.dailyCaloriesTarget * 0.95 && totalCal <= target.dailyCaloriesTarget * 1.05
    : false;
  const stepsMet = target && log?.steps ? log.steps >= target.dailyStepsTarget : false;
  const waterMet = target && log?.waterMl ? log.waterMl >= target.dailyWaterMlTarget : false;
  const allMet = calMet && stepsMet && waterMet;

  const calHasData = totalCal > 0;
  const stepsHasData = !!log?.steps;
  const waterHasData = !!log?.waterMl;

  const sessionCompleted = sessions.some(s => s.date === day.date && s.completed);

  const dayName = dayLabel(day.date);
  const dateStr = formatDate(day.date);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.dayCard,
        isToday && styles.dayCardToday,
        future && styles.dayCardFuture,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      <View style={styles.dayCardHeader}>
        <View style={styles.dayCardLeft}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{dayName}</Text>
          <Text style={styles.dayDate}>{dateStr}</Text>
        </View>
        <View style={styles.dayCardRight}>
          {allMet && !future && <Ionicons name="star" size={14} color={C.warning} />}
          {day.status === 'planned_workout' && sessionCompleted && (
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
          )}
        </View>
      </View>

      <View style={styles.dayStatusRow}>
        {day.status === 'planned_workout' ? (
          <View style={styles.workoutBadge}>
            <MaterialCommunityIcons name="dumbbell" size={12} color={C.primary} />
            <Text style={styles.workoutBadgeText} numberOfLines={1}>
              {template?.name || 'Workout'}
            </Text>
          </View>
        ) : day.status === 'rest' ? (
          <View style={styles.restBadge}>
            <Ionicons name="bed-outline" size={12} color={C.textMuted} />
            <Text style={styles.restBadgeText}>Rest</Text>
          </View>
        ) : (
          <View style={styles.unplannedBadge}>
            <Text style={styles.unplannedText}>Unplanned</Text>
          </View>
        )}
      </View>

      {!future && target && (
        <View style={styles.indicatorsRow}>
          {[
            { label: 'C', met: calMet, hasData: calHasData },
            { label: 'S', met: stepsMet, hasData: stepsHasData },
            { label: 'W', met: waterMet, hasData: waterHasData },
          ].map(({ label, met, hasData }) => (
            <View key={label} style={[
              styles.indicator,
              met ? styles.indicatorMet : hasData ? styles.indicatorLogged : styles.indicatorEmpty,
            ]}>
              <Text style={[
                styles.indicatorText,
                met ? styles.indicatorTextMet : hasData ? styles.indicatorTextLogged : styles.indicatorTextEmpty,
              ]}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const today = todayYMD();

  const [weekStart, setWeekStart] = useState(getMondayYMD());
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [target, setTarget] = useState<WeeklyTarget | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetForm, setTargetForm] = useState<EditingTarget>({
    dailyCaloriesTarget: '2400',
    dailyStepsTarget: '8000',
    dailyWaterMlTarget: '2500',
    weightGoalType: 'maintain',
  });
  const [selectDayModal, setSelectDayModal] = useState<{ day: PlannedDay; idx: number } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [sched, tgt, tmpl, allLogs, allMeals, allSessions] = await Promise.all([
      schedulesRepo.getByWeek(user.id, weekStart),
      targetsRepo.getByWeek(user.id, weekStart),
      workoutsRepo.getAll(user.id),
      logsRepo.getAll(user.id),
      mealsRepo.getAll(user.id),
      sessionsRepo.getAll(user.id),
    ]);

    const weekDates = getWeekDates(weekStart);

    const defaultSchedule: WeekSchedule = {
      weekStartDate: weekStart,
      days: weekDates.map(d => ({ date: d, status: 'unplanned', workoutTemplateId: null })),
    };

    setSchedule(sched || defaultSchedule);
    setTarget(tgt);
    setTemplates(tmpl);
    setLogs(allLogs.filter(l => weekDates.includes(l.date)));
    setMeals(allMeals.filter(m => weekDates.includes(m.date)));
    setSessions(allSessions.filter(s => weekDates.includes(s.date)));

    if (tgt) {
      setTargetForm({
        dailyCaloriesTarget: String(tgt.dailyCaloriesTarget),
        dailyStepsTarget: String(tgt.dailyStepsTarget),
        dailyWaterMlTarget: String(tgt.dailyWaterMlTarget),
        weightGoalType: tgt.weightGoalType,
      });
    }
    setLoading(false);
  }, [user, weekStart]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weekDates = getWeekDates(weekStart);
  const isWeekReady = !!schedule && schedule.days.every(d => d.status !== 'unplanned');

  const saveTarget = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const tgt: WeeklyTarget = {
      weekStartDate: weekStart,
      dailyCaloriesTarget: parseInt(targetForm.dailyCaloriesTarget) || 2000,
      dailyStepsTarget: parseInt(targetForm.dailyStepsTarget) || 8000,
      dailyWaterMlTarget: parseInt(targetForm.dailyWaterMlTarget) || 2000,
      weightGoalType: targetForm.weightGoalType,
      createdAt: target?.createdAt || now,
      updatedAt: now,
    };
    await targetsRepo.save(user.id, tgt);
    setTarget(tgt);
    setEditingTarget(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateDayStatus = async (idx: number, status: DayStatus, workoutTemplateId: string | null = null) => {
    if (!user || !schedule) return;
    const newDays = [...schedule.days];
    newDays[idx] = { ...newDays[idx], status, workoutTemplateId };
    const newSchedule: WeekSchedule = { ...schedule, days: newDays };
    await schedulesRepo.save(user.id, newSchedule);
    setSchedule(newSchedule);
    setSelectDayModal(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDayPress = (day: PlannedDay, idx: number) => {
    setSelectDayModal({ day, idx });
  };

  const getLog = (date: string) => logs.find(l => l.date === date) || null;
  const getMealsForDate = (date: string) => meals.filter(m => m.date === date);
  const getTemplate = (id: string | null) => id ? templates.find(t => t.id === id) || null : null;
  const getSessionsForDate = (date: string) => sessions.filter(s => s.date === date);

  const weeklyStats = {
    workoutsPlanned: schedule?.days.filter(d => d.status === 'planned_workout').length || 0,
    workoutsCompleted: sessions.filter(s => s.completed).length,
    avgCalories: logs.reduce((s, l) => {
      const ml = meals.filter(m => m.date === l.date).reduce((a, m) => a + (m.calories || 0), 0);
      return s + ml + (l.caloriesManual || 0);
    }, 0) / (logs.length || 1),
    avgSteps: logs.reduce((s, l) => s + (l.steps || 0), 0) / (logs.length || 1),
    weightChange: (() => {
      const wLogs = logs.filter(l => l.weightKg).sort((a, b) => a.date.localeCompare(b.date));
      if (wLogs.length < 2) return null;
      return (wLogs[wLogs.length - 1].weightKg! - wLogs[0].weightKg!);
    })(),
  };

  const weekOffsets = [-2, -1, 0, 1, 2];

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
        <Text style={styles.pageTitle}>Week</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekSelector}>
          {weekOffsets.map(offset => {
            const d = new Date();
            d.setDate(d.getDate() + offset * 7);
            const ws = getMondayYMD(d);
            const isCurrent = ws === weekStart;
            const isThisWeek = ws === getMondayYMD();
            return (
              <Pressable
                key={ws}
                style={[styles.weekSlot, isCurrent && styles.weekSlotActive]}
                onPress={() => setWeekStart(ws)}
              >
                <Text style={[styles.weekSlotMonth, isCurrent && styles.weekSlotTextActive]}>
                  {monthLabel(ws)}
                </Text>
                <Text style={[styles.weekSlotNum, isCurrent && styles.weekSlotTextActive]}>
                  W{getWeekNumber(ws)}
                </Text>
                {isThisWeek && <View style={styles.currentDot} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {!isWeekReady && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color={C.warning} />
            <Text style={styles.warningText}>Plan all days to enable workouts</Text>
          </View>
        )}

        {isWeekReady && (
          <View style={styles.readyBanner}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={styles.readyText}>Week planned — workouts enabled</Text>
          </View>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Weekly Targets</Text>
          <Pressable onPress={() => setEditingTarget(!editingTarget)}>
            <Ionicons name={editingTarget ? 'close' : 'pencil'} size={18} color={C.primary} />
          </Pressable>
        </View>

        {editingTarget ? (
          <View style={styles.targetEditCard}>
            {[
              { key: 'dailyCaloriesTarget', label: 'Daily Calories', unit: 'kcal', kbType: 'numeric' },
              { key: 'dailyStepsTarget', label: 'Daily Steps', unit: 'steps', kbType: 'numeric' },
              { key: 'dailyWaterMlTarget', label: 'Daily Water', unit: 'ml', kbType: 'numeric' },
            ].map(({ key, label, unit, kbType }) => (
              <View key={key} style={styles.targetEditRow}>
                <Text style={styles.targetEditLabel}>{label}</Text>
                <View style={styles.targetEditInputRow}>
                  <TextInput
                    style={styles.targetEditInput}
                    value={(targetForm as any)[key]}
                    onChangeText={v => setTargetForm(f => ({ ...f, [key]: v }))}
                    keyboardType={kbType as any}
                    placeholderTextColor={C.textMuted}
                  />
                  <Text style={styles.targetEditUnit}>{unit}</Text>
                </View>
              </View>
            ))}
            <View style={styles.goalTypeRow}>
              {(['lose', 'maintain', 'gain'] as const).map(g => (
                <Pressable
                  key={g}
                  style={[styles.goalTypeBtn, targetForm.weightGoalType === g && styles.goalTypeBtnActive]}
                  onPress={() => setTargetForm(f => ({ ...f, weightGoalType: g }))}
                >
                  <Text style={[styles.goalTypeBtnText, targetForm.weightGoalType === g && styles.goalTypeBtnTextActive]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.saveTargetBtn} onPress={saveTarget}>
              <Text style={styles.saveTargetBtnText}>Save Targets</Text>
            </Pressable>
          </View>
        ) : target ? (
          <View style={styles.targetCards}>
            {[
              { label: 'Calories', val: target.dailyCaloriesTarget, unit: 'kcal', icon: 'flame-outline' },
              { label: 'Steps', val: target.dailyStepsTarget, unit: 'steps', icon: 'footsteps-outline' },
              { label: 'Water', val: target.dailyWaterMlTarget, unit: 'ml', icon: 'water-outline' },
            ].map(({ label, val, unit, icon }) => (
              <View key={label} style={styles.targetCard}>
                <Ionicons name={icon as any} size={16} color={C.primary} />
                <Text style={styles.targetCardVal}>{val.toLocaleString()}</Text>
                <Text style={styles.targetCardLabel}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Pressable style={styles.addTargetBtn} onPress={() => setEditingTarget(true)}>
            <Ionicons name="add" size={18} color={C.primary} />
            <Text style={styles.addTargetBtnText}>Set weekly targets</Text>
          </Pressable>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Daily Schedule</Text>

        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
        ) : (
          schedule?.days.map((day, idx) => (
            <DayCard
              key={day.date}
              day={day}
              template={getTemplate(day.workoutTemplateId)}
              log={getLog(day.date)}
              meals={getMealsForDate(day.date)}
              target={target}
              sessions={getSessionsForDate(day.date)}
              onPress={() => handleDayPress(day, idx)}
              isWeekReady={isWeekReady}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Weekly Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{weeklyStats.workoutsCompleted}/{weeklyStats.workoutsPlanned}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{Math.round(weeklyStats.avgCalories).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Avg kcal</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{Math.round(weeklyStats.avgSteps).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Avg steps</Text>
          </View>
          {weeklyStats.weightChange !== null && (
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: weeklyStats.weightChange >= 0 ? C.secondary : C.success }]}>
                {weeklyStats.weightChange >= 0 ? '+' : ''}{weeklyStats.weightChange.toFixed(1)} kg
              </Text>
              <Text style={styles.statLabel}>Weight change</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectDayModal} transparent animationType="fade" onRequestClose={() => setSelectDayModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectDayModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectDayModal ? `${dayLabel(selectDayModal.day.date)}, ${formatDate(selectDayModal.day.date)}` : ''}
            </Text>
            <Text style={styles.modalSubtitle}>Planning Mode — Set day type</Text>

            <Pressable style={styles.modalOption} onPress={() => selectDayModal && updateDayStatus(selectDayModal.idx, 'rest')}>
              <Ionicons name="bed-outline" size={20} color={C.textSecondary} />
              <Text style={styles.modalOptionText}>Rest Day</Text>
            </Pressable>

            <Text style={styles.modalPickHeader}>Choose Workout</Text>
            {templates.length === 0 ? (
              <Text style={styles.noTemplatesText}>No templates yet — create one in Workouts</Text>
            ) : (
              templates.map(t => (
                <Pressable
                  key={t.id}
                  style={[
                    styles.modalOption,
                    selectDayModal?.day.workoutTemplateId === t.id && styles.modalOptionSelected,
                  ]}
                  onPress={() => selectDayModal && updateDayStatus(selectDayModal.idx, 'planned_workout', t.id)}
                >
                  <MaterialCommunityIcons name="dumbbell" size={18} color={C.primary} />
                  <Text style={styles.modalOptionText}>{t.name}</Text>
                </Pressable>
              ))
            )}

            <Pressable style={styles.modalCancelBtn} onPress={() => setSelectDayModal(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text, marginBottom: 16 },
  weekSelector: { marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 16 },
  weekSlot: {
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
    backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', minWidth: 70,
  },
  weekSlotActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  weekSlotMonth: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  weekSlotNum: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: C.textSecondary },
  weekSlotTextActive: { color: C.primary },
  currentDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 4,
  },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.warningBg, borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: C.warning + '40',
  },
  warningText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.warning, flex: 1 },
  readyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.successBg, borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: C.success + '40',
  },
  readyText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.success, flex: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary, marginBottom: 10 },
  targetEditCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12, marginBottom: 16,
  },
  targetEditRow: { gap: 6 },
  targetEditLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  targetEditInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetEditInput: {
    flex: 1, backgroundColor: C.surface3, borderRadius: 10, paddingHorizontal: 12,
    height: 44, fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text,
    borderWidth: 1, borderColor: C.border,
  },
  targetEditUnit: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted, width: 40 },
  goalTypeRow: { flexDirection: 'row', gap: 8 },
  goalTypeBtn: {
    flex: 1, height: 38, borderRadius: 8, backgroundColor: C.surface3,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
  },
  goalTypeBtnActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  goalTypeBtnText: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  goalTypeBtnTextActive: { color: C.primary },
  saveTargetBtn: {
    height: 44, borderRadius: 10, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveTargetBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.bg },
  targetCards: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  targetCard: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, alignItems: 'center', gap: 4,
  },
  targetCardVal: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: C.text },
  targetCardLabel: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  addTargetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, borderStyle: 'dashed', padding: 14, marginBottom: 16,
  },
  addTargetBtnText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.primary },
  dayCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 8, gap: 8,
  },
  dayCardToday: { borderColor: C.primary, backgroundColor: C.primaryBg },
  dayCardFuture: { opacity: 0.65 },
  dayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayCardLeft: { gap: 2 },
  dayCardRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dayName: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary },
  dayNameToday: { color: C.primary },
  dayDate: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  dayStatusRow: { flexDirection: 'row', gap: 8 },
  workoutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  workoutBadgeText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.primary },
  restBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.surface3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  restBadgeText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted },
  unplannedBadge: {
    backgroundColor: C.errorBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  unplannedText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.error },
  indicatorsRow: { flexDirection: 'row', gap: 6 },
  indicator: {
    width: 26, height: 26, borderRadius: 7, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1.5,
  },
  indicatorMet: { backgroundColor: C.successBg, borderColor: C.success },
  indicatorLogged: { backgroundColor: C.surface3, borderColor: C.borderLight },
  indicatorEmpty: { backgroundColor: C.surface3, borderColor: C.border, opacity: 0.5 },
  indicatorText: { fontFamily: 'Outfit_700Bold', fontSize: 10 },
  indicatorTextMet: { color: C.success },
  indicatorTextLogged: { color: C.textSecondary },
  indicatorTextEmpty: { color: C.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statCard: {
    minWidth: '45%', flex: 1, backgroundColor: C.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 14, gap: 4,
  },
  statVal: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: C.text },
  statLabel: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%', backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 34, gap: 12,
  },
  modalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  modalSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted, marginTop: -4 },
  modalPickHeader: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.textMuted, marginTop: 4 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  modalOptionSelected: { borderColor: C.primary, backgroundColor: C.primaryBg },
  modalOptionText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary, flex: 1 },
  noTemplatesText: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', padding: 16 },
  modalCancelBtn: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  modalCancelText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary },
});
