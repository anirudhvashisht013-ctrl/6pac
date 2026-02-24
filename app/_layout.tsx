import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { View } from 'react-native';
import { C } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading, isProfileComplete } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync();
    if (!user) {
      router.replace('/(auth)/login');
    } else if (!isProfileComplete) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, isProfileComplete]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="(auth)" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="editor" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="measurements" options={{ presentation: 'modal', headerShown: false }} />
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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

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
