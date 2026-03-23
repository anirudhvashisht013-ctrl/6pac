import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

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

  if (Platform.OS === "android") {
    return !isExpoGo && Boolean(config.webClientId);
  }

  return false;
}

let configuredWebClientId: string | null = null;

export function getGoogleAuthRequestConfig() {
  const config = getGoogleAuthRuntimeConfig();

  return {
    androidClientId: config.androidClientId || undefined,
    webClientId: config.webClientId || undefined,
  };
}

export function ensureGoogleAuthConfigured() {
  const { webClientId } = getGoogleAuthRuntimeConfig();
  if (!webClientId) {
    throw new Error("Google auth is not configured for this app build.");
  }

  if (configuredWebClientId === webClientId) {
    return;
  }

  GoogleSignin.configure({
    webClientId,
  });

  configuredWebClientId = webClientId;
}

export async function signInWithGoogleNative(): Promise<string | null> {
  ensureGoogleAuthConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = (await GoogleSignin.signIn()) as
    | { type?: string; data?: { idToken?: string | null } }
    | { idToken?: string | null };

  if ("type" in response && !isSuccessResponse(response as never)) {
    return null;
  }

  const idToken =
    "data" in response
      ? response.data?.idToken ?? null
      : "idToken" in response
        ? response.idToken ?? null
        : null;
  if (!idToken) {
    throw new Error("Google sign in did not return an id token.");
  }

  return idToken;
}

export function mapGoogleAuthError(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return "";
      case statusCodes.IN_PROGRESS:
        return "Google sign in is already in progress.";
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return "Google Play Services are not available on this device.";
      default:
        return error.message || "Google sign in failed.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Google sign in failed.";
}
