// app/measurements.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { C } from "@/constants/colors";
import { S } from "@/constants/spacing";
import { useAuth } from "@/context/AuthContext";
import { canLogMeasurementDay } from "@/lib/measurements/slots";
import { measurementsRepo } from "@/lib/repos/measurementsRepo";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";

const CM_PER_IN = 2.54;
const toCm = (inch: number) => inch * CM_PER_IN;
const parseNumberInput = (raw: string): number | null => {
  const cleaned = raw
    .trim()
    .replace(/,/g, ".")         // 34,5 -> 34.5
    .replace(/[^0-9.]/g, "");   // removes "in", spaces, etc.

  if (!cleaned) return null;

  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

const MEASUREMENT_FIELDS = [
  { key: "waist", label: "Waist" },
  { key: "chest", label: "Chest" },
  { key: "shoulders", label: "Shoulders" },
  { key: "armsR", label: "Arms (Right)" },
  { key: "armsL", label: "Arms (Left)" },
  { key: "thighR", label: "Thigh (Right)" },
  { key: "thighL", label: "Thigh (Left)" },
  { key: "bicepsR", label: "Biceps (Right)" },
  { key: "bicepsL", label: "Biceps (Left)" },
] as const;

type FormValues = Record<string, string>;

function isISODate(v: string): v is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ scheduledYMD?: string }>();

  const scheduledYMD = useMemo(() => {
    const raw = (params.scheduledYMD || "").trim();
    if (!raw) return null;
    if (!isISODate(raw)) return null;
    return raw as ISODate;
  }, [params.scheduledYMD]);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormValues>({});
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");

  const title = scheduledYMD ? `Log for ${scheduledYMD}` : "Log Measurements";

  const save = async () => {
    if (!user) return;

    if (!scheduledYMD) {
      Alert.alert(
        "Missing date",
        "Open this screen from Body Measurements so a 15-day slot date is selected."
      );
      return;
    }

    // Prevent future-date logging (your rule: can't add beforehand)
    if (!canLogMeasurementDay(scheduledYMD)) {
      Alert.alert("Too early", "You can log only on the scheduled day (or later if missed).");
      return;
    }

    setSaving(true);

    try {
      const entry: BodyMeasurementEntry = {
        schemaVersion: 1,
        date: scheduledYMD,

        waist: (() => {
          const v = parseNumberInput(form.waist || "");
          return v == null ? null : toCm(v);
        })(),

        chest: (() => {
          const v = parseNumberInput(form.chest || "");
          return v == null ? null : toCm(v);
        })(),

        shoulders: (() => {
          const v = parseNumberInput(form.shoulders || "");
          return v == null ? null : toCm(v);
        })(),

        armsR: (() => {
          const v = parseNumberInput(form.armsR || "");
          return v == null ? null : toCm(v);
        })(),

        armsL: (() => {
          const v = parseNumberInput(form.armsL || "");
          return v == null ? null : toCm(v);
        })(),

        thighR: (() => {
          const v = parseNumberInput(form.thighR || "");
          return v == null ? null : toCm(v);
        })(),

        thighL: (() => {
          const v = parseNumberInput(form.thighL || "");
          return v == null ? null : toCm(v);
        })(),

        bicepsR: (() => {
          const v = parseNumberInput(form.bicepsR || "");
          return v == null ? null : toCm(v);
        })(),

        bicepsL: (() => {
          const v = parseNumberInput(form.bicepsL || "");
          return v == null ? null : toCm(v);
        })(),

        bodyFatPercent: (() => {
          const v = parseNumberInput(bodyFat);
          return v == null ? null : v;
        })(),

        notes: notes.trim() || null,
        loggedAt: new Date().toISOString(),
      };

      await measurementsRepo.upsert(user.id, entry);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      if (Platform.OS === "web") window.alert("Save failed. Please try again.");
      else Alert.alert("Save failed", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Measurements (inches)</Text>
        <Text style={styles.sectionSub}>
          Slots are every 15 days. Log around the same time each cycle.
        </Text>

        <View style={styles.formGrid}>
          {MEASUREMENT_FIELDS.map(({ key, label }) => (
            <View key={key} style={styles.formField}>
              <Text style={styles.formLabel}>{label}</Text>
              <View style={styles.formInputRow}>
                <TextInput
                  style={styles.formInput}
                  value={form[key] || ""}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  placeholder="—"
                  placeholderTextColor={C.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.formUnit}>in</Text>
              </View>
            </View>
          ))}

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Body Fat</Text>
            <View style={styles.formInputRow}>
              <TextInput
                style={styles.formInput}
                value={bodyFat}
                onChangeText={setBodyFat}
                placeholder="—"
                placeholderTextColor={C.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.formUnit}>%</Text>
            </View>
          </View>
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
          {saving ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={C.bg} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Outfit_700Bold", fontSize: 16, color: C.text },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  sectionTitle: { fontFamily: "Outfit_600SemiBold", fontSize: 17, color: C.text, marginBottom: S.xxs },
  sectionSub: { fontFamily: "Outfit_400Regular", fontSize: 13, color: C.textMuted, marginBottom: S.lg },

  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginBottom: S.lg },
  formField: { width: "47%" },
  formLabel: { fontFamily: "Outfit_500Medium", fontSize: 12, color: C.textMuted, marginBottom: S.xxs },
  formInputRow: { flexDirection: "row", alignItems: "center", gap: S.xs },
  formInput: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    color: C.text,
    textAlign: "center",
  },
  formUnit: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, width: 22 },

  notesField: { marginBottom: S.lg },
  notesInput: {
    backgroundColor: C.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    height: 80,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: C.text,
    textAlignVertical: "top",
  },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    height: 52,
    borderRadius: 14,
    backgroundColor: C.primary,
    marginBottom: 8,
  },
  saveBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 16, color: C.bg },
});
