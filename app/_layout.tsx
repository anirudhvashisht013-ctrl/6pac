// app/_layout.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SubtleSplash from "@/components/SubtleSplash";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { C } from "@/constants/colors";
import { initializeMirrorQueue } from "@/lib/sync/mirrorQueue";

// keep the native splash open until we've finished preparing JS state
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading, isProfileComplete } = useAuth();

  useEffect(() => {
    initializeMirrorQueue();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    SplashScreen.hideAsync();

    if (!user) router.replace("/(auth)/login");
    else if (!isProfileComplete) router.replace("/(auth)/onboarding");
    else router.replace("/(tabs)");
  }, [user, isLoading, isProfileComplete]);

  // while auth state is being restored, show minimal branded splash
  if (isLoading) return <SubtleSplash />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="(auth)" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ presentation: "fullScreenModal", headerShown: false }} />
      <Stack.Screen name="editor" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="measurements" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="profile-progress" options={{ headerShown: false }} />
      <Stack.Screen name="profile-measurements" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  if (!fontsLoaded) return <SubtleSplash />;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
