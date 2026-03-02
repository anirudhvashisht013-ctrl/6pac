// app/profile-measurements.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

import type { BodyMeasurementEntry, ISODate } from "@/lib/models";
import { presetRange } from "@/lib/ranges";
import { measurementsRepo } from "@/lib/repos/measurementsRepo";
import { addDays, todayYMD } from "@/lib/dates";

type Slot = {
  date: ISODate;
  scheduledAt: Date; // includes anchor time (e.g., 06:15)
};

type MonthTab = { key: string; label: string };

const INCH_PER_CM = 0.3937007874;
const cmToIn = (cm: number) => cm * INCH_PER_CM;
const fmtIn = (n: number) => `${n.toFixed(1)} in`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function monthKeyFromYMD(ymd: string) {
  // "YYYY-MM"
  return ymd.slice(0, 7);
}

function ymdFromDate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}` as ISODate;
}

function isISODate(x: any): x is ISODate {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function parseAnyDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp case: try toDate()
  if (typeof v?.toDate === "function") {
    try {
      const d = v.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  return null;
}

function formatMonthLabel(key: string) {
  // key: "YYYY-MM"
  const [y, m] = key.split("-");
  const monthIndex = Number(m) - 1;
  const date = new Date(Number(y), monthIndex, 1);
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function hasAnyNumeric(e: BodyMeasurementEntry | null): boolean {
  if (!e) return false;
  const nums = [
    e.waist,
    e.chest,
    e.shoulders,
    e.armsR,
    e.armsL,
    e.thighR,
    e.thighL,
    e.bicepsR,
    e.bicepsL,
    e.bodyFatPercent,
  ];
  return nums.some((v) => typeof v === "number");
}

type SlotStatus = "done" | "upcoming" | "missed";

function slotStatus(slot: Slot, entry: BodyMeasurementEntry | null, now: Date): SlotStatus {
  if (entry && hasAnyNumeric(entry)) return "done";
  if (slot.scheduledAt.getTime() > now.getTime()) return "upcoming";
  return "missed";
}

function statusColor(s: SlotStatus) {
  if (s === "done") return C.success;
  if (s === "upcoming") return "#F7C948";
  return C.error;
}

const deltaColor = (delta: number): string => {
  if (delta === 0) return C.textMuted;
  return delta > 0 ? C.success : C.error;
};

export default function ProfileMeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMonthKey, setActiveMonthKey] = useState<string>("");

  const measurementRange = useMemo(() => presetRange("1y"), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const m = await measurementsRepo.getRange(
        user.id,
        measurementRange.start as any,
        measurementRange.end as any
      );
      setMeasurements(m);
    } finally {
      setLoading(false);
    }
  }, [user, measurementRange.start, measurementRange.end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sortedEntries = useMemo(() => {
    return [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  }, [measurements]);

  const byDate = useMemo(() => {
    const map = new Map<ISODate, BodyMeasurementEntry>();
    sortedEntries.forEach((e) => map.set(e.date, e));
    return map;
  }, [sortedEntries]);

  // Anchor: first real entry timestamp if available, else default to first entry date @ 06:15.
  const anchor = useMemo<Date | null>(() => {
    if (sortedEntries.length === 0) return null;

    // find first entry that has any numeric value
    const firstReal = sortedEntries.find((e) => hasAnyNumeric(e)) || sortedEntries[0];

    const dFromLogged = parseAnyDate((firstReal as any).loggedAt);
    const dFromCreated = parseAnyDate((firstReal as any).createdAt);

    const base = dFromLogged || dFromCreated;
    if (base) return base;

    // fallback: date string @ 06:15
    const ymd = firstReal.date;
    const fallback = new Date(`${ymd}T06:15:00`);
    return isNaN(fallback.getTime()) ? null : fallback;
  }, [sortedEntries]);

  const slots = useMemo<Slot[]>(() => {
    if (!anchor) return [];

    // Build cadence slots from anchor onwards (never earlier)
    const start = new Date(anchor);
    const end = new Date(`${measurementRange.end}T23:59:59`);

    const anchorH = start.getHours();
    const anchorM = start.getMinutes();

    const list: Slot[] = [];

    let t = new Date(start);
    t.setSeconds(0, 0);
    t.setHours(anchorH, anchorM, 0, 0);

    let guard = 0;
    while (t.getTime() <= end.getTime() && guard < 220) {
      list.push({ date: ymdFromDate(t), scheduledAt: new Date(t) });
      t = addDays(t, 15);
      guard++;
    }

    // Always include "next upcoming" slot after the last, so user sees next due.
    if (list.length > 0) {
      const last = list[list.length - 1];
      if (last.scheduledAt.getTime() < Date.now()) {
        const next = addDays(last.scheduledAt, 15);
        list.push({ date: ymdFromDate(next), scheduledAt: next });
      }
    }

    return list;
  }, [anchor, measurementRange.end]);

  const months = useMemo<MonthTab[]>(() => {
    if (!anchor) {
      // First-time UX: just show current month
      const key = monthKeyFromYMD(todayYMD());
      return [{ key, label: formatMonthLabel(key) }];
    }

    const keys = Array.from(new Set(slots.map((s) => monthKeyFromYMD(s.date))));
    keys.sort();

    return keys.map((k) => ({ key: k, label: formatMonthLabel(k) }));
  }, [anchor, slots]);

  // Set initial active month once months computed
  React.useEffect(() => {
    if (!activeMonthKey && months.length > 0) {
      // default to last month (most recent)
      setActiveMonthKey(months[months.length - 1].key);
    }
  }, [months, activeMonthKey]);

  const monthSlots = useMemo(() => {
    const key = activeMonthKey || (months[months.length - 1]?.key ?? monthKeyFromYMD(todayYMD()));
    return slots.filter((s) => monthKeyFromYMD(s.date) === key);
  }, [slots, activeMonthKey, months]);

  const nextDueSlot = useMemo(() => {
    if (!anchor) return null;

    const now = new Date();
    // pick first slot that is not done (missed or upcoming)
    for (const s of slots) {
      const e = byDate.get(s.date) ?? null;
      const st = slotStatus(s, e, now);
      if (st !== "done") return s;
    }
    return null;
  }, [anchor, slots, byDate]);

  function prevRealEntryBefore(date: ISODate): BodyMeasurementEntry | null {
    const idx = sortedEntries.findIndex((e) => e.date === date);
    if (idx <= 0) return null;

    for (let i = idx - 1; i >= 0; i--) {
      const e = sortedEntries[i];
      if (hasAnyNumeric(e)) return e;
    }
    return null;
  }

  function latestRealEntryOnOrBefore(date: ISODate): BodyMeasurementEntry | null {
    for (let i = sortedEntries.length - 1; i >= 0; i--) {
      const e = sortedEntries[i];
      if (e.date <= date && hasAnyNumeric(e)) return e;
    }
    return null;
  }

  const exportCSV = useCallback(async () => {
    if (!anchor) return;

    // Build CSV rows from REAL entries only (skip pure-missed placeholders)
    const rows = sortedEntries
      .filter((e) => hasAnyNumeric(e))
      .map((e) => {
        const loggedAt = parseAnyDate((e as any).loggedAt) || parseAnyDate((e as any).createdAt);
        const loggedAtIso = loggedAt ? loggedAt.toISOString() : "";

        const pickInches = (v: number | null) => (typeof v === "number" ? (v * INCH_PER_CM).toFixed(2) : "");
        const pickPct = (v: number | null) => (typeof v === "number" ? v.toFixed(2) : "");

        return [
          e.date,
          loggedAtIso,
          pickInches(e.waist),
          pickInches(e.chest),
          pickInches(e.shoulders),
          pickInches(e.armsR),
          pickInches(e.armsL),
          pickInches(e.thighR),
          pickInches(e.thighL),
          pickInches(e.bicepsR),
          pickInches(e.bicepsL),
          pickPct(e.bodyFatPercent),
          (e.notes || "").replace(/\n/g, " ").replace(/,/g, " "),
        ];
      });

    const header = [
      "scheduled_date",
      "logged_at",
      "waist_in",
      "chest_in",
      "shoulders_in",
      "armsR_in",
      "armsL_in",
      "thighR_in",
      "thighL_in",
      "bicepsR_in",
      "bicepsL_in",
      "bodyFatPercent",
      "notes",
    ];

    const csv =
      [header, ...rows]
        .map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n") + "\n";

    if (Platform.OS === "web") {
      // Web: download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sixpac-body-measurements-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Native: share file (typed safely for TS)
    try {
      const FSMod: any = await import("expo-file-system");
      const SharingMod: any = await import("expo-sharing");

      const FileSystem = FSMod?.default ?? FSMod;
      const Sharing = SharingMod?.default ?? SharingMod;

      const filename = `sixpac-body-measurements-${new Date().toISOString().slice(0, 10)}.csv`;
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const path = `${baseDir}${filename}`;

      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType?.UTF8 ?? "utf8",
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          dialogTitle: "Export Measurements CSV",
        });
      }
    } catch {
      // ignore
    }
  }, [anchor, sortedEntries]);

  const onLogForSlot = useCallback(
    (slot: Slot) => {
      // No early logging (future slot)
      if (slot.scheduledAt.getTime() > Date.now()) return;

      // push with params without fighting typed routes
      router.push(
        ({
          pathname: "/measurements",
          params: { scheduledYMD: slot.date },
        } as any)
      );
    },
    []
  );

  if (loading) {
    return (
      <View style={[styles.centerFlex, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const now = new Date();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
            paddingBottom: 60,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
            <Text style={styles.backText}>Profile</Text>
          </Pressable>

          <Text style={styles.pageTitle}>Body Measurements</Text>

          <Pressable
            style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.85 }]}
            onPress={exportCSV}
            disabled={!anchor}
          >
            <Ionicons name="download-outline" size={16} color={C.primary} />
            <Text style={styles.exportBtnText}>CSV</Text>
          </Pressable>
        </View>

        {/* First-time UX */}
        {!anchor ? (
          <View style={styles.noDataCard}>
            <Ionicons name="body-outline" size={32} color={C.border} />
            <Text style={styles.noDataText}>
              Log your first measurement to start the 15-day cadence.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push("/measurements" as any)}
            >
              <Text style={styles.primaryBtnText}>Log First Measurement</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Month Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.monthTabs}
            >
              {months.map((m) => {
                const active = m.key === activeMonthKey;
                const ms = slots.filter((s) => monthKeyFromYMD(s.date) === m.key);

                // up to 2 dots
                const dots = ms.slice(0, 2).map((s) => {
                  const e = byDate.get(s.date) ?? null;
                  const st = slotStatus(s, e, now);
                  return { key: s.date, color: statusColor(st) };
                });

                return (
                  <Pressable
                    key={m.key}
                    style={({ pressed }) => [
                      styles.monthTab,
                      active && styles.monthTabActive,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setActiveMonthKey(m.key)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.monthTabText, active && { color: C.text }]}>
                        {m.label}
                      </Text>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {dots.map((d) => (
                          <View
                            key={d.key}
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 999,
                              backgroundColor: d.color,
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Next Due */}
            {nextDueSlot && (
              <View style={styles.nextCard}>
                <View style={styles.nextTop}>
                  <Text style={styles.nextTitle}>Next check-in</Text>
                  <Text style={styles.nextSub}>
                    {nextDueSlot.date} at {formatTime(nextDueSlot.scheduledAt)}
                  </Text>
                </View>

                <View style={styles.nextRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextHint}>
                      Cadence is every 15 days from your first log time.
                    </Text>
                  </View>

                  {(() => {
                    const e = byDate.get(nextDueSlot.date) ?? null;
                    const st = slotStatus(nextDueSlot, e, now);
                    const canLog = nextDueSlot.scheduledAt.getTime() <= Date.now();

                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.nextLogBtn,
                          pressed && { opacity: 0.85 },
                          !canLog && { opacity: 0.5 },
                        ]}
                        onPress={() => canLog && onLogForSlot(nextDueSlot)}
                        disabled={!canLog}
                      >
                        <Ionicons name="add" size={16} color={C.primary} />
                        <Text style={styles.nextLogText}>
                          {st === "missed" ? "Fill" : "Log"}
                        </Text>
                      </Pressable>
                    );
                  })()}
                </View>
              </View>
            )}

            {/* Slots for active month */}
            <Text style={styles.sectionTitle}>This month</Text>

            {monthSlots.length === 0 ? (
              <View style={styles.smallNoteCard}>
                <Text style={styles.noteText}>
                  No scheduled check-ins this month based on your 15-day cadence.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {monthSlots.map((slot) => {
                  const entry = byDate.get(slot.date) ?? null;
                  const st = slotStatus(slot, entry, now);
                  const canLog = slot.scheduledAt.getTime() <= Date.now();

                  // current entry might be missed placeholder (all null). treat as null for display.
                  const showEntry = entry && hasAnyNumeric(entry) ? entry : null;

                  const prev = showEntry ? prevRealEntryBefore(showEntry.date) : latestRealEntryOnOrBefore(slot.date);

                  const trendLine = (label: string, cur: number | null, prevVal: number | null, kind: "in" | "pct") => {
                    const hasCur = typeof cur === "number";
                    const hasPrev = typeof prevVal === "number";
                    const delta = hasCur && hasPrev ? cur! - prevVal! : null;

                    const curText =
                      !hasCur ? "—" : kind === "pct" ? fmtPct(cur!) : fmtIn(cmToIn(cur!));
                    const prevText =
                      !hasPrev ? "—" : kind === "pct" ? fmtPct(prevVal!) : fmtIn(cmToIn(prevVal!));

                    let deltaText = "—";
                    let deltaClr: string = C.textMuted;
                    if (delta != null) {
                      // NOTE: delta is in cm for in-kind, or % for pct; we display in inches for body parts
                      const dShown = kind === "pct" ? delta : cmToIn(delta);
                      deltaText = `${dShown >= 0 ? "+" : ""}${dShown.toFixed(1)}`;
                      deltaClr = deltaColor(delta);
                    }

                    return (
                      <View style={styles.metricCard} key={label}>
                        <Text style={styles.metricLabel}>{label}</Text>

                        <Text style={styles.metricBig}>{curText}</Text>

                        <View style={styles.metricRow}>
                          <Text style={styles.metricSmall}>Prev {prevText}</Text>
                          <Text style={[styles.metricDelta, { color: deltaClr }]}>{deltaText}</Text>
                        </View>
                      </View>
                    );
                  };

                  return (
                    <View key={slot.date} style={styles.slotCard}>
                      <View style={styles.slotTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.slotDate}>{slot.date}</Text>
                          <Text style={styles.slotTime}>
                            Target time: {formatTime(slot.scheduledAt)}
                          </Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              backgroundColor: statusColor(st),
                            }}
                          />

                          <Pressable
                            style={({ pressed }) => [
                              styles.slotLogBtn,
                              pressed && { opacity: 0.85 },
                              !canLog && { opacity: 0.5 },
                            ]}
                            onPress={() => canLog && onLogForSlot(slot)}
                            disabled={!canLog}
                          >
                            <Ionicons name="add" size={16} color={C.primary} />
                            <Text style={styles.slotLogText}>{st === "done" ? "Edit" : "Log"}</Text>
                          </Pressable>
                        </View>
                      </View>

                      {showEntry ? (
                        <View style={styles.metricsGrid}>
                          {trendLine("Waist", showEntry.waist, prev?.waist ?? null, "in")}
                          {trendLine("Chest", showEntry.chest, prev?.chest ?? null, "in")}
                          {trendLine("Shoulders", showEntry.shoulders, prev?.shoulders ?? null, "in")}
                          {trendLine("Arms R", showEntry.armsR, prev?.armsR ?? null, "in")}
                          {trendLine("Body Fat", showEntry.bodyFatPercent, prev?.bodyFatPercent ?? null, "pct")}
                        </View>
                      ) : (
                        <View style={styles.emptySlotNote}>
                          <Text style={styles.emptySlotText}>
                            {st === "upcoming"
                              ? "Upcoming. You can log only on the scheduled day."
                              : st === "missed"
                              ? "Missed. You can still fill it now."
                              : "Not logged yet."}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontFamily: "Outfit_500Medium", fontSize: 12, color: C.textMuted },
  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 18, color: C.text },

  exportBtn: {
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
  exportBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.primary },

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
  noDataText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  primaryBtn: {
    backgroundColor: C.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  primaryBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: C.primary },

  monthTabs: { gap: 10, paddingVertical: 6, paddingBottom: 14 },
  monthTab: {
    backgroundColor: C.surface2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  monthTabActive: {
    borderColor: C.primary + "80",
    backgroundColor: C.surface3,
  },
  monthTabText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.textSecondary },

  nextCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  nextTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  nextTitle: { fontFamily: "Outfit_700Bold", fontSize: 14, color: C.text },
  nextSub: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nextHint: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, lineHeight: 18 },
  nextLogBtn: {
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
  nextLogText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.primary },

  sectionTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
    color: C.textSecondary,
    marginBottom: 10,
    marginTop: 6,
  },

  slotCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  slotTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotDate: { fontFamily: "Outfit_700Bold", fontSize: 14, color: C.text },
  slotTime: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, marginTop: 2 },

  slotLogBtn: {
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
  slotLogText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.primary },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    minWidth: "30%",
    backgroundColor: C.surface3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 6,
  },
  metricLabel: { fontFamily: "Outfit_500Medium", fontSize: 11, color: C.textMuted },
  metricBig: { fontFamily: "Outfit_700Bold", fontSize: 16, color: C.text },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricSmall: { fontFamily: "Outfit_400Regular", fontSize: 11, color: C.textMuted },
  metricDelta: { fontFamily: "Outfit_700Bold", fontSize: 11 },

  emptySlotNote: {
    backgroundColor: C.surface3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  emptySlotText: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, lineHeight: 18 },

  smallNoteCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  noteText: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, lineHeight: 18 },
});