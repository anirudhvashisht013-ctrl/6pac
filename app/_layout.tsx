import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import FeedbackToastHost from "@/components/FeedbackToastHost";
import SubtleSplash from "@/components/SubtleSplash";
import StartupFailureState from "@/components/StartupFailureState";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { FeedbackToastProvider } from "@/context/FeedbackToastContext";
import { ReminderProvider } from "@/context/ReminderContext";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { C } from "@/constants/colors";
import {
  getFirebaseBootstrapDiagnostics,
  initializeFirebase,
  initializeFirestoreOffline,
} from "@/lib/firebase";
import { initializeMirrorQueue } from "@/lib/sync/mirrorQueue";
import { installGlobalErrorCapture } from "@/lib/bootstrap/globalError";
import { logBoot, logError } from "@/lib/bootstrap/logger";

// keep the native splash open until we've finished preparing JS state
SplashScreen.preventAutoHideAsync();

type RootBootState =
  | { status: "booting" }
  | { status: "ready" }
  | { status: "failed"; message: string; details?: string };

function formatFailureDetails(error: unknown): string {
  const diagnostics = getFirebaseBootstrapDiagnostics();
  const lines = [
    `status: ${diagnostics.status}`,
    `step: ${diagnostics.step}`,
    `source: ${diagnostics.source}`,
    diagnostics.errorMessage ? `error: ${diagnostics.errorMessage}` : "error: unknown",
  ];

  if (diagnostics.issues.length > 0) {
    lines.push("issues:");
    for (const issue of diagnostics.issues) {
      lines.push(`- ${issue.key}: ${issue.reason}`);
    }
  }

  if (error instanceof Error && error.stack) {
    lines.push("stack:");
    lines.push(error.stack);
  }

  return lines.join("\n");
}

function RootLayoutNav() {
  const { user, isLoading, isProfileComplete } = useAuth();
  const appReadyLoggedRef = useRef(false);

  useEffect(() => {
    logBoot("App shell / first screen load started");
    initializeMirrorQueue();

    let unsubFirestore: (() => void) | undefined;
    let active = true;

    void initializeFirestoreOffline()
      .then((unsub) => {
        if (!active) {
          unsub();
          return;
        }
        unsubFirestore = unsub;
      })
      .catch((error) => {
        logError("Firestore offline initialization failed", error);
      });

    return () => {
      active = false;
      unsubFirestore?.();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    void SplashScreen.hideAsync();

    if (!appReadyLoggedRef.current) {
      appReadyLoggedRef.current = true;
      logBoot("App ready");
    }

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
      <Stack.Screen name="profile-friends" options={{ headerShown: false }} />
      <Stack.Screen name="profile-friend-workouts" options={{ headerShown: false }} />
      <Stack.Screen name="profile-friend-workouts-list" options={{ headerShown: false }} />
      <Stack.Screen name="reminders-settings" options={{ headerShown: false }} />
      <Stack.Screen name="exercises" options={{ headerShown: false }} />
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

  const [bootState, setBootState] = useState<RootBootState>({ status: "booting" });

  useEffect(() => {
    logBoot("App startup initiated");
    installGlobalErrorCapture();

    let cancelled = false;

    void (async () => {
      try {
        const result = await initializeFirebase();
        if (cancelled) return;

        if (!result.ok) {
          logError("Firebase startup failed", result.error, {
            step: result.diagnostics.step,
            source: result.diagnostics.source,
          });
          setBootState({
            status: "failed",
            message: "Firebase configuration is invalid. Check environment variables and runtime config.",
            details: __DEV__ ? formatFailureDetails(result.error) : undefined,
          });
          return;
        }

        setBootState({ status: "ready" });
        logBoot("Firebase startup completed");
      } catch (error) {
        if (cancelled) return;

        logError("Fatal startup error while bootstrapping Firebase", error);
        setBootState({
          status: "failed",
          message: "Firebase configuration is invalid. Check environment variables and runtime config.",
          details: __DEV__ ? formatFailureDetails(error) : undefined,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    if (bootState.status !== "failed") return;

    void SplashScreen.hideAsync();
  }, [fontsLoaded, bootState.status]);

  if (!fontsLoaded || bootState.status === "booting") return <SubtleSplash />;

  if (bootState.status === "failed") {
    return <StartupFailureState message={bootState.message} details={bootState.details} />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReminderProvider>
            <SafeAreaProvider>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
                <FeedbackToastProvider>
                  <RootLayoutNav />
                  <FeedbackToastHost />
                </FeedbackToastProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </ReminderProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
