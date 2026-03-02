// app/(tabs)/profile.tsx
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import { C } from "@/constants/colors";

import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/userProfile";
import { confirm } from "@/lib/ui/confirm";
import { seedTestUser } from "@/lib/seed";

type ProfileDoc = {
  email?: string;
  fullName?: string;
  dateOfBirth?: string;
  sex?: "male" | "female" | "other" | string;
};

export default function ProfileHubScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);
    try {
      const p = (await getUserProfile(user.id)) as any;
      setProfile((p ?? null) as ProfileDoc | null);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const onSeed = useCallback(async () => {
    if (!user) return;

    const ok = await confirm({
      title: "Seed test data?",
      message: "This will write dummy day + measurement records to Firestore for THIS logged-in account.",
      okText: "Seed",
      cancelText: "Cancel",
      destructive: true,
    });

    if (!ok) return;

    try {
      setSeeding(true);
      await seedTestUser(user.id, 90, 180);
    } finally {
      setSeeding(false);
    }
  }, [user]);

  const displayName = profile?.fullName || "—";
  const displayEmail = user?.email || profile?.email || "—";
  const displaySex = profile?.sex || "—";
  const displayDob = profile?.dateOfBirth || "—";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={18} color={C.text} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.sub}>{displayEmail}</Text>
            </View>

            {loadingProfile ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.85 }]}
                onPress={() => router.push("/edit-profile")}
              >
                <Ionicons name="pencil" size={16} color={C.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>Sex</Text>
              <Text style={styles.metaVal}>{displaySex}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>DOB</Text>
              <Text style={styles.metaVal}>{displayDob}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Dashboard</Text>

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/profile-progress")}
        >
          <View style={styles.navLeft}>
            <View style={styles.navIconWrap}>
              <Ionicons name="stats-chart-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Progress</Text>
              <Text style={styles.navSub}>Weight trend, workouts, adherence</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/profile-measurements")}
        >
          <View style={styles.navLeft}>
            <View style={styles.navIconWrap}>
              <Ionicons name="body-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Body Measurements</Text>
              <Text style={styles.navSub}>Waist, chest, shoulders, body fat</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </Pressable>

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.actionsWrap}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={onSeed}
            disabled={seeding}
          >
            <Ionicons name="flask-outline" size={16} color={C.primary} />
            <Text style={styles.actionBtnText}>{seeding ? "Seeding..." : "Seed Data"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && { opacity: 0.85 }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={16} color={styles.dangerText.color as any} />
            <Text style={[styles.actionBtnText, styles.dangerText]}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 30, color: C.text, marginBottom: 14 },

  sectionTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    color: C.textSecondary,
    marginTop: 10,
    marginBottom: 10,
  },

  card: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
    marginBottom: 14,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 12 },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
  },

  name: { fontFamily: "Outfit_700Bold", fontSize: 16, color: C.text },
  sub: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, marginTop: 2 },

  editBtn: {
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
  editBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.primary },

  metaRow: { flexDirection: "row", gap: 10 },
  metaPill: {
    flex: 1,
    backgroundColor: C.surface3,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  metaLabel: { fontFamily: "Outfit_500Medium", fontSize: 11, color: C.textMuted },
  metaVal: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.textSecondary },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  navLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  navIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { fontFamily: "Outfit_700Bold", fontSize: 14, color: C.text },
  navSub: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, marginTop: 2 },

  actionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
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

  dangerBtn: { backgroundColor: "transparent", borderColor: "#ff4d4d" + "80" },
  dangerText: { color: "#ff4d4d" },
});