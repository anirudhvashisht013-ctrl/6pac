import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useFeedbackToast } from "@/context/FeedbackToastContext";
import { loadFriendSharedWorkouts, removeFriend } from "@/lib/friends/service";
import { confirm } from "@/lib/ui/confirm";

export default function ProfileFriendWorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useFeedbackToast();
  const params = useLocalSearchParams<{ friendUid?: string; friendName?: string }>();

  const friendUid = typeof params.friendUid === "string" ? params.friendUid : "";
  const friendName = typeof params.friendName === "string" ? params.friendName : "Friend";

  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !friendUid) return;
    setLoading(true);
    try {
      const workouts = await loadFriendSharedWorkouts(user.id, friendUid);
      setCount(workouts.length);
    } catch (error) {
      showToast({ message: "Unable to load shared workouts.", tone: "error" });
      console.warn("load friend workouts failed", error);
    } finally {
      setLoading(false);
    }
  }, [friendUid, showToast, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const subtitle = useMemo(() => {
    if (loading) return "Loading...";
    return `${count} shared workout${count === 1 ? "" : "s"}`;
  }, [count, loading]);

  const onRemoveFriend = useCallback(async () => {
    if (!user || !friendUid) return;

    const step1 = await confirm({
      title: "Remove friend?",
      message: `This will remove ${friendName} from your friends list.`,
      okText: "Continue",
      cancelText: "Cancel",
      destructive: true,
    });

    if (!step1) return;

    const step2 = await confirm({
      title: "Confirm removal",
      message: "You will lose direct access to each other's shared workouts until you add each other again.",
      okText: "Remove friend",
      cancelText: "Keep friend",
      destructive: true,
    });

    if (!step2) return;

    setRemoving(true);
    try {
      const result = await removeFriend(user.id, friendUid);
      if (!result.ok) {
        showToast({ message: "Unable to remove friend right now.", tone: "error" });
        return;
      }

      showToast({ message: "Friend removed", tone: "success" });
      router.replace("/profile-friends" as any);
    } catch (error) {
      showToast({ message: "Unable to remove friend right now.", tone: "error" });
      console.warn("remove friend failed", error);
    } finally {
      setRemoving(false);
    }
  }, [friendName, friendUid, showToast, user]);

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
          <Text style={styles.backText}>Friends</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{friendName}</Text>

        <Pressable
          style={({ pressed }) => [styles.mainCard, pressed && { opacity: 0.9 }]}
          onPress={() =>
            router.push({
              pathname: "/profile-friend-workouts-list",
              params: { friendUid, friendName },
            } as any)
          }
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Shared Workouts</Text>
            <Text style={styles.cardSub}>{subtitle}</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={C.primary} size="small" />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.manageBtn,
            pressed && { opacity: 0.85 },
            removing && { opacity: 0.7 },
          ]}
          disabled={removing}
          onPress={() => {
            void onRemoveFriend();
          }}
        >
          {removing ? (
            <ActivityIndicator size="small" color={C.error} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={14} color={C.error} />
              <Text style={styles.manageBtnText}>Remove Friend</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  backText: { fontFamily: "Outfit_500Medium", fontSize: 13, color: C.textSecondary },
  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 28, color: C.text },
  mainCard: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: { fontFamily: "Outfit_600SemiBold", fontSize: 15, color: C.text },
  cardSub: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },
  manageBtn: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.error + "66",
    backgroundColor: C.errorBg,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  manageBtnText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    color: C.error,
  },
});
