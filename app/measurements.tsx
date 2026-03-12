// app/measurements.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { C } from "@/constants/colors";
import { S } from "@/constants/spacing";
import { useAuth } from "@/context/AuthContext";
import { useFeedbackToast } from "@/context/FeedbackToastContext";
import {
  buildMeasurementEntryFromForm,
  hydrateMeasurementForm,
  resolveMeasurementDate,
  type MeasurementFormValues,
} from "@/lib/measurements/formMapping";
import { canLogMeasurementDay } from "@/lib/measurements/slots";
import { measurementsRepo } from "@/lib/storage";
import { formatDateCompact, todayYMD } from "@/lib/dates";

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

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useFeedbackToast();
  const params = useLocalSearchParams<{ scheduledYMD?: string }>();

  const scheduledYMD = useMemo(() => {
    return resolveMeasurementDate(params.scheduledYMD, todayYMD());
  }, [params.scheduledYMD]);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MeasurementFormValues>(() => hydrateMeasurementForm(null).form);
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");

  const title = `Log for ${formatDateCompact(scheduledYMD)}`;

  const hydrateExisting = useCallback(async () => {
    if (!user) return;
    const existing = await measurementsRepo.getByDate(user.id, scheduledYMD);
    const hydrated = hydrateMeasurementForm(existing);
    setForm(hydrated.form);
    setBodyFat(hydrated.bodyFat);
    setNotes(hydrated.notes);
  }, [user, scheduledYMD]);

  useFocusEffect(
    useCallback(() => {
      void hydrateExisting();
    }, [hydrateExisting])
  );

  const save = async () => {
    if (!user) return;

    // Prevent future-date logging (your rule: can't add beforehand)
    if (!canLogMeasurementDay(scheduledYMD)) {
      Alert.alert("Too early", "You can log only on the scheduled day (or later if missed).");
      return;
    }

    setSaving(true);

    try {
      const entry = buildMeasurementEntryFromForm({
        date: scheduledYMD,
        form,
        bodyFat,
        notes,
        loggedAt: new Date().toISOString(),
      });

      await measurementsRepo.save(user.id, entry);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: "Measurements saved", tone: "success" });
      router.back();
    } catch {
      showToast({ message: "Unable to save measurements. Please try again.", tone: "error" });
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
                  value={form[key as keyof MeasurementFormValues] || ""}
                  onChangeText={(v) =>
                    setForm((f) => ({
                      ...f,
                      [key]: v,
                    }))
                  }
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
