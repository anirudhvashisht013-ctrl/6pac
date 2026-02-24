import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} />
        <Label>Today</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week">
        <Icon sf={{ default: 'calendar', selected: 'calendar.badge.checkmark' }} />
        <Label>Week</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <Icon sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }} />
        <Label>Workouts</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nutrition">
        <Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} />
        <Label>Nutrition</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <Icon sf={{ default: 'chart.line.uptrend.xyaxis', selected: 'chart.line.uptrend.xyaxis' }} />
        <Label>Progress</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const safeAreaInsets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const TabIcon = ({ name, focused }: { name: string; focused: boolean; color: string; size: number }) => {
    const color = focused ? C.primary : C.tabInactive;
    const icons: Record<string, [any, string]> = {
      index: ['Ionicons', focused ? 'sunny' : 'sunny-outline'],
      week: ['Ionicons', focused ? 'calendar' : 'calendar-outline'],
      workouts: ['MaterialCommunityIcons', focused ? 'dumbbell' : 'dumbbell'],
      nutrition: ['Ionicons', focused ? 'restaurant' : 'restaurant-outline'],
      progress: ['Ionicons', focused ? 'stats-chart' : 'stats-chart-outline'],
    };
    const [lib, icon] = icons[name] || ['Ionicons', 'ellipse'];
    if (lib === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={icon as any} size={24} color={color} />;
    }
    return <Ionicons name={icon as any} size={24} color={color} />;
  };

  const makeTabIcon = (name: string) =>
    ({ color, focused, size }: { color: string; focused: boolean; size: number }) =>
      <TabIcon name={name} focused={focused} color={color} size={size} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.tabInactive,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : C.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
          ...((!isWeb && !isIOS) ? { paddingBottom: safeAreaInsets.bottom } : {}),
        },
        tabBarLabelStyle: {
          fontFamily: 'Outfit_500Medium',
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
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: makeTabIcon('index') }} />
      <Tabs.Screen name="week" options={{ title: 'Week', tabBarIcon: makeTabIcon('week') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: makeTabIcon('workouts') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: makeTabIcon('nutrition') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: makeTabIcon('progress') }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
