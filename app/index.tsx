import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/userProfile";

type AppRoute = "/(auth)/login" | "/(auth)/onboarding" | "/(tabs)";

export default function Index() {
  const { user, isLoading } = useAuth();
  const hasNavigated = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Optional safety: if user changes, allow navigation again
    hasNavigated.current = false;

    const go = (path: AppRoute) => {
      if (cancelled) return;
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      router.replace(path);
    };

    const run = async () => {
      if (isLoading) return;

      if (!user?.id) {
        go("/(auth)/login");
        return;
      }

      try {
        const profile = await getUserProfile(user.id);

        if (!profile || !profile.onboardingDone) {
          go("/(auth)/onboarding");
          return;
        }

        go("/(tabs)");
      } catch {
        go("/(auth)/onboarding");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isLoading]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={C.primary} />
    </View>
  );
}