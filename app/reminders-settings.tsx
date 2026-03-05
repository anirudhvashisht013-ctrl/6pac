import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useReminders } from "@/context/ReminderContext";
import { useFeedbackToast } from "@/context/FeedbackToastContext";

function isValidClock(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function PermissionBadge({ status }: { status: string }) {
  const color =
    status === "granted" ? C.success : status === "denied" ? C.error : status === "undetermined" ? C.warning : C.textMuted;
  const bg =
    status === "granted" ? C.successBg : status === "denied" ? C.errorBg : status === "undetermined" ? C.warningBg : C.surface3;

  return (
    <View style={[styles.permissionBadge, { backgroundColor: bg, borderColor: color + "66" }]}>
      <Text style={[styles.permissionBadgeText, { color }]}>{status}</Text>
    </View>
  );
}

function SettingRow({
  label,
  value,
  onChangeText,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <TextInput
        style={styles.timeInput}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="HH:mm"
        placeholderTextColor={C.textMuted}
      />
      {hint ? <Text style={styles.settingHint}>{hint}</Text> : null}
    </View>
  );
}

export default function ReminderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useFeedbackToast();
  const {
    state,
    isLoading,
    permissionStatus,
    updateSettings,
    requestOsPermission,
    openOsSettings,
  } = useReminders();

  const [measurementTime, setMeasurementTime] = useState(state.settings.measurement.time);
  const [weeklyTime, setWeeklyTime] = useState(state.settings.weeklyPlan.time);
  const [workoutTime, setWorkoutTime] = useState(state.settings.workout.time);
  const [dailyTime, setDailyTime] = useState(state.settings.dailyLogging.time);
  const [quietStart, setQuietStart] = useState(state.settings.quietHours.start);
  const [quietEnd, setQuietEnd] = useState(state.settings.quietHours.end);
  const [saving, setSaving] = useState(false);

  const hasInvalid = useMemo(
    () =>
      ![
        measurementTime,
        weeklyTime,
        workoutTime,
        dailyTime,
        quietStart,
        quietEnd,
      ].every(isValidClock),
    [measurementTime, weeklyTime, workoutTime, dailyTime, quietStart, quietEnd]
  );

  const saveTimes = async () => {
    if (hasInvalid) {
      Alert.alert("Invalid time", "Please use HH:mm format (24-hour), for example 09:00.");
      return;
    }

    setSaving(true);
    try {
      await updateSettings({
        measurement: { time: measurementTime },
        weeklyPlan: { time: weeklyTime },
        workout: { time: workoutTime },
        dailyLogging: { time: dailyTime },
        quietHours: { start: quietStart, end: quietEnd },
      });
      showToast({ message: "Reminder settings saved", tone: "success" });
    } catch (error) {
      showToast({ message: "Unable to save reminder settings. Please try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

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
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
            <Text style={styles.backText}>Profile</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Notifications & Reminders</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardTitle}>Enable reminders</Text>
            <Switch
              value={state.settings.enabled}
              onValueChange={(value) => {
                void updateSettings({ enabled: value });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.enabled ? C.primary : C.textMuted}
            />
          </View>
          <Text style={styles.cardSub}>Master control for local reminders and in-app pending indicators.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>OS notifications permission</Text>
          <View style={styles.permissionRow}>
            <PermissionBadge status={permissionStatus} />
            {permissionStatus !== "granted" ? (
              <Pressable
                style={({ pressed }) => [styles.permissionBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  if (permissionStatus === "denied") {
                    void openOsSettings();
                  } else {
                    void requestOsPermission();
                  }
                }}
              >
                <Text style={styles.permissionBtnText}>
                  {permissionStatus === "denied" ? "Open settings" : "Enable notifications"}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.cardSub}>
            If OS notifications stay disabled, the app still shows pending dots and the in-app pending surface.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardTitle}>Body Measurements</Text>
            <Switch
              value={state.settings.measurement.enabled}
              onValueChange={(value) => {
                void updateSettings({ measurement: { enabled: value } });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.measurement.enabled ? C.primary : C.textMuted}
            />
          </View>
          <SettingRow
            label="Preferred measurement time"
            value={measurementTime}
            onChangeText={setMeasurementTime}
            hint="Used for day-before and day-of reminders"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardTitle}>Weekly Plan</Text>
            <Switch
              value={state.settings.weeklyPlan.enabled}
              onValueChange={(value) => {
                void updateSettings({ weeklyPlan: { enabled: value } });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.weeklyPlan.enabled ? C.primary : C.textMuted}
            />
          </View>
          <SettingRow
            label="Sunday reminder time"
            value={weeklyTime}
            onChangeText={setWeeklyTime}
            hint="Default: Sunday 18:00"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardTitle}>Workout</Text>
            <Switch
              value={state.settings.workout.enabled}
              onValueChange={(value) => {
                void updateSettings({ workout: { enabled: value } });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.workout.enabled ? C.primary : C.textMuted}
            />
          </View>
          <SettingRow
            label="Planned gym time"
            value={workoutTime}
            onChangeText={setWorkoutTime}
            hint="Reminder fires before this time"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardTitle}>Daily Logging</Text>
            <Switch
              value={state.settings.dailyLogging.enabled}
              onValueChange={(value) => {
                void updateSettings({ dailyLogging: { enabled: value } });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.dailyLogging.enabled ? C.primary : C.textMuted}
            />
          </View>
          <SettingRow
            label="Daily nudge time"
            value={dailyTime}
            onChangeText={setDailyTime}
            hint="Default: 20:00"
          />
          <View style={styles.inlineRow}>
            <Text style={styles.settingLabel}>Send OS nudge (if allowed)</Text>
            <Switch
              value={state.settings.dailyLogging.sendOsNotification}
              onValueChange={(value) => {
                void updateSettings({ dailyLogging: { sendOsNotification: value } });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.dailyLogging.sendOsNotification ? C.primary : C.textMuted}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quiet hours</Text>
          <View style={styles.inlineRow}>
            <Text style={styles.settingLabel}>Enable quiet hours</Text>
            <Switch
              value={state.settings.quietHours.enabled}
              onValueChange={(value) => {
                void updateSettings({ quietHours: { enabled: value } });
              }}
              trackColor={{ false: C.border, true: C.primary + "66" }}
              thumbColor={state.settings.quietHours.enabled ? C.primary : C.textMuted}
            />
          </View>
          <SettingRow label="Start" value={quietStart} onChangeText={setQuietStart} hint="Default 22:00" />
          <SettingRow label="End" value={quietEnd} onChangeText={setQuietEnd} hint="Default 07:00" />
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }, saving && { opacity: 0.7 }]}
          onPress={() => {
            void saveTimes();
          }}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save times"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  headerRow: {
    gap: 8,
    marginBottom: 6,
  },
  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  pageTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 27,
    color: C.text,
  },
  card: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 10,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  cardSub: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 18,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  permissionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  permissionBadgeText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    textTransform: "capitalize",
  },
  permissionBtn: {
    borderWidth: 1,
    borderColor: C.primary + "66",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: C.primaryBg,
  },
  permissionBtnText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    color: C.primary,
  },
  settingRow: {
    gap: 6,
  },
  settingLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  settingHint: {
    fontFamily: "Outfit_400Regular",
    fontSize: 11,
    color: C.textMuted,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface3,
    color: C.text,
    fontFamily: "Outfit_500Medium",
    fontSize: 15,
    paddingHorizontal: 12,
    height: 42,
  },
  saveBtn: {
    marginTop: 6,
    backgroundColor: C.primary,
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
    color: C.bg,
  },
});
