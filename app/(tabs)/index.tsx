import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Switch, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { logsRepo, mealsRepo, targetsRepo } from '@/lib/storage';
import { todayYMD, formatDateLong, getMondayYMD } from '@/lib/dates';
import type { DailyLog, MealEntry, WeeklyTarget } from '@/lib/types';

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

  const [log, setLog] = useState<DailyLog | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [target, setTarget] = useState<WeeklyTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [l, m, t] = await Promise.all([
      logsRepo.getByDate(user.id, today),
      mealsRepo.getByDate(user.id, today),
      targetsRepo.getByWeek(user.id, getMondayYMD()),
    ]);
    setLog(l || {
      date: today,
      weightKg: null, sleepHours: null, waterMl: null, steps: null,
      supplementsTaken: null, caloriesManual: null, notes: null,
      updatedAt: new Date().toISOString(),
    });
    setMeals(m);
    setTarget(t);
    setLoading(false);
  }, [user, today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveLog = async (updates: Partial<DailyLog>) => {
    if (!user || !log) return;
    setSaving(true);
    const updated: DailyLog = { ...log, ...updates, updatedAt: new Date().toISOString() };
    await logsRepo.save(user.id, updated);
    setLog(updated);
    setSaving(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startEdit = (field: string, current: any) => {
    setEditField(field);
    setEditValue(current != null ? String(current) : '');
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
    setEditField(null);
    await saveLog(updates);
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
  const allMet = calMet && stepsMet && waterMet;

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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Today</Text>
            <Text style={styles.dateStr}>{formatDateLong(today)}</Text>
          </View>
          {allMet && (
            <View style={styles.starBadge}>
              <Ionicons name="star" size={16} color={C.warning} />
              <Text style={styles.starText}>Star Day</Text>
            </View>
          )}
        </View>

        {target && (
          <View style={styles.targetRow}>
            {[
              { label: 'C', met: calMet, hasData: totalCalories > 0 },
              { label: 'S', met: stepsMet, hasData: !!log?.steps },
              { label: 'W', met: waterMet, hasData: !!log?.waterMl },
            ].map(({ label, met, hasData }) => (
              <View key={label} style={[
                styles.indicatorBadge,
                met ? styles.indicatorMet : hasData ? styles.indicatorLogged : styles.indicatorEmpty,
              ]}>
                <Text style={[
                  styles.indicatorText,
                  met ? styles.indicatorTextMet : hasData ? styles.indicatorTextLogged : styles.indicatorTextEmpty,
                ]}>{label}</Text>
              </View>
            ))}
            {saving && <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 'auto' }} />}
          </View>
        )}

        <Text style={styles.sectionTitle}>Daily Metrics</Text>
        <View style={styles.metricsGrid}>
          <MetricCard icon="scale-outline" label="Weight" value={log?.weightKg != null ? String(log.weightKg) : ''} unit="kg" onPress={() => startEdit('weightKg', log?.weightKg)} />
          <MetricCard icon="moon-outline" label="Sleep" value={log?.sleepHours != null ? String(log.sleepHours) : ''} unit="hrs" onPress={() => startEdit('sleepHours', log?.sleepHours)} />
          <MetricCard icon="water-outline" label="Water" value={log?.waterMl != null ? String(log.waterMl) : ''} unit="ml" onPress={() => startEdit('waterMl', log?.waterMl)} />
          <MetricCard icon="footsteps-outline" label="Steps" value={log?.steps != null ? log.steps.toLocaleString() : ''} unit="steps" onPress={() => startEdit('steps', log?.steps)} />
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

        {editField && editField !== 'notes' && (
          <View style={styles.editCard}>
            <Text style={styles.editLabel}>
              Edit {editField === 'weightKg' ? 'Weight' : editField === 'sleepHours' ? 'Sleep' : editField === 'waterMl' ? 'Water' : 'Steps'}
            </Text>
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
        )}

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
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 24, alignItems: 'center' },
  indicatorBadge: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  indicatorMet: { backgroundColor: C.successBg, borderColor: C.success },
  indicatorLogged: { backgroundColor: C.surface2, borderColor: C.borderLight },
  indicatorEmpty: { backgroundColor: C.surface2, borderColor: C.border, opacity: 0.5 },
  indicatorText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  indicatorTextMet: { color: C.success },
  indicatorTextLogged: { color: C.textSecondary },
  indicatorTextEmpty: { color: C.textMuted },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary, marginBottom: 10, marginTop: 8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metricCard: {
    flex: 1, minWidth: '45%', backgroundColor: C.surface2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 4,
  },
  metricIconWrap: { marginBottom: 4 },
  metricLabel: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: C.text },
  metricUnit: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  supplementRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 24,
  },
  supplementLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  supplementText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary },
  editCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.primary + '60',
    padding: 14, marginBottom: 16, gap: 8,
  },
  editLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
    padding: 16, marginBottom: 24,
  },
  caloriesTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
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
    padding: 14, minHeight: 60,
  },
  notesText: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.textSecondary, flex: 1, lineHeight: 22 },
  notesPlaceholder: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.textMuted, flex: 1 },
});
