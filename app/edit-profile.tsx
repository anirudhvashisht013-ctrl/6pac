// app/edit-profile.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, updateUserProfile } from "@/lib/userProfile";
import { confirm } from "@/lib/ui/confirm";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [initialName, setInitialName] = useState("");
  const [fullName, setFullName] = useState("");

  const canSave = useMemo(() => {
    const a = (initialName || "").trim();
    const b = (fullName || "").trim();
    return b.length >= 2 && b !== a;
  }, [initialName, fullName]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const p = await getUserProfile(user.id);
      const name = (p?.fullName || "").trim();
      setInitialName(name);
      setFullName(name);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onBack = useCallback(async () => {
    const a = (initialName || "").trim();
    const b = (fullName || "").trim();
    const dirty = b !== a;

    if (!dirty || saving) {
      router.back();
      return;
    }

    const ok = await confirm({
      title: "Discard changes?",
      message: "You have unsaved changes.",
      okText: "Discard",
      cancelText: "Stay",
      destructive: true,
    });

    if (ok) router.back();
  }, [initialName, fullName, saving]);

  const onSave = useCallback(async () => {
    if (!user) return;

    const name = (fullName || "").trim();

    if (name.length < 2) {
      if (Platform.OS === "web") {
        window.alert("Please enter your name (min 2 characters).");
      } else {
        Alert.alert("Invalid name", "Please enter your name (min 2 characters).");
      }
      return;
    }

    try {
      setSaving(true);
      await updateUserProfile(user.id, { fullName: name });
      router.back();
    } catch (e) {
      if (Platform.OS === "web") {
        window.alert("Save failed. Please try again.");
      } else {
        Alert.alert("Save failed", "Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }, [user, fullName]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) }]}>
        <View style={styles.header}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]} onPress={onBack}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Edit Profile</Text>

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              !canSave && { opacity: 0.5 },
              pressed && canSave && { opacity: 0.85 },
            ]}
            disabled={!canSave || saving}
            onPress={onSave}
          >
            {saving ? <ActivityIndicator color={C.primary} /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={C.textMuted}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.helper}>
              This is the only editable field for now.
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, width: 72 },
  backText: { fontFamily: "Outfit_500Medium", fontSize: 12, color: C.textMuted },
  title: { fontFamily: "Outfit_700Bold", fontSize: 18, color: C.text },

  saveBtn: {
    width: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: 6,
  },
  saveText: { fontFamily: "Outfit_700Bold", fontSize: 14, color: C.primary },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  label: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: C.text,
  },
  helper: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted, lineHeight: 18 },
});