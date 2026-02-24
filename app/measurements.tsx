import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { measurementsRepo } from '@/lib/storage';
import { todayYMD } from '@/lib/dates';
import type { BodyMeasurementEntry } from '@/lib/types';

const MEASUREMENT_FIELDS = [
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'shoulders', label: 'Shoulders', unit: 'cm' },
  { key: 'armsR', label: 'Arms (Right)', unit: 'cm' },
  { key: 'armsL', label: 'Arms (Left)', unit: 'cm' },
  { key: 'thighR', label: 'Thigh (Right)', unit: 'cm' },
  { key: 'thighL', label: 'Thigh (Left)', unit: 'cm' },
  { key: 'bicepsR', label: 'Biceps (Right)', unit: 'cm' },
  { key: 'bicepsL', label: 'Biceps (Left)', unit: 'cm' },
  { key: 'bodyFatPercent', label: 'Body Fat', unit: '%' },
] as const;

type FormValues = Record<string, string>;

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const today = todayYMD();

  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormValues>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      const all = await measurementsRepo.getAll(user.id);
      setEntries(all.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date().toISOString();
    const entry: BodyMeasurementEntry = {
      id: Crypto.randomUUID(),
      date: today,
      waist: parseFloat(form.waist) || null,
      chest: parseFloat(form.chest) || null,
      shoulders: parseFloat(form.shoulders) || null,
      armsR: parseFloat(form.armsR) || null,
      armsL: parseFloat(form.armsL) || null,
      thighR: parseFloat(form.thighR) || null,
      thighL: parseFloat(form.thighL) || null,
      bicepsR: parseFloat(form.bicepsR) || null,
      bicepsL: parseFloat(form.bicepsL) || null,
      bodyFatPercent: parseFloat(form.bodyFatPercent) || null,
      notes: notes.trim() || null,
      createdAt: now,
    };
    await measurementsRepo.save(user.id, entry);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setForm({});
    setNotes('');
    const all = await measurementsRepo.getAll(user.id);
    setEntries(all.sort((a, b) => b.date.localeCompare(a.date)));
    setSaving(false);
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!user) return;
          await measurementsRepo.delete(user.id, id);
          setEntries(prev => prev.filter(e => e.id !== id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    ]);
  };

  const trend = (key: keyof BodyMeasurementEntry) => {
    const vals = entries
      .slice(0, 2)
      .map(e => e[key])
      .filter(v => typeof v === 'number') as number[];
    if (vals.length < 2) return null;
    const diff = vals[0] - vals[1];
    return diff;
  };

  if (loading) {
    return <View style={[styles.centerFlex, { backgroundColor: C.bg }]}><ActivityIndicator color={C.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Body Measurements</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: 60 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Log Today's Measurements</Text>
        <Text style={styles.sectionSub}>Recommended: twice per month</Text>

        <View style={styles.formGrid}>
          {MEASUREMENT_FIELDS.map(({ key, label, unit }) => (
            <View key={key} style={styles.formField}>
              <Text style={styles.formLabel}>{label}</Text>
              <View style={styles.formInputRow}>
                <TextInput
                  style={styles.formInput}
                  value={form[key] || ''}
                  onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                  placeholder="—"
                  placeholderTextColor={C.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.formUnit}>{unit}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notesField}>
          <Text style={styles.formLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any observations..."
            placeholderTextColor={C.textMuted}
            multiline
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={C.bg} /> : (
            <>
              <Ionicons name="checkmark" size={20} color={C.bg} />
              <Text style={styles.saveBtnText}>Save Measurements</Text>
            </>
          )}
        </Pressable>

        {entries.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>History</Text>
            {entries.map((entry, entryIdx) => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyDate}>{entry.date}</Text>
                  <Pressable onPress={() => deleteEntry(entry.id)}>
                    <Ionicons name="trash-outline" size={16} color={C.error} />
                  </Pressable>
                </View>
                <View style={styles.historyGrid}>
                  {MEASUREMENT_FIELDS.map(({ key, label, unit }) => {
                    const val = entry[key as keyof BodyMeasurementEntry];
                    if (val == null) return null;
                    const t = entryIdx === 0 ? trend(key as keyof BodyMeasurementEntry) : null;
                    return (
                      <View key={key} style={styles.historyItem}>
                        <Text style={styles.historyItemVal}>{val}{unit}</Text>
                        {t !== null && (
                          <Text style={[styles.historyItemTrend, { color: t === 0 ? C.textMuted : t > 0 ? C.secondary : C.success }]}>
                            {t > 0 ? '+' : ''}{t.toFixed(1)}
                          </Text>
                        )}
                        <Text style={styles.historyItemLabel}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
                {entry.notes ? <Text style={styles.historyNotes}>{entry.notes}</Text> : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17, color: C.text, marginBottom: 4 },
  sectionSub: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted, marginBottom: 16 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  formField: { width: '47%' },
  formLabel: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: C.textMuted, marginBottom: 6 },
  formInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  formInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, height: 44, fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text,
    textAlign: 'center',
  },
  formUnit: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted, width: 24 },
  notesField: { marginBottom: 16 },
  notesInput: {
    backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12, height: 80,
    fontFamily: 'Outfit_400Regular', fontSize: 15, color: C.text, textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    height: 52, borderRadius: 14, backgroundColor: C.primary, marginBottom: 8,
  },
  saveBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },
  historyCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10, gap: 10,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textSecondary },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyItem: {
    backgroundColor: C.surface3, borderRadius: 10, padding: 10,
    minWidth: '28%', alignItems: 'center', gap: 2,
  },
  historyItemVal: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: C.text },
  historyItemTrend: { fontFamily: 'Outfit_600SemiBold', fontSize: 11 },
  historyItemLabel: { fontFamily: 'Outfit_400Regular', fontSize: 10, color: C.textMuted },
  historyNotes: {
    fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted,
    fontStyle: 'italic', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8,
  },
});
