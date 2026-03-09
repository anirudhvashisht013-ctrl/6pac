import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useFeedbackToast } from "@/context/FeedbackToastContext";
import {
  copySharedWorkoutToMyAccount,
  loadCopiedTemplateIdsFromOwner,
  loadFriendSharedWorkouts,
} from "@/lib/friends/service";
import type { SharedWorkoutView } from "@/lib/friends/types";

export default function ProfileFriendWorkoutsListScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useFeedbackToast();
  const params = useLocalSearchParams<{ friendUid?: string; friendName?: string }>();

  const friendUid = typeof params.friendUid === "string" ? params.friendUid : "";
  const friendName = typeof params.friendName === "string" ? params.friendName : "Friend";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SharedWorkoutView[]>([]);
  const [copiedTemplateIds, setCopiedTemplateIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!user || !friendUid) return;
    setLoading(true);
    try {
      const [workouts, copiedIds] = await Promise.all([
        loadFriendSharedWorkouts(user.id, friendUid),
        loadCopiedTemplateIdsFromOwner(user.id, friendUid),
      ]);
      setItems(workouts);
      setCopiedTemplateIds(copiedIds);
    } catch (error) {
      showToast({ message: "Unable to load shared workouts.", tone: "error" });
      console.warn("load friend workouts list failed", error);
    } finally {
      setLoading(false);
    }
  }, [friendUid, showToast, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.template.name} ${item.template.notes || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const copyWorkout = useCallback(
    async (item: SharedWorkoutView) => {
      if (!user) return;
      setCopyingId(item.id);
      try {
        await copySharedWorkoutToMyAccount(user.id, item);
        setCopiedTemplateIds((prev) => {
          const next = new Set(prev);
          next.add(item.templateId);
          return next;
        });
        showToast({ message: "Copied", tone: "success" });
      } catch (error) {
        if ((error as Error)?.message === "already_copied") {
          setCopiedTemplateIds((prev) => {
            const next = new Set(prev);
            next.add(item.templateId);
            return next;
          });
          showToast({ message: "Copied", tone: "success" });
        } else {
          showToast({ message: "Unable to copy workout right now.", tone: "error" });
        }
        console.warn("copy workout failed", error);
      } finally {
        setCopyingId(null);
      }
    },
    [showToast, user]
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={C.text} />
          <Text style={styles.backText}>{friendName}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>Shared Workouts</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search shared workouts"
          placeholderTextColor={C.textMuted}
          style={styles.searchInput}
        />

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>
            {items.length === 0 ? "No shared workouts available yet." : "No workouts match this search."}
          </Text>
        ) : (
          filteredItems.map((item) => {
            const isCopied = copiedTemplateIds.has(item.templateId);
            const isBusy = copyingId === item.id;

            return (
              <View key={item.id} style={styles.workoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{item.template.name}</Text>
                  <Text style={styles.workoutMeta}>
                    {item.template.blocks.length} block{item.template.blocks.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.copyBtn,
                    (isCopied || isBusy) && styles.copyBtnDisabled,
                    pressed && !(isCopied || isBusy) && { opacity: 0.85 },
                  ]}
                  disabled={isBusy || isCopied}
                  onPress={() => {
                    void copyWorkout(item);
                  }}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={C.bg} />
                  ) : isCopied ? (
                    <Text style={[styles.copyBtnText, styles.copyBtnTextDisabled]}>Copied</Text>
                  ) : (
                    <Text style={styles.copyBtnText}>Copy</Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  backText: { fontFamily: "Outfit_500Medium", fontSize: 13, color: C.textSecondary },
  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 28, color: C.text },
  searchInput: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: C.text,
  },
  loadingRow: { minHeight: 80, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: "Outfit_400Regular", fontSize: 13, color: C.textMuted },
  workoutRow: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  workoutName: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: C.text },
  workoutMeta: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },
  copyBtn: {
    minHeight: 34,
    minWidth: 64,
    borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  copyBtnDisabled: {
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
  },
  copyBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.bg },
  copyBtnTextDisabled: { color: C.textMuted },
});
