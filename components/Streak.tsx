import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C } from "@/constants/colors";
import { S } from "@/constants/spacing";
import { formatDateLong, todayYMD, addDays, toYMD } from "@/lib/dates";
import type { ISODate } from "@/lib/models";
import type { DayWWSS } from "@/lib/streak";
import { computeCurrentStreak } from "@/lib/streak";

import type { DailyLog } from "@/lib/types";

interface StreakProps {
  /** chronological array oldest->newest */
  data: DayWWSS[];
  /** today's date to determine which days are missed */
  today?: ISODate;
  /** today's log data to show current progress fire */
  todayLog?: DailyLog | null;
}

export function Streak({ data, today: todayProp, todayLog }: StreakProps) {
  const today = todayProp || todayYMD();
  const now = new Date();
  const yesterday = toYMD(addDays(new Date(`${today}T00:00:00`), -1));
  const isPastNoon = now.getHours() >= 12;

  const streakCount = useMemo(() => {
    return computeCurrentStreak(data, new Date());
  }, [data]);

  const message = useMemo(() => {
    if (streakCount === 0) return "Start your streak today!";
    if (streakCount < 3) return "Good start - keep the streak going!";
    if (streakCount < 7) return "Nice work! Stay consistent.";
    return "Amazing streak! Keep it alive.";
  }, [streakCount]);

  const handlePress = (day: DayWWSS) => {
    const parts: string[] = [];
    if (day.sleep) parts.push("Sleep ✓");
    else parts.push("Sleep ✗");
    if (day.steps) parts.push("Steps ✓");
    else parts.push("Steps ✗");
    if (day.water) parts.push("Water ✓");
    else parts.push("Water ✗");
    if (day.weight) parts.push("Weight ✓");
    else parts.push("Weight ✗");
    Alert.alert(formatDateLong(day.date), `Score: ${day.score}/4\n${parts.join("\n")}`);
  };

  const getTodayFireColor = (): { color: string; opacity: number } => {
    const score = todayLog ? [
      todayLog.weightKg != null,
      todayLog.sleepHours != null,
      todayLog.waterMl != null,
      todayLog.steps != null,
    ].filter(Boolean).length : 0;

    if (score === 0) return { color: C.textMuted, opacity: 0.4 }; // grey
    if (score < 4) return { color: C.warning, opacity: 0.8 }; // yellow
    return { color: C.error, opacity: 1.0 }; // red
  };

  const handleTodayFirePress = () => {
    const parts: string[] = [];
    if (todayLog?.sleepHours != null) parts.push("Sleep ✓");
    else parts.push("Sleep ✗");
    if (todayLog?.steps != null) parts.push("Steps ✓");
    else parts.push("Steps ✗");
    if (todayLog?.waterMl != null) parts.push("Water ✓");
    else parts.push("Water ✗");
    if (todayLog?.weightKg != null) parts.push("Weight ✓");
    else parts.push("Weight ✗");
    Alert.alert(`Today - ${formatDateLong(today)}`, parts.join("\n"));
  };

  /**
   * Determine the fire color for a given day:
   * - Greyed out: today with no data
   * - Yellow: today with 1-3 metrics
   * - Red: today with all 4 metrics, OR past day with all metrics
   * - Red/missed: past day outside grace period with no data
   * - Primary: past day with partial data
   */
  const getFireColor = (d: DayWWSS): { color: string; opacity: number } => {
    // Today's fire shows yellow for partial, red for complete, or grey for empty
    if (d.date === today) {
      if (d.score === 0) return { color: C.textMuted, opacity: 0.4 };
      if (d.score < 4) return { color: C.warning, opacity: 0.8 }; // yellow
      return { color: C.error, opacity: 1.0 }; // red for complete
    }

    // Past days: red if missed, primary if has data
    if (d.date < today && d.score === 0) {
      // only red if outside grace period
      if (!(d.date === yesterday && !isPastNoon)) {
        return { color: C.error, opacity: 0.6 };
      }
    }

    // has data → primary with opacity based on completion
    if (d.score > 0) {
      return { color: C.primary, opacity: 0.2 + (d.score / 4) * 0.8 };
    }

    // fallback (shouldn't reach here normally)
    return { color: C.textMuted, opacity: 0.3 };
  };

  if (!data || data.length === 0) {
    // Show today's incomplete fire with dynamic color
    const todayColor = getTodayFireColor();
    return (
      <View style={styles.container}>
        <Text style={styles.streakText}>No streak yet</Text>
        <Text style={styles.messageText}>Start your streak today!</Text>
        <View style={styles.scrollContent}>
          <Pressable
            onPress={handleTodayFirePress}
            style={({ pressed }) => [styles.iconWrapper, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="arm-flex"
              size={24}
              color={todayColor.color}
              style={{ opacity: todayColor.opacity }}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.streakText}>
        {streakCount > 0 ? `${streakCount}-day streak` : "No streak yet"}
      </Text>
      <Text style={styles.messageText}>{message}</Text>
      <ScrollView
        style={styles.scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {data.map((d) => (
          <Pressable
            key={d.date}
            onPress={() => handlePress(d)}
            style={({ pressed }) => [styles.iconWrapper, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="arm-flex"
              size={24}
              color={getFireColor(d).color}
              style={{ opacity: getFireColor(d).opacity }}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: S.lg,
  },
  streakText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: S.xxs,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrapper: {
    padding: 4,
  },
  messageText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: S.xxs,
  },
});
