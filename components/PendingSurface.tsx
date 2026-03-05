import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useReminders } from "@/context/ReminderContext";
import type { PendingReminderItem, SnoozeChoice } from "@/lib/reminders/engine";

function snoozeLabel(choice: SnoozeChoice): string {
  if (choice === "1h") return "Snooze 1h";
  if (choice === "tomorrow") return "Tomorrow";
  return "Weekend";
}

function PendingRow({
  item,
  onOpen,
  onSnooze,
  onDismiss,
}: {
  item: PendingReminderItem;
  onOpen: () => void;
  onSnooze: (choice: SnoozeChoice) => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <View style={styles.dot} />
      </View>
      <Text style={styles.itemReason}>{item.reason}</Text>

      <View style={styles.actionRow}>
        <Pressable style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]} onPress={onOpen}>
          <Text style={styles.ctaBtnText}>{item.ctaLabel}</Text>
        </Pressable>

        {item.allowDismiss ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
            onPress={onDismiss}
          >
            <Text style={styles.secondaryBtnText}>Dismiss cycle</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.snoozeRow}>
        {item.snoozeChoices.map((choice) => (
          <Pressable
            key={choice}
            style={({ pressed }) => [styles.snoozeBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onSnooze(choice)}
          >
            <Text style={styles.snoozeBtnText}>{snoozeLabel(choice)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function PendingSurface() {
  const insets = useSafeAreaInsets();
  const { pendingItems, snoozeItem, dismissItemForCycle, openPendingTarget } = useReminders();
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () => (expanded ? pendingItems : pendingItems.slice(0, 1)),
    [expanded, pendingItems]
  );

  if (pendingItems.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 8 }]}> 
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Pending</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerCount}>{pendingItems.length}</Text>
            {pendingItems.length > 1 ? (
              <Pressable
                style={({ pressed }) => [styles.expandBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setExpanded((prev) => !prev)}
              >
                <Text style={styles.expandBtnText}>{expanded ? "Collapse" : "View all"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.itemsWrap}>
          {visible.map((item) => (
            <PendingRow
              key={item.id}
              item={item}
              onOpen={() => openPendingTarget(item)}
              onSnooze={(choice) => {
                void snoozeItem(item, choice);
              }}
              onDismiss={() => {
                void dismissItemForCycle(item);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 20,
  },
  container: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.error + "66",
    padding: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    color: C.text,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCount: {
    minWidth: 18,
    textAlign: "center",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.errorBg,
    color: C.error,
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
  },
  expandBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  expandBtnText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
    color: C.textSecondary,
  },
  itemsWrap: {
    gap: 8,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface2,
    padding: 10,
    gap: 6,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: C.error,
  },
  itemTitle: {
    flex: 1,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    color: C.text,
  },
  itemReason: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    color: C.textMuted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  ctaBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ctaBtnText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    color: C.bg,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryBtnText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: C.textSecondary,
  },
  snoozeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  snoozeBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: C.surface3,
  },
  snoozeBtnText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
    color: C.textSecondary,
  },
});
