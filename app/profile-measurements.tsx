// app/profile-measurements.tsx
import React, { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

import type { BodyMeasurementEntry } from "@/lib/models";
import { presetRange } from "@/lib/ranges";
import { measurementsRepo } from "@/lib/repos/measurementsRepo";

export default function ProfileMeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const measurementRange = useMemo(() => presetRange("1y"), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const m = await measurementsRepo.getRange(user.id, measurementRange.start as any, measurementRange.end as any);
      setMeasurements(m);
    } finally {
      setLoading(false);
    }
  }, [user, measurementRange.start, measurementRange.end]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;

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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
            <Text style={styles.backText}>Profile</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Body Measurements</Text>
          <Pressable
            style={({ pressed }) => [styles.logBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/measurements")}
          >
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={styles.logBtnText}>Log</Text>
          </Pressable>
        </View>

        {!latest ? (
          <View style={styles.noDataCard}>
            <Ionicons name="body-outline" size={32} color={C.border} />
            <Text style={styles.noDataText}>Log measurements twice a month to track changes</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push("/measurements")}>
              <Text style={styles.primaryBtnText}>Log Measurements</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Latest</Text>
                <Text style={styles.cardSub}>{latest.date}</Text>
              </View>

              <View style={styles.grid}>
                {[
                  { label: "Waist", val: latest.waist },
                  { label: "Chest", val: latest.chest },
                  { label: "Shoulders", val: latest.shoulders },
                  { label: "Arms R", val: latest.armsR },
                  { label: "Body Fat", val: latest.bodyFatPercent, unit: "%" },
                ]
                  .filter((i) => i.val != null)
                  .map(({ label, val, unit }) => (
                    <View key={label} style={styles.item}>
                      <Text style={styles.itemVal}>
                        {val}
                        {unit || " cm"}
                      </Text>
                      <Text style={styles.itemLabel}>{label}</Text>
                    </View>
                  ))}
              </View>
            </View>

            <View style={styles.smallNoteCard}>
              <Text style={styles.noteText}>
                Full history UI can come next (timeline, deltas, photos). For now this screen is the dedicated home for measurements.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontFamily: "Outfit_500Medium", fontSize: 12, color: C.textMuted },
  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 18, color: C.text },

  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  logBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.primary },

  card: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
    marginBottom: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  cardTitle: { fontFamily: "Outfit_700Bold", fontSize: 14, color: C.text },
  cardSub: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  item: {
    minWidth: "30%",
    backgroundColor: C.surface3,
    borderRadius: 10,
    padding: 10,
    gap: 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  itemVal: { fontFamily: "Outfit_700Bold", fontSize: 16, color: C.text },
  itemLabel: { fontFamily: "Outfit_400Regular", fontSize: 11, color: C.textMuted },

  noDataCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  noDataText: { fontFamily: "Outfit_400Regular", fontSize: 14, color: C.textMuted, textAlign: "center" },

  primaryBtn: {
    backgroundColor: C.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  primaryBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: C.primary },

  smallNoteCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  noteText: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, lineHeight: 18 },
});