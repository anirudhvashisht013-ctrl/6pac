import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Switch, ActivityIndicator, RefreshControl, Platform,
  Modal,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { S } from '@/constants/spacing';
import { useAuth } from '@/context/AuthContext';
import { Streak } from '@/components/Streak';
import { logsRepo, mealsRepo, targetsRepo, usersRepo } from '@/lib/storage';
import { todayYMD, formatDateLong, getMondayYMD, addDays, toYMD } from '@/lib/dates';
import { generateWindow, DayWWSS, computeMaxStreakFromLogs, computeCurrentStreak } from '@/lib/streak';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import type { DailyLog, MealEntry, WeeklyTarget } from '@/lib/types';
import type { ISODate } from '@/lib/models';

const WATER_GLASS_ML = 250;
const DEFAULT_WATER_TARGET_ML = 2000;

function MetricCard({
  icon, label, value, unit, onPress,
}: {
  icon: string; label: string; value: string; unit: string; onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.metricCard, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={styles.metricIconWrap}>
        <Ionicons name={icon as any} size={18} color={C.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value || '—'}</Text>
      {value ? <Text style={styles.metricUnit}>{unit}</Text> : null}
    </Pressable>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const today = todayYMD();

  // The day currently being viewed/edited. Defaults to today; can be moved back
  // to surface previously logged days (data is already stored per date).
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isToday = selectedDate === today;

  const [log, setLog] = useState<DailyLog | null>(null);
  // Today's log is tracked separately so the streak strip stays anchored to today
  // even while viewing a past day.
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [target, setTarget] = useState<WeeklyTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // streak data for the top-of-screen UI
  const [streakData, setStreakData] = useState<DayWWSS[]>([]);

  // profile fetched from Firestore (used for account start date etc.)
  const [profile, setProfile] = useState<any | null>(null);

  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // stable human-readable label shown in the modal. Using this prevents
  // the modal label flickering if `editField` changes during async saves.
  const [editLabel, setEditLabel] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // fetch profile so we know when the account was created
    let profileDoc: any | null;
    try {
      profileDoc = await getUserProfile(user.id);
    } catch {
      profileDoc = null;
    }
    setProfile(profileDoc);

    // load the selected day's basic pieces plus a slice of historical logs for streak
    const [l, m, t, allLogs] = await Promise.all([
      logsRepo.getByDate(user.id, selectedDate),
      mealsRepo.getByDate(user.id, selectedDate),
      targetsRepo.getByWeek(user.id, getMondayYMD(selectedDate)),
      logsRepo.getAll(user.id),
    ]);

    setLog(l || {
      date: selectedDate,
      weightKg: null, sleepHours: null, waterMl: null, steps: null,
      supplementsTaken: null, caloriesManual: null, notes: null,
      updatedAt: new Date().toISOString(),
    });
    setTodayLog(allLogs.find((x) => x.date === today) || null);
    setMeals(m);
    setTarget(t);

    // determine the earliest date we should show in the streak
    const accountStart: ISODate = profileDoc?.createdAt
      ? (profileDoc.createdAt.toString().slice(0, 10) as ISODate)
      : today;

    // compute a 30‑day window for the streak UI and clip it at accountStart
    const window = generateWindow(allLogs, 30, today, accountStart);
    setStreakData(window);

    // also compute streak values for storing
    const currentStreak = computeCurrentStreak(window, new Date());
    const maxStreak = computeMaxStreakFromLogs(allLogs);

    // update local user object if stored
    if (user?.id) {
      const cached = await usersRepo.getById(user.id);
      if (cached) {
        cached.currentStreakDays = currentStreak;
        cached.maxStreakDays = maxStreak;
        await usersRepo.save(cached);
      }
    }

    setLoading(false);
  }, [user, today, selectedDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveLog = async (updates: Partial<DailyLog>) => {
    if (!user || !log) return;
    setSaving(true);
    const updated: DailyLog = { ...log, ...updates, updatedAt: new Date().toISOString() };
    await logsRepo.save(user.id, updated);
    setLog(updated);

    // refresh streak window for today / recent days (and filter by account start)
    const all = await logsRepo.getAll(user.id);
    setTodayLog(all.find((x) => x.date === today) || null);
    const accountStart: ISODate = profile?.createdAt
      ? (profile.createdAt.toString().slice(0, 10) as ISODate)
      : today;
    const window = generateWindow(all, 30, today, accountStart);
    setStreakData(window);

    // update streak counters
    const currentStreak = computeCurrentStreak(window, new Date());
    const maxStreak = computeMaxStreakFromLogs(all);
    if (user?.id) {
      // send to server profile
      try {
        await updateUserProfile(user.id, {
          currentStreakDays: currentStreak,
          maxStreakDays: maxStreak,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("streak update failed", e);
      }

      const cached = await usersRepo.getById(user.id);
      if (cached) {
        cached.currentStreakDays = currentStreak;
        cached.maxStreakDays = maxStreak;
        await usersRepo.save(cached);
      }
    }

    setSaving(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const changeWaterBy = async (deltaMl: number) => {
    const current = log?.waterMl || 0;
    const next = Math.max(0, current + deltaMl);
    await saveLog({ waterMl: next });
  };

  const startEdit = (field: string, current: any) => {
    setEditField(field);
    setEditValue(current != null ? String(current) : '');
    setEditLabel(field === 'weightKg' ? 'Weight' : field === 'sleepHours' ? 'Sleep' : field === 'waterMl' ? 'Water' : 'Steps');
  };

  const commitEdit = async () => {
    if (!editField || !log) return;
    const num = parseFloat(editValue);
    const updates: Partial<DailyLog> = {};
    if (editField === 'weightKg') updates.weightKg = isNaN(num) ? null : num;
    else if (editField === 'sleepHours') updates.sleepHours = isNaN(num) ? null : num;
    else if (editField === 'waterMl') updates.waterMl = isNaN(num) ? null : num;
    else if (editField === 'steps') updates.steps = isNaN(num) ? null : Math.round(num);
    else if (editField === 'notes') updates.notes = editValue.trim() || null;
    // await saving before closing the modal to avoid intermediate UI states
    await saveLog(updates);
    setEditField(null);
  };

  const mealCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalCalories = mealCalories + (log?.caloriesManual || 0);
  const mealProtein = meals.reduce((s, m) => s + (m.proteinG || 0), 0);
  const mealCarbs = meals.reduce((s, m) => s + (m.carbsG || 0), 0);
  const mealFat = meals.reduce((s, m) => s + (m.fatG || 0), 0);

  const calMet = target && totalCalories > 0
    ? totalCalories >= target.dailyCaloriesTarget * 0.95 && totalCalories <= target.dailyCaloriesTarget * 1.05
    : false;
  const stepsMet = target && log?.steps ? log.steps >= target.dailyStepsTarget : false;
  const waterMet = target && log?.waterMl ? log.waterMl >= target.dailyWaterMlTarget : false;
  const sleepLogged = log?.sleepHours != null;
  const weightLogged = log?.weightKg != null;
  const allMet = calMet && stepsMet && waterMet;

  const waterTargetMl = target?.dailyWaterMlTarget || DEFAULT_WATER_TARGET_ML;
  const waterCurrentMl = Math.max(0, log?.waterMl || 0);
  const activeWaterGlasses = Math.floor(waterCurrentMl / WATER_GLASS_ML);
  const targetWaterGlasses = Math.max(1, Math.ceil(waterTargetMl / WATER_GLASS_ML));
  const waterGlassSlots = Math.max(targetWaterGlasses, activeWaterGlasses);

  const onWaterGlassPress = async () => {
    if (saving) return;
    await changeWaterBy(WATER_GLASS_ML);
  };

  const onWaterRemove = async () => {
    if (saving || waterCurrentMl <= 0) return;
    await changeWaterBy(-WATER_GLASS_ML);
  };

  const accountStartYMD = profile?.createdAt ? profile.createdAt.toString().slice(0, 10) : null;
  const canGoPrev = !accountStartYMD || selectedDate > accountStartYMD;

  const goPrevDay = () => {
    if (!canGoPrev) return;
    setSelectedDate(toYMD(addDays(new Date(`${selectedDate}T00:00:00`), -1)));
  };
  const goNextDay = () => {
    if (isToday) return;
    const next = toYMD(addDays(new Date(`${selectedDate}T00:00:00`), 1));
    setSelectedDate(next > today ? today : next);
  };

  const headerTitle = isToday
    ? 'Today'
    : new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' });

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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 20), paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Streak data={streakData} today={today} todayLog={todayLog} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{headerTitle}</Text>
            <Text style={styles.dateStr}>{formatDateLong(selectedDate)}</Text>
          </View>
          {allMet && (
            <View style={styles.starBadge}>
              <Ionicons name="star" size={16} color={C.warning} />
              <Text style={styles.starText}>Star Day</Text>
            </View>
          )}
        </View>

        <View style={styles.dateNavRow}>
          <Pressable
            style={({ pressed }) => [
              styles.dateNavBtn,
              !canGoPrev && styles.dateNavBtnDisabled,
              pressed && { opacity: 0.7 },
            ]}
            onPress={goPrevDay}
            disabled={!canGoPrev}
          >
            <Ionicons name="chevron-back" size={18} color={canGoPrev ? C.textSecondary : C.textMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.dateNavToday, isToday && styles.dateNavTodayDisabled, pressed && { opacity: 0.7 }]}
            onPress={() => setSelectedDate(today)}
            disabled={isToday}
          >
            <Text style={[styles.dateNavTodayText, isToday && styles.dateNavTodayTextDisabled]}>
              {isToday ? 'Viewing today' : 'Back to today'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.dateNavBtn,
              isToday && styles.dateNavBtnDisabled,
              pressed && { opacity: 0.7 },
            ]}
            onPress={goNextDay}
            disabled={isToday}
          >
            <Ionicons name="chevron-forward" size={18} color={isToday ? C.textMuted : C.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.targetRow}>
          {[
            { key: 'calories', icon: 'flame-outline', met: calMet, hasData: totalCalories > 0, onPress: () => router.push('/(tabs)/nutrition') },
            { key: 'sleep', icon: 'moon-outline', met: sleepLogged, hasData: sleepLogged, onPress: () => startEdit('sleepHours', log?.sleepHours) },
            { key: 'steps', icon: 'footsteps-outline', met: stepsMet, hasData: !!log?.steps, onPress: () => startEdit('steps', log?.steps) },
            { key: 'water', icon: 'pint-outline', met: waterMet, hasData: !!log?.waterMl, onPress: () => startEdit('waterMl', log?.waterMl) },
            { key: 'weight', icon: 'scale-outline', met: weightLogged, hasData: weightLogged, onPress: () => startEdit('weightKg', log?.weightKg) },
          ].map(({ key, icon, met, hasData, onPress }) => (
            <Pressable
              key={key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.indicatorBadge,
                met ? styles.indicatorMet : hasData ? styles.indicatorLogged : styles.indicatorEmpty,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={icon as any}
                size={16}
                color={met ? C.success : hasData ? C.textSecondary : C.textMuted}
              />
            </Pressable>
          ))}
          {saving && <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 'auto' }} />}
        </View>

        <Text style={styles.sectionTitle}>Daily Metrics</Text>
        <View style={styles.metricsGrid}>
          <MetricCard icon="scale-outline" label="Weight" value={log?.weightKg != null ? String(log.weightKg) : ''} unit="kg" onPress={() => startEdit('weightKg', log?.weightKg)} />
          <MetricCard icon="moon-outline" label="Sleep" value={log?.sleepHours != null ? String(log.sleepHours) : ''} unit="hrs" onPress={() => startEdit('sleepHours', log?.sleepHours)} />
          <MetricCard icon="footsteps-outline" label="Steps" value={log?.steps != null ? log.steps.toLocaleString() : ''} unit="steps" onPress={() => startEdit('steps', log?.steps)} />
        </View>

        <View style={styles.waterCard}>
          <View style={styles.waterCardTop}>
            <View style={styles.waterCardTitleRow}>
              <Ionicons name="pint-outline" size={16} color={C.primary} />
              <Text style={styles.waterCardTitle}>Water Intake</Text>
            </View>
            <View style={styles.waterValueRow}>
              <Text style={styles.waterCardValue}>
                {waterCurrentMl.toLocaleString()} / {waterTargetMl.toLocaleString()} ml
              </Text>
              <Pressable
                onPress={() => { void onWaterRemove(); }}
                disabled={saving || waterCurrentMl <= 0}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.waterMinusBtn,
                  waterCurrentMl <= 0 && styles.waterMinusBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="remove" size={18} color={waterCurrentMl <= 0 ? C.textMuted : C.primary} />
              </Pressable>
            </View>
          </View>
          <View style={styles.glassGrid}>
            {Array.from({ length: waterGlassSlots }).map((_, idx) => {
              const active = idx < activeWaterGlasses;
              return (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.glassSlot,
                    active && styles.glassSlotActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => {
                    void onWaterGlassPress();
                  }}
                >
                  <Ionicons name="pint-outline" size={16} color={active ? C.primary : C.textMuted} />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.waterHint}>Tap a glass to add 250ml. Tap the − button to remove 250ml.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.supplementRow, pressed && { opacity: 0.8 }]}
          onPress={() => saveLog({ supplementsTaken: !log?.supplementsTaken })}
        >
          <View style={styles.supplementLeft}>
            <Ionicons name="medkit-outline" size={18} color={log?.supplementsTaken ? C.success : C.textMuted} />
            <Text style={styles.supplementText}>Supplements taken</Text>
          </View>
          <Switch
            value={!!log?.supplementsTaken}
            onValueChange={(v) => saveLog({ supplementsTaken: v })}
            trackColor={{ false: C.border, true: C.success + '60' }}
            thumbColor={log?.supplementsTaken ? C.success : C.textMuted}
          />
        </Pressable>

        {/* editing numeric daily metrics shown in a modal so UI doesn't jump around */}
        <Modal
          visible={!!editField && editField !== 'notes'}
          transparent
          animationType="fade"
          onRequestClose={() => setEditField(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setEditField(null)}>
            <View style={styles.modalCard}>
              <Text style={styles.editLabel}>Edit {editLabel}</Text>
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="decimal-pad"
                  autoFocus
                  placeholder="Enter value"
                  placeholderTextColor={C.textMuted}
                />
                <Pressable style={styles.editSaveBtn} onPress={commitEdit}>
                  <Ionicons name="checkmark" size={20} color={C.bg} />
                </Pressable>
                <Pressable style={styles.editCancelBtn} onPress={() => setEditField(null)}>
                  <Ionicons name="close" size={20} color={C.textSecondary} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        <Text style={styles.sectionTitle}>Calories</Text>
        <View style={styles.caloriesCard}>
          <View style={styles.caloriesTop}>
            <View>
              <Text style={styles.caloriesTotal}>{totalCalories.toLocaleString()}</Text>
              <Text style={styles.caloriesLabel}>total kcal</Text>
            </View>
            {target && (
              <View style={styles.caloriesTarget}>
                <Text style={styles.caloriesTargetNum}>{target.dailyCaloriesTarget.toLocaleString()}</Text>
                <Text style={styles.caloriesTargetLabel}>target</Text>
              </View>
            )}
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroPill}>
              <Text style={styles.macroNum}>{Math.round(mealProtein)}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={styles.macroNum}>{Math.round(mealCarbs)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={styles.macroNum}>{Math.round(mealFat)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notes</Text>
        {editField === 'notes' ? (
          <View style={styles.editCard}>
            <TextInput
              style={[styles.editInput, { height: 80, textAlignVertical: 'top', padding: 12 }]}
              value={editValue}
              onChangeText={setEditValue}
              multiline
              autoFocus
              placeholder="How did today go?"
              placeholderTextColor={C.textMuted}
            />
            <Pressable style={[styles.editSaveBtn, { marginTop: 8, alignSelf: 'flex-end' }]} onPress={commitEdit}>
              <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.bg }}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.notesCard} onPress={() => startEdit('notes', log?.notes)}>
            <Text style={log?.notes ? styles.notesText : styles.notesPlaceholder}>
              {log?.notes || 'Tap to add notes...'}
            </Text>
            <Ionicons name="pencil-outline" size={16} color={C.textMuted} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16,
  },
  greeting: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text },
  dateStr: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, marginTop: 2 },
  starBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.warningBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.warning + '40',
  },
  starText: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: C.warning },
  dateNavRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  dateNavBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2,
  },
  dateNavBtnDisabled: { opacity: 0.45 },
  dateNavToday: {
    flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2,
  },
  dateNavTodayDisabled: { opacity: 0.6 },
  dateNavTodayText: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.primary },
  dateNavTodayTextDisabled: { color: C.textMuted },
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 24, alignItems: 'center' },
  indicatorBadge: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  indicatorMet: { backgroundColor: C.successBg, borderColor: C.success },
  indicatorLogged: { backgroundColor: C.surface2, borderColor: C.borderLight },
  indicatorEmpty: { backgroundColor: C.surface2, borderColor: C.border, opacity: 0.5 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary, marginBottom: S.xs, marginTop: S.xs },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginBottom: S.sm },
  metricCard: {
    flex: 1, minWidth: '45%', backgroundColor: C.surface2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: S.md, gap: S.xxs,
  },
  metricIconWrap: { marginBottom: 4 },
  metricLabel: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: C.text },
  metricUnit: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  waterCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    gap: 10,
    marginBottom: S.lg,
  },
  waterCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  waterCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waterCardTitle: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.textSecondary },
  waterValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waterCardValue: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.text },
  waterMinusBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterMinusBtnDisabled: {
    borderColor: C.border,
    backgroundColor: C.surface3,
  },
  glassGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  glassSlot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassSlotActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryBg,
  },
  waterHint: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  supplementRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: S.md, marginBottom: S.lg,
  },
  supplementLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  supplementText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary },
  editCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.primary + '60',
    padding: S.md, marginBottom: S.md, gap: S.xs,
  },
  editLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted, marginBottom: S.sm },
  editRow: { flexDirection: 'row', gap: S.xs, alignItems: 'center' },
  editInput: {
    flex: 1, backgroundColor: C.surface3, borderRadius: 10, paddingHorizontal: 12, height: 44,
    fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border,
  },
  editSaveBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  editCancelBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: C.surface3,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
  },
  caloriesCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: S.md, marginBottom: S.lg,
  },
  caloriesTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.md },
  caloriesTotal: { fontFamily: 'Outfit_700Bold', fontSize: 36, color: C.primary },
  caloriesLabel: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  caloriesTarget: { alignItems: 'flex-end' },
  caloriesTargetNum: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.textSecondary },
  caloriesTargetLabel: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  macroRow: { flexDirection: 'row', gap: 8 },
  macroPill: {
    flex: 1, backgroundColor: C.surface3, borderRadius: 10, padding: 10, alignItems: 'center', gap: 2,
  },
  macroNum: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.text },
  macroLabel: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: S.md, minHeight: 60,
  },
  notesText: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.textSecondary, flex: 1, lineHeight: 22 },
  notesPlaceholder: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.textMuted, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    width: '80%', backgroundColor: C.surface2, borderRadius: 14, padding: S.lg,
    borderWidth: 1, borderColor: C.primary + '60', flexDirection: 'column', gap: S.sm,
  },
});
