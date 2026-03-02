// app/(tabs)/progress.tsx
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { confirm } from "@/lib/ui/confirm";
import { useFocusEffect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";


import type { DailySnapshot, BodyMeasurementEntry } from "@/lib/models";
import { presetRange } from "@/lib/ranges";
import { toSeries, compactSeries } from "@/lib/series";
import { movingAverage, linearTrend } from "@/lib/trends";

import { daysRepo } from "@/lib/repos/daysRepo";
import { measurementsRepo } from "@/lib/repos/measurementsRepo";
import { seedTestUser } from "@/lib/seed";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 140;

function LineChart({
  data,
  color,
  min,
  max,
}: {
  data: { x: number; y: number }[];
  color: string;
  min: number;
  max: number;
}) {
  if (data.length < 2) return null;

  const range = max - min || 1;
  const points = data.map((p) => ({
    px: (p.x / (data.length - 1)) * CHART_W,
    py: CHART_H - ((p.y - min) / range) * CHART_H,
  }));

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`)
    .join(" ");

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <Circle key={i} cx={p.px} cy={p.py} r={4} fill={color} />
      ))}
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

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();

  const [days, setDays] = useState<DailySnapshot[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { user, logout } = useAuth();

  // later you’ll swap this with a UI filter (2w/1m/3m/1y)
  const range = useMemo(() => presetRange("3m"), []);
  const measurementRange = useMemo(() => presetRange("1y"), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [d, m] = await Promise.all([
      daysRepo.getRange(user.id, range.start as any, range.end as any),
      measurementsRepo.getRange(user.id, measurementRange.start as any, measurementRange.end as any),
    ]);

    setDays(d);
    setMeasurements(m);
    setLoading(false);
  }, [user, range.start, range.end, measurementRange.start, measurementRange.end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmSeed = async (): Promise<boolean> => {
  if (Platform.OS === "web") {
    return window.confirm(
      "Seed test data?\n\nThis will write dummy day + measurement records to Firestore for THIS logged-in account."
    );
  }

  return await new Promise((resolve) => {
    Alert.alert(
      "Seed test data?",
      "This will write dummy day + measurement records to Firestore for THIS logged-in account.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Seed", style: "destructive", onPress: () => resolve(true) },
      ]
    );
  });
};

const onSeed = useCallback(async () => {
  console.log("Seed button pressed");

  if (!user) {
    console.log("Seed blocked: user is null");
    return;
  }

  const ok = await confirm({
    title: "Seed test data?",
    message:
      "This will write dummy day + measurement records to Firestore for THIS logged-in account.",
    okText: "Seed",
    cancelText: "Cancel",
    destructive: true,
  });

  if (!ok) {
    console.log("Seed cancelled");
    return;
  }

  try {
    setSeeding(true);
    console.log("Seeding for uid:", user.id);

    await seedTestUser(user.id, 90, 180); // adjust args if needed
    await load(); // reload progress data

    console.log("Seed done ✅");
  } catch (e: any) {
    console.error("Seed failed ❌", e);
  } finally {
    setSeeding(false);
  }
}, [user, load]);

  // ----- Trend: Weight -----
  const weightSeries = useMemo(() => {
    const s = toSeries(days, (d) => d.weightKg);
    return compactSeries(s);
  }, [days]);

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

  // ----- Workouts (from day summary) -----
  const workoutDays = useMemo(() => days.filter((d) => d.didWorkout).length, [days]);

  // ----- Adherence (based on hit flags) -----
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

  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;

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
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
            paddingBottom: 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Progress</Text>

        <View style={styles.topActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={onSeed}
            disabled={seeding}
          >
            <Ionicons name="flask-outline" size={16} color={C.primary} />
            <Text style={styles.actionBtnText}>{seeding ? "Seeding..." : "Seed Data"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={16} color={C.primary} />
            <Text style={styles.actionBtnText}>Logout</Text>
          </Pressable>

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
              Overall change:{" "}
              {weightChange == null ? "—" : `${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg`}
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

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Body Measurements</Text>
          <Pressable
            style={({ pressed }) => [styles.measureBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/measurements")}
          >
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={styles.measureBtnText}>Log</Text>
          </Pressable>
        </View>

        {!latestMeasurement ? (
          <View style={styles.noDataCard}>
            <Ionicons name="body-outline" size={32} color={C.border} />
            <Text style={styles.noDataText}>Log measurements twice a month to track changes</Text>
            <Pressable style={styles.logMeasureBtn} onPress={() => router.push("/measurements")}>
              <Text style={styles.logMeasureBtnText}>Log Measurements</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.measureCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/measurements")}
          >
            <View style={styles.measureCardTop}>
              <Text style={styles.measureDate}>Latest: {latestMeasurement.date}</Text>
              {measurements.length >= 2 && <Text style={styles.measureCount}>{measurements.length} entries</Text>}
            </View>
            <View style={styles.measureGrid}>
              {[
                { label: "Waist", val: latestMeasurement.waist },
                { label: "Chest", val: latestMeasurement.chest },
                { label: "Shoulders", val: latestMeasurement.shoulders },
                { label: "Arms R", val: latestMeasurement.armsR },
                { label: "Body Fat", val: latestMeasurement.bodyFatPercent, unit: "%" },
              ]
                .filter((i) => i.val != null)
                .map(({ label, val, unit }) => (
                  <View key={label} style={styles.measureItem}>
                    <Text style={styles.measureItemVal}>
                      {val}
                      {unit || " cm"}
                    </Text>
                    <Text style={styles.measureItemLabel}>{label}</Text>
                  </View>
                ))}
            </View>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20 },

  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 30, color: C.text, marginBottom: 14 },

  topActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  actionBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 13, color: C.primary },

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
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },

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

  measureBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.primaryBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  measureBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 13, color: C.primary },

  logMeasureBtn: {
    backgroundColor: C.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  logMeasureBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: C.primary },

  measureCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  measureCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  measureDate: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: C.textSecondary },
  measureCount: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },
  measureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  measureItem: {
    minWidth: "30%",
    backgroundColor: C.surface3,
    borderRadius: 10,
    padding: 10,
    gap: 2,
    alignItems: "center",
  },
  measureItemVal: { fontFamily: "Outfit_700Bold", fontSize: 16, color: C.text },
  measureItemLabel: { fontFamily: "Outfit_400Regular", fontSize: 11, color: C.textMuted },
});