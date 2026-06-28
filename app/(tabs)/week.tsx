import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFeedbackToast } from '@/context/FeedbackToastContext';
import {
  schedulesRepo, targetsRepo, logsRepo, mealsRepo,
  workoutsRepo, sessionsRepo,
} from '@/lib/storage';
import {
  todayYMD,
  getWeekDates,
  getMondayYMD,
  formatDateLong,
  addDays,
  toYMD,
} from "@/lib/dates";
import type { ISODate } from "@/lib/models";
import type {
  WeekSchedule, WeeklyTarget, PlannedDay, WorkoutTemplate,
  DailyLog, MealEntry, WorkoutSession,
} from '@/lib/types';

const WORKOUTS_PER_WEEK_TARGET = 6;

type EditingTarget = {
  dailyCaloriesTarget: string;
  dailyStepsTarget: string;
  dailyWaterMlTarget: string;
  targetWeightKg: string;
  weightGoalType: 'lose' | 'gain' | 'maintain';
};

type WeekSummary = {
  avgWeightKg: number | null;
  avgCalories: number | null;
  avgSleepHours: number | null;
  avgSteps: number | null;
  avgWaterMl: number | null;
  workoutsCompleted: number;
  targetCalories: number | null;
  targetSteps: number | null;
  targetWaterMl: number | null;
  targetWeightKg: number | null;
};

type DayStatus = 'planned_workout' | 'rest' | 'unplanned';

