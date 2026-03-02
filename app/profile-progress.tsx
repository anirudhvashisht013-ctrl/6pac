// app/profile-progress.tsx
import React, { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { useFocusEffect, router } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

import type { DailySnapshot } from "@/lib/models";
import { presetRange } from "@/lib/ranges";
import { toSeries, compactSeries } from "@/lib/series";
import { movingAverage, linearTrend } from "@/lib/trends";
import { daysRepo } from "@/lib/repos/daysRepo";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 140;

function LineChart({ data, color, min, max }: { data: { x: number; y: number }[]; color: string; min: number; max: number }) {
  if (data.length < 2) return null;
  const range = max - min || 1;
  const points = data.map((p) => ({
    px: (p.x / (data.length - 1)) * CHART_W,
    py: CHART_H - ((p.y - min) / range) * CHART_H,
  }));

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(" ");

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <Circle key={i} cx={p.px} cy={p.py} r={4} fill={color} />)}
    </Svg>
  );
}

function AdherenceBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={adhStyles.container}>
      <View style={adhStyles.labelRow}>
        <Text style={adhStyles.label}>{label}</Text>
        <Text style={adhStyles.pct}>{Math.round(pct)}%</Text>
      </View>
      <View style={adhStyles.track}>
        <View style={[adhStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const adhStyles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontFamily: "Outfit_500Medium", fontSize: 14, color: C.textSecondary },
  pct: { fontFamily: "Outfit_700Bold", fontSize: 14, color: C.text },
  track: { height: 8, backgroundColor: C.surface3, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});

function trendBadge(direction: string, perWeek: number | null) {
  if (direction === "insufficient_data") return "Not enough data";
  if (direction === "flat") return "Stable";
  const arrow = direction === "up" ? "↑" : "↓";
  if (perWeek == null) return `${arrow} Trend`;
  const sign = perWeek >= 0 ? "+" : "";
  return `${arrow} ${sign}${perWeek.toFixed(2)}/week`;
}

export default function ProfileProgressScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [days, setDays] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => presetRange("3m"), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const d = await daysRepo.getRange(user.id, range.start as any, range.end as any);
      setDays(d);
    } finally {
      setLoading(false);
    }
  }, [user, range.start, range.end]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weightSeries = useMemo(() => compactSeries(toSeries(days, (d) => d.weightKg)), [days]);
  const weightMA7 = useMemo(() => movingAverage(weightSeries, 7), [weightSeries]);
  const weightTrend = useMemo(() => linearTrend(weightMA7, 0.1), [weightMA7]);

  const weightData = useMemo(() => {
    return weightMA7
      .map((p, i) => (typeof p.value === "number" ? { x: i, y: p.value } : null))
      .filter((x): x is { x: number; y: number } => !!x);
  }, [weightMA7]);

  const latestWeight = weightTrend.lastValue;
  const weightChange = weightTrend.deltaFromStart;

  const weightMin = weightData.length > 0 ? Math.min(...weightData.map((d) => d.y)) - 1 : 0;
  const weightMax = weightData.length > 0 ? Math.max(...weightData.map((d) => d.y)) + 1 : 100;

  const workoutDays = useMemo(() => days.filter((d) => d.didWorkout).length, [days]);

  const recent = useMemo(() => days.slice(-14), [days]);
  const pct = (num: number, den: number) => (den === 0 ? 0 : (num / den) * 100);

  const calAdherence = useMemo(() => {
    const tracked = recent.filter((d) => d.calories != null);
    const hits = tracked.filter((d) => d.hitCalories === true).length;
    return pct(hits, tracked.length);
  }, [recent]);

  const stepsAdherence = useMemo(() => {
    const tracked = recent.filter((d) => d.steps != null);
    const hits = tracked.filter((d) => d.hitSteps === true).length;
    return pct(hits, tracked.length);
  }, [recent]);

  const waterAdherence = useMemo(() => {
    const tracked = recent.filter((d) => d.waterMl != null);
    const hits = tracked.filter((d) => d.hitWater === true).length;
    return pct(hits, tracked.length);
  }, [recent]);

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
          <Text style={styles.pageTitle}>Progress</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.statRow}>
          {[
            {
              label: "Current Weight",
              val: latestWeight != null ? `${latestWeight.toFixed(1)} kg` : "—",
              sub:
                weightTrend.direction === "insufficient_data"
                  ? "Log weight to unlock trends"
                  : trendBadge(weightTrend.direction, weightTrend.slopePerWeek),
              color: C.primary,
            },
            {
              label: "Workout Days",
              val: String(workoutDays),
              sub: `in last ${days.length} days`,
              color: C.secondary,
            },
          ].map(({ label, val, sub, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statVal, { color }]}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statSub}>{sub}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Weight Trend (7-day average)</Text>
        {weightData.length < 2 ? (
          <View style={styles.noDataCard}>
            <Ionicons name="scale-outline" size={32} color={C.border} />
            <Text style={styles.noDataText}>Log weight to see a real trend line</Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            <LineChart data={weightData} color={C.primary} min={weightMin} max={weightMax} />
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>{weightMin.toFixed(1)} kg</Text>
              <Text style={styles.chartLabel}>{weightMax.toFixed(1)} kg</Text>
            </View>
            <Text style={styles.trendNote}>
              Overall change: {weightChange == null ? "—" : `${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg`}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Weekly Adherence</Text>
        <View style={styles.adherenceCard}>
          <Text style={styles.adherenceNote}>Based on last 14 days</Text>
          <AdherenceBar label="Calories" pct={calAdherence} color={C.primary} />
          <AdherenceBar label="Steps" pct={stepsAdherence} color={C.secondary} />
          <AdherenceBar label="Water" pct={waterAdherence} color={C.accent} />
        </View>
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

  statRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 4,
  },
  statVal: { fontFamily: "Outfit_700Bold", fontSize: 24 },
  statLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 13, color: C.textSecondary },
  statSub: { fontFamily: "Outfit_400Regular", fontSize: 11, color: C.textMuted },

  sectionTitle: { fontFamily: "Outfit_600SemiBold", fontSize: 16, color: C.textSecondary, marginBottom: 10 },
  chartCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  chartLabels: { flexDirection: "row", justifyContent: "space-between" },
  chartLabel: { fontFamily: "Outfit_400Regular", fontSize: 11, color: C.textMuted },
  trendNote: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, marginTop: 4 },

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

  adherenceCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  adherenceNote: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, marginBottom: -4 },
});