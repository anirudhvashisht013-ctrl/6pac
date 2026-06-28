// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import { useReminders } from "@/context/ReminderContext";

function ClassicTabLayout() {
  const safeAreaInsets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { tabCounts } = useReminders();

  const TabIcon = ({ name, focused }: { name: string; focused: boolean; color: string; size: number }) => {
    const color = focused ? C.primary : C.tabInactive;

    const icons: Record<string, [any, string]> = {
      index: ["Ionicons", focused ? "sunny" : "sunny-outline"],
      week: ["Ionicons", focused ? "calendar" : "calendar-outline"],
      workouts: ["MaterialCommunityIcons", focused ? "dumbbell" : "dumbbell"],
      nutrition: ["Ionicons", focused ? "restaurant" : "restaurant-outline"],
      profile: ["Ionicons", focused ? "person" : "person-outline"],
    };

    const [lib, icon] = icons[name] || ["Ionicons", "ellipse"];

    const iconNode =
      lib === "MaterialCommunityIcons" ? (
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      ) : (
        <Ionicons name={icon as any} size={24} color={color} />
      );
    return iconNode;
  };

  const makeTabIcon = (name: string) => {
    function TabBarIcon({ color, focused, size }: { color: string; focused: boolean; size: number }) {
      return <TabIcon name={name} focused={focused} color={color} size={size} />;
    }
    TabBarIcon.displayName = `${name}TabBarIcon`;
    return TabBarIcon;
  };

  const badgeValue = (name: string) => {
    const raw = tabCounts?.[name as keyof typeof tabCounts];
    const count = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (!count) return undefined;
    return String(Math.min(count, 9));
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.tabInactive,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : C.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
          ...(!isWeb && !isIOS ? { paddingBottom: safeAreaInsets.bottom } : {}),
        },
        tabBarLabelStyle: {
          fontFamily: "Outfit_500Medium",
          fontSize: 11,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.surface }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={() => {
          const badge = badgeValue("index");
          return {
          title: "Today",
          tabBarIcon: makeTabIcon("index"),
          tabBarBadge: badge,
          ...(badge ? { tabBarBadgeStyle: styles.tabBadge } : {}),
        };
        }}
      />
      <Tabs.Screen
        name="week"
        options={() => {
          const badge = badgeValue("week");
          return {
          title: "Weekly Plan",
          tabBarIcon: makeTabIcon("week"),
          tabBarBadge: badge,
          ...(badge ? { tabBarBadgeStyle: styles.tabBadge } : {}),
        };
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={() => {
          const badge = badgeValue("workouts");
          return {
          title: "Workouts",
          tabBarIcon: makeTabIcon("workouts"),
          tabBarBadge: badge,
          ...(badge ? { tabBarBadgeStyle: styles.tabBadge } : {}),
        };
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={() => {
          const badge = badgeValue("nutrition");
          return {
          title: "Nutrition",
          tabBarIcon: makeTabIcon("nutrition"),
          tabBarBadge: badge,
          ...(badge ? { tabBarBadgeStyle: styles.tabBadge } : {}),
        };
        }}
      />

      {/* New Profile tab */}
      <Tabs.Screen
        name="profile"
        options={() => {
          const badge = badgeValue("profile");
          return {
          title: "Profile",
          tabBarIcon: makeTabIcon("profile"),
          tabBarBadge: badge,
          ...(badge ? { tabBarBadgeStyle: styles.tabBadge } : {}),
        };
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* Inline top strip — sits in the layout flow so it never overlays
          screen actions or the bottom tab bar. */}
      <SyncStatusIndicator />
      <View style={{ flex: 1 }}>
        <ClassicTabLayout />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBadge: {
    backgroundColor: C.error,
    color: C.bg,
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    minWidth: 16,
    height: 16,
    lineHeight: 16,
    borderRadius: 99,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
});
