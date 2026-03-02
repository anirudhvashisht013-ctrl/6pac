import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { mealsRepo, targetsRepo } from '@/lib/storage';
import { todayYMD, addDays, formatDateLong, toYMD, getMondayYMD } from "@/lib/dates";
import type { ISODate } from "@/lib/models";
import type { MealEntry, WeeklyTarget } from '@/lib/types';

const EMPTY_FORM = {
  mealName: '',
  notes: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
};


function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={mbStyles.container}>
      <View style={mbStyles.labelRow}>
        <Text style={mbStyles.label}>{label}</Text>
        <Text style={mbStyles.value}>{Math.round(value)}g</Text>
      </View>
      <View style={mbStyles.track}>
        <View style={[mbStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const mbStyles = StyleSheet.create({
  container: { gap: 5 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  value: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: C.textSecondary },
  track: { height: 5, backgroundColor: C.surface3, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(todayYMD());
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [target, setTarget] = useState<WeeklyTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const selected = new Date(`${selectedDate}T00:00:00`);
    const weekStart = getMondayYMD(selected);
    const [m, t] = await Promise.all([
      mealsRepo.getByDate(user.id, selectedDate),
      targetsRepo.getByWeek(user.id, weekStart),
    ]);
    setMeals(m);
    setTarget(t);
    setLoading(false);
  }, [user, selectedDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setEditingMeal(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (meal: MealEntry) => {
    setEditingMeal(meal);
    setForm({
      mealName: meal.mealName,
      notes: meal.notes || '',
      calories: meal.calories != null ? String(meal.calories) : '',
      proteinG: meal.proteinG != null ? String(meal.proteinG) : '',
      carbsG: meal.carbsG != null ? String(meal.carbsG) : '',
      fatG: meal.fatG != null ? String(meal.fatG) : '',
    });
    setShowModal(true);
  };

  const saveMeal = async () => {
    if (!user || !form.mealName.trim()) return;
    const now = new Date().toISOString();
    const meal: MealEntry = {
      id: editingMeal?.id || Crypto.randomUUID(),
      date: selectedDate,
      mealName: form.mealName.trim(),
      notes: form.notes.trim() || null,
      calories: parseFloat(form.calories) || null,
      proteinG: parseFloat(form.proteinG) || null,
      carbsG: parseFloat(form.carbsG) || null,
      fatG: parseFloat(form.fatG) || null,
      createdAt: editingMeal?.createdAt || now,
      updatedAt: now,
    };
    await mealsRepo.save(user.id, meal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowModal(false);
    load();
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    await mealsRepo.delete(user.id, id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    load();
  };

  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.proteinG || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbsG || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fatG || 0), 0);

  const today = new Date(); // real Date object
  const dateRange = [-2, -1, 0].map(d =>toYMD(addDays(today, d)));

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
          <Text style={styles.pageTitle}>Nutrition</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={openAdd}
          >
            <Ionicons name="add" size={22} color={C.bg} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
          {dateRange.map(d => (
            <Pressable
              key={d}
              style={[styles.dateChip, d === selectedDate && styles.dateChipActive]}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[styles.dateChipText, d === selectedDate && styles.dateChipTextActive]}>
                {d === todayYMD() ? 'Today' : formatDateLong(d)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryCalories}>{Math.round(totalCalories).toLocaleString()}</Text>
              <Text style={styles.summaryCalLabel}>kcal today</Text>
            </View>
            {target && (
              <View style={styles.summaryTarget}>
                <Text style={styles.summaryTargetNum}>{target.dailyCaloriesTarget.toLocaleString()}</Text>
                <Text style={styles.summaryTargetLabel}>target</Text>
                <View style={[
                  styles.calMetBadge,
                  totalCalories >= target.dailyCaloriesTarget * 0.95 &&
                  totalCalories <= target.dailyCaloriesTarget * 1.05
                    ? styles.calMetBadgeGood : styles.calMetBadgeMiss
                ]}>
                  <Text style={[
                    styles.calMetBadgeText,
                    totalCalories >= target.dailyCaloriesTarget * 0.95 &&
                    totalCalories <= target.dailyCaloriesTarget * 1.05
                      ? styles.calMetBadgeTextGood : styles.calMetBadgeTextMiss
                  ]}>
                    {totalCalories === 0 ? 'No data' :
                      totalCalories >= target.dailyCaloriesTarget * 0.95 &&
                      totalCalories <= target.dailyCaloriesTarget * 1.05 ? 'Met' : 'Off target'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.macroSection}>
            <MacroBar label="Protein" value={totalProtein} max={200} color={C.primary} />
            <MacroBar label="Carbs" value={totalCarbs} max={300} color={C.secondary} />
            <MacroBar label="Fat" value={totalFat} max={80} color={C.accent} />
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Meals</Text>
          <Text style={styles.sectionCount}>{meals.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
        ) : meals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={C.border} />
            <Text style={styles.emptyTitle}>No meals logged</Text>
            <Text style={styles.emptySubtitle}>Track your meals to monitor nutrition</Text>
          </View>
        ) : (
          meals.map(meal => (
            <Pressable
              key={meal.id}
              style={({ pressed }) => [styles.mealCard, pressed && { opacity: 0.85 }]}
              onPress={() => openEdit(meal)}
            >
              <View style={styles.mealCardLeft}>
                <Text style={styles.mealName}>{meal.mealName}</Text>
                {meal.notes ? <Text style={styles.mealNotes} numberOfLines={1}>{meal.notes}</Text> : null}
                <View style={styles.mealMacroRow}>
                  {meal.calories != null && (
                    <Text style={styles.mealCal}>{meal.calories} kcal</Text>
                  )}
                  {meal.proteinG != null && (
                    <Text style={styles.mealMacro}>{meal.proteinG}g P</Text>
                  )}
                  {meal.carbsG != null && (
                    <Text style={styles.mealMacro}>{meal.carbsG}g C</Text>
                  )}
                  {meal.fatG != null && (
                    <Text style={styles.mealMacro}>{meal.fatG}g F</Text>
                  )}
                </View>
              </View>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => deleteMeal(meal.id)}
              >
                <Ionicons name="trash-outline" size={16} color={C.error} />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMeal ? 'Edit Meal' : 'Add Meal'}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGap}>
                {[
                  { key: 'mealName', label: 'Meal name *', placeholder: 'e.g. Breakfast', kbType: 'default' },
                  { key: 'notes', label: 'Notes', placeholder: 'What did you eat?', kbType: 'default' },
                  { key: 'calories', label: 'Calories (kcal)', placeholder: '0', kbType: 'numeric' },
                  { key: 'proteinG', label: 'Protein (g)', placeholder: '0', kbType: 'decimal-pad' },
                  { key: 'carbsG', label: 'Carbs (g)', placeholder: '0', kbType: 'decimal-pad' },
                  { key: 'fatG', label: 'Fat (g)', placeholder: '0', kbType: 'decimal-pad' },
                ].map(({ key, label, placeholder, kbType }) => (
                  <View key={key} style={styles.formField}>
                    <Text style={styles.formLabel}>{label}</Text>
                    <TextInput
                      style={styles.formInput}
                      value={(form as any)[key]}
                      onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                      placeholder={placeholder}
                      placeholderTextColor={C.textMuted}
                      keyboardType={kbType as any}
                    />
                  </View>
                ))}

                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                  onPress={saveMeal}
                >
                  <Text style={styles.saveBtnText}>Save Meal</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  datePicker: { marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 16 },
  dateChip: {
    paddingHorizontal: 16, paddingVertical: 8, marginRight: 8,
    backgroundColor: C.surface2, borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  dateChipActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  dateChipText: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  dateChipTextActive: { color: C.primary },
  summaryCard: {
    backgroundColor: C.surface2, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20, gap: 16,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryCalories: { fontFamily: 'Outfit_700Bold', fontSize: 40, color: C.primary },
  summaryCalLabel: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  summaryTarget: { alignItems: 'flex-end', gap: 4 },
  summaryTargetNum: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.textSecondary },
  summaryTargetLabel: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  calMetBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  calMetBadgeGood: { backgroundColor: C.successBg, borderColor: C.success + '40' },
  calMetBadgeMiss: { backgroundColor: C.warningBg, borderColor: C.warning + '40' },
  calMetBadgeText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11 },
  calMetBadgeTextGood: { color: C.success },
  calMetBadgeTextMiss: { color: C.warning },
  macroSection: { gap: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary },
  sectionCount: {
    backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
    fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.textMuted,
    borderWidth: 1, borderColor: C.border,
  },
  mealCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 8,
  },
  mealCardLeft: { flex: 1, gap: 4 },
  mealName: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.text },
  mealNotes: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  mealMacroRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  mealCal: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.primary },
  mealMacro: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  deleteBtn: { padding: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.textSecondary },
  emptySubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: C.text },
  formGap: { gap: 14, paddingBottom: 40 },
  formField: { gap: 6 },
  formLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  formInput: {
    backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 48, fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text,
  },
  saveBtn: {
    height: 52, borderRadius: 12, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },
});
