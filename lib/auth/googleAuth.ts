import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthExtra = {
  androidClientId?: unknown;
  webClientId?: unknown;
};

export type GoogleAuthRuntimeConfig = {
  androidClientId: string;
  webClientId: string;
};

function readGoogleAuthExtra(): GoogleAuthExtra | undefined {
  return (Constants.expoConfig?.extra as { googleAuth?: GoogleAuthExtra } | undefined)?.googleAuth;
}

export function getGoogleAuthRuntimeConfig(): GoogleAuthRuntimeConfig {
  const extra = readGoogleAuthExtra();

  return {
    androidClientId: typeof extra?.androidClientId === "string" ? extra.androidClientId : "",
    webClientId: typeof extra?.webClientId === "string" ? extra.webClientId : "",
  };
}

export function isGoogleAuthAvailable(): boolean {
  const config = getGoogleAuthRuntimeConfig();
  const executionEnvironment = (Constants as { executionEnvironment?: string }).executionEnvironment;
  const isExpoGo = executionEnvironment === "storeClient";

  if (Platform.OS === "web") {
    return Boolean(config.webClientId);
  }

  if (Platform.OS === "android") {
    return !isExpoGo && Boolean(config.androidClientId && config.webClientId);
  }

  return false;
}

export function getGoogleAuthRequestConfig() {
  const config = getGoogleAuthRuntimeConfig();

  return {
    androidClientId: config.androidClientId || undefined,
    webClientId: config.webClientId || undefined,
  };
}
