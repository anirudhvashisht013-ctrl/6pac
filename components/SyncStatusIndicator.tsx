import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useNetworkStatus } from "@/lib/network";
import { useMirrorSyncState } from "@/lib/sync/mirrorQueue";
import { syncNow } from "@/lib/sync/syncNow";
import { useAuth } from "@/context/AuthContext";

export default function SyncStatusIndicator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const network = useNetworkStatus();
  const sync = useMirrorSyncState();
  const [, setTick] = useState(0);

  const isOnline = network.isOnline;
  const pending = sync.pendingCount;
  const syncing = sync.syncing;
  const runTotal = sync.runTotal;
  const runProcessed = sync.runProcessed;

  useEffect(() => {
    if (!sync.nextRetryAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [sync.nextRetryAt]);

  if (isOnline && pending === 0 && !syncing) return null;

  let title = "";
  let subtitle = "";
  let showAction = false;
  let actionLabel = "Sync now";
  let actionDisabled = false;
  let progress = 0;

  let bg: string = C.surface2;
  let border: string = C.border;
  let fg: string = C.text;

  if (!isOnline) {
    title = "You're offline";
    subtitle =
      pending > 0
        ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync`
        : "New updates will sync automatically when back online";
    bg = C.warningBg;
    border = `${C.warning}66`;
    fg = C.warning;
  } else if (syncing && pending > 0) {
    const total = Math.max(runTotal, 1);
    const processed = Math.min(runProcessed, total);
    progress = processed / total;
    title = "Sync in progress";
    subtitle = `${processed}/${total} items processed`;
    bg = C.primaryBg;
    border = `${C.primary}66`;
    fg = C.primary;
    showAction = true;
    actionLabel = "Syncing...";
    actionDisabled = true;
  } else if (pending > 0) {
    const retryMs = sync.nextRetryAt ? Math.max(0, sync.nextRetryAt - Date.now()) : 0;
    const retrySec = Math.ceil(retryMs / 1000);
    title = "Data may be out of date";
    subtitle =
      retrySec > 0
        ? `${pending} pending - retry in ${retrySec}s`
        : `${pending} change${pending === 1 ? "" : "s"} pending sync`;
    bg = C.warningBg;
    border = `${C.warning}66`;
    fg = C.warning;
    showAction = true;
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
        <View style={styles.contentRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: fg }]}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {showAction && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                actionDisabled && styles.actionBtnDisabled,
                pressed && !actionDisabled && { opacity: 0.85 },
              ]}
              disabled={actionDisabled || !user?.id}
              onPress={() => {
                if (!user?.id) return;
                void syncNow(user.id);
              }}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
            </Pressable>
          )}
        </View>
        {syncing && runTotal > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Inline top strip (not an overlay) so it never covers screen actions or
    // the bottom tab bar. Background fills the safe-area notch above the pill.
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: C.bg,
    zIndex: 30,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: C.surface2,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: "Outfit_400Regular",
    fontSize: 11,
    color: C.textSecondary,
  },
  actionBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${C.primary}66`,
    backgroundColor: C.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    color: C.primary,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: C.surface3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.primary,
    borderRadius: 999,
  },
});