function DayCard({
  day, template, log, meals, target, sessions, onPress,
}: {
  day: PlannedDay;
  template: WorkoutTemplate | null;
  log: DailyLog | null;
  meals: MealEntry[];
  target: WeeklyTarget | null;
  sessions: WorkoutSession[];
  onPress: () => void;
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
  const missedWorkout =
    day.status === 'planned_workout' &&
    !future &&
    !isToday &&
    !sessionCompleted;

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
            { key: 'calories', icon: 'flame-outline', met: calMet, hasData: calHasData },
            { key: 'steps', icon: 'footsteps-outline', met: stepsMet, hasData: stepsHasData },
            { key: 'water', icon: 'pint-outline', met: waterMet, hasData: waterHasData },
          ].map(({ key, icon, met, hasData }) => (
            <View key={key} style={[
              styles.indicator,
              met ? styles.indicatorMet : hasData ? styles.indicatorLogged : styles.indicatorEmpty,
            ]}>
              <Ionicons
                name={icon as any}
                size={14}
                color={met ? C.success : hasData ? C.textSecondary : C.textMuted}
              />
            </View>
          ))}
        </View>
      )}

      {missedWorkout ? <Text style={styles.missedWorkoutText}>Missed workout</Text> : null}
    </Pressable>
  );
}

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useFeedbackToast();
  const today = todayYMD();
  const currentWeekStart = getMondayYMD(today);
  const latestPlanningWeekStart = toYMD(addDays(new Date(`${currentWeekStart}T00:00:00`), 7 * 5));

  const [weekStart, setWeekStart] = useState<ISODate>(currentWeekStart);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allSchedules, setAllSchedules] = useState<WeekSchedule[]>([]);
  const [allTargets, setAllTargets] = useState<WeeklyTarget[]>([]);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [allMeals, setAllMeals] = useState<MealEntry[]>([]);
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState(false);
  const [tooltipWeekStart, setTooltipWeekStart] = useState<ISODate | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [weekWrapSize, setWeekWrapSize] = useState({ width: 0, height: 0 });
  const weekWrapRef = useRef<View | null>(null);
  const weekChipRefs = useRef<Record<string, View | null>>({});
  const [targetForm, setTargetForm] = useState<EditingTarget>({
    dailyCaloriesTarget: '2400',
    dailyStepsTarget: '8000',
    dailyWaterMlTarget: '2500',
    targetWeightKg: '',
    weightGoalType: 'maintain',
  });
  const [selectDayModal, setSelectDayModal] = useState<{ day: PlannedDay; idx: number } | null>(null);
  const [workoutSearch, setWorkoutSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [schedules, targets, tmpl, logs, meals, sessions] = await Promise.all([
      schedulesRepo.getAll(user.id),
      targetsRepo.getAll(user.id),
      workoutsRepo.getAll(user.id),
      logsRepo.getAll(user.id),
      mealsRepo.getAll(user.id),
      sessionsRepo.getAll(user.id),
    ]);

    setAllSchedules(schedules);
    setAllTargets(targets);
    setTemplates(tmpl);
    setAllLogs(logs);
    setAllMeals(meals);
    setAllSessions(sessions);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!selectDayModal) setWorkoutSearch('');
  }, [selectDayModal]);

  const bounds = useMemo(() => {
    let first: ISODate | null = null;
    let latest: ISODate | null = null;

    const includeWeek = (weekDate: ISODate) => {
      if (!first || weekDate < first) first = weekDate;
      if (!latest || weekDate > latest) latest = weekDate;
    };

    allLogs.forEach((log) => includeWeek(getMondayYMD(log.date as ISODate)));
    allMeals.forEach((meal) => includeWeek(getMondayYMD(meal.date as ISODate)));
    allSessions.forEach((session) => includeWeek(getMondayYMD(session.date as ISODate)));
    allTargets.forEach((tgt) => includeWeek(tgt.weekStartDate as ISODate));
    allSchedules.forEach((sched) => includeWeek(sched.weekStartDate as ISODate));
    includeWeek(currentWeekStart);
    includeWeek(latestPlanningWeekStart);

    return {
      firstDataWeekStart: first || currentWeekStart,
      latestDataWeekStart: latest || currentWeekStart,
    };
  }, [allLogs, allMeals, allSessions, allTargets, allSchedules, currentWeekStart, latestPlanningWeekStart]);

  const firstDataWeekStart = bounds.firstDataWeekStart;
  const latestDataWeekStart = bounds.latestDataWeekStart;

  useEffect(() => {
    if (weekStart < firstDataWeekStart) {
      setWeekStart(firstDataWeekStart);
      return;
    }
    if (weekStart > latestDataWeekStart) {
      setWeekStart(latestDataWeekStart);
    }
  }, [weekStart, firstDataWeekStart, latestDataWeekStart]);

  const weekTabs = useMemo(
    () => listWeekStarts(firstDataWeekStart, latestDataWeekStart),
    [firstDataWeekStart, latestDataWeekStart]
  );

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekDateSet = useMemo(() => new Set<ISODate>(weekDates), [weekDates]);

  const schedule = useMemo<WeekSchedule>(() => {
    const existing = allSchedules.find((s) => s.weekStartDate === weekStart);
    if (existing) return existing;
    return {
      weekStartDate: weekStart,
      days: weekDates.map((date) => ({ date, status: 'unplanned', workoutTemplateId: null })),
    };
  }, [allSchedules, weekDates, weekStart]);

  const target = useMemo<WeeklyTarget | null>(
    () => allTargets.find((t) => t.weekStartDate === weekStart) || null,
    [allTargets, weekStart]
  );

  useEffect(() => {
    if (target) {
      setTargetForm({
        dailyCaloriesTarget: String(target.dailyCaloriesTarget),
        dailyStepsTarget: String(target.dailyStepsTarget),
        dailyWaterMlTarget: String(target.dailyWaterMlTarget),
        targetWeightKg: target.targetWeightKg != null ? String(target.targetWeightKg) : '',
        weightGoalType: target.weightGoalType,
      });
      return;
    }
    setTargetForm({
      dailyCaloriesTarget: '2400',
      dailyStepsTarget: '8000',
      dailyWaterMlTarget: '2500',
      targetWeightKg: '',
      weightGoalType: 'maintain',
    });
  }, [target]);

  const logs = useMemo(() => allLogs.filter((l) => weekDateSet.has(l.date as ISODate)), [allLogs, weekDateSet]);
  const meals = useMemo(() => allMeals.filter((m) => weekDateSet.has(m.date as ISODate)), [allMeals, weekDateSet]);
  const sessions = useMemo(
    () => allSessions.filter((s) => weekDateSet.has(s.date as ISODate)),
    [allSessions, weekDateSet]
  );

  const weekSummaries = useMemo(() => {
    const summaries = new Map<ISODate, WeekSummary>();
    const targetByWeek = new Map(allTargets.map((t) => [t.weekStartDate as ISODate, t] as const));

    for (const ws of weekTabs) {
      const dates = getWeekDates(ws);
      const datesSet = new Set<ISODate>(dates);
      const weekLogs = allLogs.filter((l) => datesSet.has(l.date as ISODate));
      const weekMeals = allMeals.filter((m) => datesSet.has(m.date as ISODate));
      const weekCompletedSessions = allSessions.filter((s) => datesSet.has(s.date as ISODate) && s.completed);

      const caloriesByDate = new Map<ISODate, number>();
      for (const meal of weekMeals) {
        if (typeof meal.calories !== 'number') continue;
        const date = meal.date as ISODate;
        caloriesByDate.set(date, (caloriesByDate.get(date) || 0) + meal.calories);
      }
      for (const log of weekLogs) {
        if (typeof log.caloriesManual !== 'number') continue;
        const date = log.date as ISODate;
        caloriesByDate.set(date, (caloriesByDate.get(date) || 0) + log.caloriesManual);
      }

      const weekTarget = targetByWeek.get(ws) || null;
      const targetWeightKg = weekTarget?.targetWeightKg ?? null;

      summaries.set(ws, {
        avgWeightKg: average(weekLogs.map((l) => l.weightKg).filter(isNumber)),
        avgCalories: average(Array.from(caloriesByDate.values())),
        avgSleepHours: average(weekLogs.map((l) => l.sleepHours).filter(isNumber)),
        avgSteps: average(weekLogs.map((l) => l.steps).filter(isNumber)),
        avgWaterMl: average(weekLogs.map((l) => l.waterMl).filter(isNumber)),
        workoutsCompleted: Math.min(weekCompletedSessions.length, WORKOUTS_PER_WEEK_TARGET),
        targetCalories: weekTarget?.dailyCaloriesTarget ?? null,
        targetSteps: weekTarget?.dailyStepsTarget ?? null,
        targetWaterMl: weekTarget?.dailyWaterMlTarget ?? null,
        targetWeightKg,
      });
    }

    return summaries;
  }, [allLogs, allMeals, allSessions, allTargets, weekTabs]);

  const activeWeekSummary = weekSummaries.get(weekStart) || null;
  const tooltipSummary = tooltipWeekStart ? weekSummaries.get(tooltipWeekStart) || null : null;
  const isCompletedWeek = useCallback(
    (ws: ISODate) => ws < currentWeekStart,
    [currentWeekStart]
  );

  const positionTooltipForWeek = useCallback((ws: ISODate) => {
    const wrap = weekWrapRef.current as any;
    const chip = weekChipRefs.current[ws] as any;
    if (!wrap || !chip || typeof chip.measureLayout !== 'function') return;

    chip.measureLayout(
      wrap,
      (x: number, y: number, w: number, h: number) => {
        setTooltipAnchor({ x, y, w, h });
      },
      () => {
        // no-op
      }
    );
  }, []);
  const selectedTabIndex = weekTabs.indexOf(weekStart);
  const canGoPrevious = selectedTabIndex > 0;
  const canGoNext = selectedTabIndex >= 0 && selectedTabIndex < weekTabs.length - 1;
  const unplannedCount = schedule.days.filter((d) => d.status === 'unplanned').length;
  const isWeekReady = unplannedCount === 0;

  const saveTarget = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const tgt: WeeklyTarget = {
      weekStartDate: weekStart,
      dailyCaloriesTarget: parseInt(targetForm.dailyCaloriesTarget) || 2000,
      dailyStepsTarget: parseInt(targetForm.dailyStepsTarget) || 8000,
      dailyWaterMlTarget: parseInt(targetForm.dailyWaterMlTarget) || 2000,
      targetWeightKg: parseOptionalNumber(targetForm.targetWeightKg),
      weightGoalType: targetForm.weightGoalType,
      createdAt: target?.createdAt || now,
      updatedAt: now,
    };
    await targetsRepo.save(user.id, tgt);
    setAllTargets((prev) => upsertByWeek(prev, tgt));
    setEditingTarget(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast({ message: 'Weekly targets saved', tone: 'success' });
  };

  const updateDayStatus = async (idx: number, status: DayStatus, workoutTemplateId: string | null = null) => {
    if (!user) return;
    const newDays = [...schedule.days];
    newDays[idx] = { ...newDays[idx], status, workoutTemplateId };
    const newSchedule: WeekSchedule = { ...schedule, days: newDays };
    await schedulesRepo.save(user.id, newSchedule);
    setAllSchedules((prev) => upsertByWeek(prev, newSchedule));
    setSelectDayModal(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({ message: 'Day plan saved', tone: 'success' });
  };

  const handleDayPress = (day: PlannedDay, idx: number) => {
    setSelectDayModal({ day, idx });
  };

  const getLog = (date: string) => logs.find(l => l.date === date) || null;
  const getMealsForDate = (date: string) => meals.filter(m => m.date === date);
  const getTemplate = (id: string | null) => id ? templates.find(t => t.id === id) || null : null;
  const getSessionsForDate = (date: string) => sessions.filter(s => s.date === date);
  const filteredTemplates = useMemo(
    () => templates.filter((template) => matchesTemplateSearch(template, workoutSearch)),
    [templates, workoutSearch]
  );

  const weeklyStats = {
    workoutsPlanned: schedule.days.filter((d) => d.status === 'planned_workout').length,
    workoutsCompleted: activeWeekSummary?.workoutsCompleted || 0,
    avgCalories: activeWeekSummary?.avgCalories || 0,
    avgSteps: activeWeekSummary?.avgSteps || 0,
    weightChange: (() => {
      const wLogs = logs.filter(l => l.weightKg).sort((a, b) => a.date.localeCompare(b.date));
      if (wLogs.length < 2) return null;
      return (wLogs[wLogs.length - 1].weightKg! - wLogs[0].weightKg!);
    })(),
  };

  const goToPreviousWeek = () => {
    if (!canGoPrevious) return;
    setWeekStart(weekTabs[selectedTabIndex - 1]);
  };

  const goToNextWeek = () => {
    if (!canGoNext) return;
    setWeekStart(weekTabs[selectedTabIndex + 1]);
  };

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

        <View style={styles.weekNavRow}>
          <Pressable
            style={({ pressed }) => [
              styles.weekJumpBtn,
              weekStart === firstDataWeekStart && styles.weekJumpBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setWeekStart(firstDataWeekStart)}
            disabled={weekStart === firstDataWeekStart}
          >
            <Text style={styles.weekJumpBtnText}>First week</Text>
          </Pressable>
          <View style={styles.weekQuickNav}>
            <Pressable
              style={({ pressed }) => [
                styles.weekArrowBtn,
                !canGoPrevious && styles.weekArrowBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={goToPreviousWeek}
              disabled={!canGoPrevious}
            >
              <Ionicons name="chevron-back" size={16} color={canGoPrevious ? C.textSecondary : C.textMuted} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.weekJumpBtn,
                weekStart === currentWeekStart && styles.weekJumpBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setWeekStart(currentWeekStart)}
              disabled={weekStart === currentWeekStart}
            >
              <Text style={styles.weekJumpBtnText}>This week</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.weekArrowBtn,
                !canGoNext && styles.weekArrowBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={goToNextWeek}
              disabled={!canGoNext}
            >
              <Ionicons name="chevron-forward" size={16} color={canGoNext ? C.textSecondary : C.textMuted} />
            </Pressable>
          </View>
        </View>

        <View
          ref={weekWrapRef}
          style={styles.weekSelectorWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setWeekWrapSize({ width, height });
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekSelector}>
            {weekTabs.map((ws) => {
              const isCurrent = ws === weekStart;
              const isThisWeek = ws === currentWeekStart;
              const canShowTooltip = isCompletedWeek(ws);
              return (
                <View
                  key={ws}
                  ref={(node) => {
                    weekChipRefs.current[ws] = node;
                  }}
                  collapsable={false}
                >
                  <Pressable
                    style={[styles.weekSlot, isCurrent && styles.weekSlotActive]}
                    onPress={() => {
                      setWeekStart(ws);
                      if (Platform.OS !== 'web') {
                        setTooltipWeekStart((prev) => {
                          if (!canShowTooltip) return null;
                          const next = prev === ws ? null : ws;
                          if (next) {
                            setTimeout(() => positionTooltipForWeek(ws), 0);
                          }
                          return next;
                        });
                      }
                    }}
                    onHoverIn={
                      Platform.OS === 'web'
                        ? () => {
                            if (!canShowTooltip) {
                              setTooltipWeekStart(null);
                              return;
                            }
                            setTooltipWeekStart(ws);
                            setTimeout(() => positionTooltipForWeek(ws), 0);
                          }
                        : undefined
                    }
                    onHoverOut={
                      Platform.OS === 'web'
                        ? () => setTooltipWeekStart((prev) => (prev === ws ? null : prev))
                        : undefined
                    }
                  >
                    <Text style={[styles.weekSlotMonth, isCurrent && styles.weekSlotTextActive]}>
                      {monthYearLabel(ws)}
                    </Text>
                    <Text style={[styles.weekSlotNum, isCurrent && styles.weekSlotTextActive]}>
                      W{getWeekNumber(ws)}
                    </Text>
                    {isThisWeek && <View style={styles.currentDot} />}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          {tooltipSummary && tooltipWeekStart && isCompletedWeek(tooltipWeekStart) && tooltipAnchor ? (
            <View
              pointerEvents="none"
              style={[
                styles.weekTooltipBubble,
                (() => {
                  const TOOLTIP_WIDTH = 300;
                  const TOOLTIP_HEIGHT = 34;
                  const SPACING = 8;
                  const EDGE = 6;

                  const rightLeft = tooltipAnchor.x + tooltipAnchor.w + SPACING;
                  const rightFits = rightLeft + TOOLTIP_WIDTH <= weekWrapSize.width - EDGE;

                  if (rightFits) {
                    const yCentered = tooltipAnchor.y + tooltipAnchor.h / 2 - TOOLTIP_HEIGHT / 2;
                    const top = Math.max(0, Math.min(yCentered, Math.max(0, weekWrapSize.height - TOOLTIP_HEIGHT)));
                    return {
                      width: TOOLTIP_WIDTH,
                      left: rightLeft,
                      top,
                    };
                  }

                  const centered = tooltipAnchor.x + tooltipAnchor.w / 2 - TOOLTIP_WIDTH / 2;
                  const left = Math.max(EDGE, Math.min(centered, Math.max(EDGE, weekWrapSize.width - TOOLTIP_WIDTH - EDGE)));
                  const top = Math.max(0, tooltipAnchor.y - TOOLTIP_HEIGHT - SPACING);

                  return {
                    width: TOOLTIP_WIDTH,
                    left,
                    top,
                  };
                })(),
              ]}
            >
              <Text style={styles.weekTooltipBubbleText}>
                {`W${getWeekNumber(tooltipWeekStart!)} • ${formatMetricWithTarget(tooltipSummary.avgCalories, tooltipSummary.targetCalories)} kcal • ${formatMetricWithTarget(tooltipSummary.avgSteps, tooltipSummary.targetSteps)} steps • ${formatMetric(tooltipSummary.avgSleepHours, 1)}h`}
              </Text>
            </View>
          ) : null}
        </View>

        {!isWeekReady && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={C.textSecondary} />
            <Text style={styles.infoBannerText}>
              {unplannedCount} day{unplannedCount !== 1 ? 's' : ''} still unplanned. Planned days can start workouts.
            </Text>
          </View>
        )}

        {isWeekReady && (
          <View style={styles.readyBanner}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={styles.readyText}>Week fully planned</Text>
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
              { key: 'targetWeightKg', label: 'Target Weight', unit: 'kg', kbType: 'decimal-pad' },
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
              { label: 'Weight', val: target.targetWeightKg ?? null, unit: 'kg', icon: 'scale-outline' },
            ].map(({ label, val, unit, icon }) => (
              <View key={label} style={styles.targetCard}>
                <Ionicons name={icon as any} size={16} color={C.primary} />
                <Text style={styles.targetCardVal}>
                  {typeof val === 'number' ? formatMetric(val, unit === 'kg' ? 1 : 0) : '—'}
                </Text>
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
          schedule.days.map((day, idx) => (
            <DayCard
              key={day.date}
              day={day}
              template={getTemplate(day.workoutTemplateId)}
              log={getLog(day.date)}
              meals={getMealsForDate(day.date)}
              target={target}
              sessions={getSessionsForDate(day.date)}
              onPress={() => handleDayPress(day, idx)}
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
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectDayModal(null)} />
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
            <View style={styles.modalSearchWrap}>
              <Ionicons name="search" size={16} color={C.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                value={workoutSearch}
                onChangeText={setWorkoutSearch}
                placeholder="Search by name or notes"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {templates.length === 0 ? (
              <Text style={styles.noTemplatesText}>No templates yet — create one in Workouts</Text>
            ) : filteredTemplates.length === 0 ? (
              <Text style={styles.noSearchResultsText}>No workouts match your search.</Text>
            ) : (
              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {filteredTemplates.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[
                      styles.modalOption,
                      selectDayModal?.day.workoutTemplateId === t.id && styles.modalOptionSelected,
                    ]}
                    onPress={() => selectDayModal && updateDayStatus(selectDayModal.idx, 'planned_workout', t.id)}
                  >
                    <MaterialCommunityIcons name="dumbbell" size={18} color={C.primary} />
                    <View style={styles.modalOptionBody}>
                      <Text style={styles.modalOptionText}>{t.name}</Text>
                      {!!t.notes?.trim() && (
                        <Text style={styles.modalOptionMeta} numberOfLines={2}>
                          {t.notes.trim()}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable style={styles.modalCancelBtn} onPress={() => setSelectDayModal(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function isFuture(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d.getTime() > t.getTime();
}

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function formatDate(date: string) {
  // reuse the shared formatter
  return formatDateLong(date as ISODate);
}

function monthYearLabel(weekStart: ISODate) {
  const d = new Date(`${weekStart}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function listWeekStarts(startWeek: ISODate, endWeek: ISODate): ISODate[] {
  const list: ISODate[] = [];
  const end = new Date(`${endWeek}T00:00:00`);
  let cursor = new Date(`${startWeek}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    list.push(toYMD(cursor));
    cursor = addDays(cursor, 7);
  }

  return list;
}

function upsertByWeek<T extends { weekStartDate: string }>(items: T[], nextItem: T): T[] {
  const idx = items.findIndex((item) => item.weekStartDate === nextItem.weekStartDate);
  if (idx === -1) return [...items, nextItem];
  const next = [...items];
  next[idx] = nextItem;
  return next;
}

function isNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseOptionalNumber(value: string): number | null {
  const clean = value.trim();
  if (!clean) return null;
  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesTemplateSearch(template: WorkoutTemplate, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${template.name} ${template.notes || ''}`.toLowerCase();
  return haystack.includes(q);
}

function formatMetric(value: number | null, decimals = 0) {
  if (value === null) return '—';
  if (decimals > 0) return value.toFixed(decimals);
  return Math.round(value).toLocaleString();
}

function formatMetricWithTarget(avg: number | null, target: number | null, decimals = 0) {
  const avgText = formatMetric(avg, decimals);
  if (target === null) return avgText;
  const targetText = formatMetric(target, decimals);
  return `${avgText}/${targetText}`;
}

// ISO week number (standard-ish)
function getWeekNumber(weekStart: ISODate) {
  const d = new Date(`${weekStart}T00:00:00`);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text, marginBottom: 16 },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  weekQuickNav: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  weekJumpBtn: {
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekJumpBtnDisabled: { opacity: 0.45 },
  weekJumpBtnText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textSecondary },
  weekArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekArrowBtnDisabled: { opacity: 0.45 },
  weekSelectorWrap: { position: 'relative', marginBottom: 16 },
  weekSelector: { marginHorizontal: -20, paddingHorizontal: 20 },
  weekSlot: {
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
    backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', minWidth: 82,
  },
  weekSlotActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  weekSlotMonth: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  weekSlotNum: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: C.textSecondary },
  weekSlotTextActive: { color: C.primary },
  currentDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 4,
  },
  weekTooltipBubble: {
    position: 'absolute',
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weekTooltipBubbleText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: C.textSecondary,
  },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface3, borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  infoBannerText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.textSecondary, flex: 1 },
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
  missedWorkoutText: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: C.error, marginTop: 2 },
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
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%', backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '88%', padding: 20, paddingBottom: 34, gap: 12,
  },
  modalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  modalSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted, marginTop: -4 },
  modalPickHeader: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.textMuted, marginTop: 4 },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    height: 46,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: C.text,
  },
  modalList: {
    maxHeight: 300,
  },
  modalListContent: {
    gap: 8,
    paddingVertical: 2,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalOptionSelected: { borderColor: C.primary, backgroundColor: C.primaryBg },
  modalOptionBody: { flex: 1, gap: 2 },
  modalOptionText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary, flex: 1 },
  modalOptionMeta: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  noTemplatesText: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', padding: 16 },
  noSearchResultsText: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', padding: 16 },
  modalCancelBtn: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  modalCancelText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary },
});
