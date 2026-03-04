import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useFeedbackToastState } from "@/context/FeedbackToastContext";

const TICK_MS = 80;

export default function FeedbackToastHost() {
  const insets = useSafeAreaInsets();
  const { current, dismissCurrent, undoCurrent } = useFeedbackToastState();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!current || current.kind !== "undo") return;
    const id = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [current]);

  const toneColors = useMemo(() => {
    if (!current) {
      return { border: C.border, accent: C.textMuted };
    }

    switch (current.tone) {
      case "success":
        return { border: `${C.success}66`, accent: C.success };
      case "error":
        return { border: `${C.error}66`, accent: C.error };
      case "warning":
        return { border: `${C.warning}66`, accent: C.warning };
      default:
        return { border: `${C.primary}66`, accent: C.primary };
    }
  }, [current]);

  if (!current) return null;

  const remainingMs =
    current.kind === "undo" && current.startedAt
      ? Math.max(0, current.durationMs - (Date.now() - current.startedAt))
      : current.durationMs;
  const progressPct = Math.max(0, Math.min(100, (remainingMs / current.durationMs) * 100));

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={[styles.card, { borderColor: toneColors.border }]}>
        <View style={styles.row}>
          <Text style={styles.msg} numberOfLines={2}>
            {current.message}
          </Text>
          {current.kind === "undo" ? (
            <Pressable style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.85 }]} onPress={undoCurrent}>
              <Text style={[styles.undoText, { color: toneColors.accent }]}>Undo</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.closeBtn} onPress={dismissCurrent}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          )}
        </View>

        {current.kind === "undo" && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%`, backgroundColor: toneColors.accent },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 40,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 540,
    backgroundColor: "rgba(20,20,25,0.96)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  msg: {
    flex: 1,
    color: C.textSecondary,
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  undoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
  },
  undoText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: C.textMuted,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    lineHeight: 16,
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: C.surface3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
