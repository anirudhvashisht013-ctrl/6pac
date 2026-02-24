import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { logsRepo, mealsRepo, targetsRepo, sessionsRepo, schedulesRepo, measurementsRepo } from '@/lib/storage';
import { getMondayYMD, getWeekDates, addDays, todayYMD, toYMD } from '@/lib/dates';
import type { DailyLog, WeeklyTarget, WorkoutSession, BodyMeasurementEntry } from '@/lib/types';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 140;

function LineChart({
  data, color, min, max,
}: { data: { x: number; y: number }[]; color: string; min: number; max: number }) {
  if (data.length < 2) return null;
  const range = max - min || 1;
  const points = data.map(p => ({
    px: (p.x / (data.length - 1)) * CHART_W,
    py: CHART_H - ((p.y - min) / range) * CHART_H,
  }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');
  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.textSecondary },
  pct: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: C.text },
  track: { height: 8, backgroundColor: C.surface3, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const today = todayYMD();

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [l, meals, t, s, m] = await Promise.all([
      logsRepo.getAll(user.id),
      mealsRepo.getAll(user.id),
      targetsRepo.getAll(user.id),
      sessionsRepo.getAll(user.id),
      measurementsRepo.getAll(user.id),
    ]);

    const withCal = l.map(log => {
      const mealCal = meals.filter(me => me.date === log.date).reduce((s, me) => s + (me.calories || 0), 0);
      return { ...log, _totalCal: mealCal + (log.caloriesManual || 0) };
    });
    setLogs(withCal.sort((a, b) => a.date.localeCompare(b.date)));
    setWeeklyTargets(t);
    setSessions(s);
    setMeasurements(m.sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weightData = logs
    .filter(l => l.weightKg != null)
    .map((l, i) => ({ x: i, y: l.weightKg! }));

  const recentLogs = logs.slice(-14);
  const currentTarget = weeklyTargets.find(t => {
    const weekStart = getMondayYMD();
    return t.weekStartDate === weekStart;
  });

  const calAdherence = currentTarget && recentLogs.length > 0
    ? (recentLogs.filter(l => {
        const cal = (l as any)._totalCal || 0;
        return cal > 0 && cal >= currentTarget.dailyCaloriesTarget * 0.95 && cal <= currentTarget.dailyCaloriesTarget * 1.05;
      }).length / recentLogs.length) * 100
    : 0;
  const stepsAdherence = currentTarget && recentLogs.length > 0
    ? (recentLogs.filter(l => l.steps && currentTarget && l.steps >= currentTarget.dailyStepsTarget).length / recentLogs.length) * 100
    : 0;
  const waterAdherence = currentTarget && recentLogs.length > 0
    ? (recentLogs.filter(l => l.waterMl && currentTarget && l.waterMl >= currentTarget.dailyWaterMlTarget).length / recentLogs.length) * 100
    : 0;

  const completedSessions = sessions.filter(s => s.completed).length;
  const totalSessions = sessions.length;

  const latestWeight = weightData.length > 0 ? weightData[weightData.length - 1].y : null;
  const firstWeight = weightData.length > 0 ? weightData[0].y : null;
  const weightChange = latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null;

  const weightMin = weightData.length > 0 ? Math.min(...weightData.map(d => d.y)) - 1 : 0;
  const weightMax = weightData.length > 0 ? Math.max(...weightData.map(d => d.y)) + 1 : 100;

  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  if (loading) {
    return <View style={[styles.centerFlex, { backgroundColor: C.bg }]}><ActivityIndicator color={C.primary} /></View>;
  }

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
        <Text style={styles.pageTitle}>Progress</Text>

        <View style={styles.statRow}>
          {[
            {
              label: 'Current Weight',
              val: latestWeight != null ? `${latestWeight.toFixed(1)} kg` : '—',
              sub: weightChange != null ? `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} kg overall` : 'No data',
              color: C.primary,
            },
            {
              label: 'Workouts Done',
              val: String(completedSessions),
              sub: `of ${totalSessions} logged`,
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

        <Text style={styles.sectionTitle}>Weight Trend</Text>
        {weightData.length < 2 ? (
          <View style={styles.noDataCard}>
            <Ionicons name="scale-outline" size={32} color={C.border} />
            <Text style={styles.noDataText}>Log weight daily to see your trend</Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            <LineChart data={weightData} color={C.primary} min={weightMin} max={weightMax} />
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>{weightMin.toFixed(1)} kg</Text>
              <Text style={styles.chartLabel}>{weightMax.toFixed(1)} kg</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Weekly Adherence</Text>
        <View style={styles.adherenceCard}>
          <Text style={styles.adherenceNote}>Based on last 14 days</Text>
          <AdherenceBar label="Calories (±5%)" pct={calAdherence} color={C.primary} />
          <AdherenceBar label="Steps" pct={stepsAdherence} color={C.secondary} />
          <AdherenceBar label="Water" pct={waterAdherence} color={C.accent} />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Body Measurements</Text>
          <Pressable
            style={({ pressed }) => [styles.measureBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/measurements')}
          >
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={styles.measureBtnText}>Log</Text>
          </Pressable>
        </View>

        {!latestMeasurement ? (
          <View style={styles.noDataCard}>
            <Ionicons name="body-outline" size={32} color={C.border} />
            <Text style={styles.noDataText}>Log measurements twice a month to track changes</Text>
            <Pressable style={styles.logMeasureBtn} onPress={() => router.push('/measurements')}>
              <Text style={styles.logMeasureBtnText}>Log Measurements</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.measureCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/measurements')}
          >
            <View style={styles.measureCardTop}>
              <Text style={styles.measureDate}>Latest: {latestMeasurement.date}</Text>
              {measurements.length >= 2 && (
                <Text style={styles.measureCount}>{measurements.length} entries</Text>
              )}
            </View>
            <View style={styles.measureGrid}>
              {[
                { label: 'Waist', val: latestMeasurement.waist },
                { label: 'Chest', val: latestMeasurement.chest },
                { label: 'Shoulders', val: latestMeasurement.shoulders },
                { label: 'Arms R', val: latestMeasurement.armsR },
                { label: 'Body Fat', val: latestMeasurement.bodyFatPercent, unit: '%' },
              ].filter(i => i.val != null).map(({ label, val, unit }) => (
                <View key={label} style={styles.measureItem}>
                  <Text style={styles.measureItemVal}>{val}{unit || ' cm'}</Text>
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
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: C.text, marginBottom: 20 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 4,
  },
  statVal: { fontFamily: 'Outfit_700Bold', fontSize: 24 },
  statLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.textSecondary },
  statSub: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  chartCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 24, gap: 8,
  },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
  noDataCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 24, alignItems: 'center', gap: 10, marginBottom: 24,
  },
  noDataText: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' },
  adherenceCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 24, gap: 14,
  },
  adherenceNote: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted, marginBottom: -4 },
  measureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.primary + '60',
  },
  measureBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.primary },
  logMeasureBtn: {
    backgroundColor: C.primaryBg, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: C.primary + '60',
  },
  logMeasureBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.primary },
  measureCard: {
    backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12, marginBottom: 24,
  },
  measureCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  measureDate: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.textSecondary },
  measureCount: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  measureItem: {
    minWidth: '30%', backgroundColor: C.surface3, borderRadius: 10, padding: 10,
    gap: 2, alignItems: 'center',
  },
  measureItemVal: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: C.text },
  measureItemLabel: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: C.textMuted },
});
