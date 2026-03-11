import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { reloadAppAsync } from "expo";
import { C } from "@/constants/colors";

type StartupFailureStateProps = {
  title?: string;
  message: string;
  details?: string;
};

export default function StartupFailureState({
  title = "Startup blocked",
  message,
  details,
}: StartupFailureStateProps) {
  const handleRetry = async () => {
    try {
      await reloadAppAsync();
    } catch (error) {
      console.warn("[6PAC ERROR] Failed to reload app from startup failure state", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {details ? (
        <ScrollView style={styles.detailsWrap} contentContainerStyle={styles.detailsContent}>
          <Text style={styles.detailsText}>{details}</Text>
        </ScrollView>
      ) : null}

      <Pressable style={({ pressed }) => [styles.button, { opacity: pressed ? 0.9 : 1 }]} onPress={handleRetry}>
        <Text style={styles.buttonText}>Retry Startup</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: C.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
  },
  message: {
    color: C.textSecondary,
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    lineHeight: 22,
  },
  detailsWrap: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface2,
  },
  detailsContent: {
    padding: 12,
  },
  detailsText: {
    color: C.textMuted,
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: C.bg,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
  },
});
