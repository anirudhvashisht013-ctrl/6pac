import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import {
  disableNetwork,
  enableIndexedDbPersistence,
  enableNetwork,
  getFirestore,
} from "firebase/firestore";
import { getIsOnline, startNetworkListener, subscribeNetworkStatus } from "@/lib/network";

const rawFirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} as const;

function isMissingFirebaseEnv(value: string | undefined): boolean {
  const normalized = value?.trim() ?? "";
  const lowered = normalized.toLowerCase();

  return !normalized || lowered === "undefined" || lowered === "null";
}

function requireFirebaseEnv(value: string | undefined, envName: string): string {
  if (isMissingFirebaseEnv(value)) {
    throw new Error(`[Firebase] Missing required env var: ${envName}`);
  }

  return value!.trim();
}

function assertFirebaseEnvOrThrow() {
  const requiredEnvEntries: Array<[string, string | undefined]> = [
    ["EXPO_PUBLIC_FIREBASE_API_KEY", rawFirebaseConfig.apiKey],
    ["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", rawFirebaseConfig.authDomain],
    ["EXPO_PUBLIC_FIREBASE_PROJECT_ID", rawFirebaseConfig.projectId],
    ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", rawFirebaseConfig.storageBucket],
    ["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", rawFirebaseConfig.messagingSenderId],
    ["EXPO_PUBLIC_FIREBASE_APP_ID", rawFirebaseConfig.appId],
  ];

  const missingEnvVars = requiredEnvEntries
    .filter(([, value]) => isMissingFirebaseEnv(value))
    .map(([envName]) => envName);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `[Firebase] Missing required Expo env vars: ${missingEnvVars.join(", ")}. ` +
      "Set these EXPO_PUBLIC_FIREBASE_* values in your release build environment."
    );
  }
}

function buildFirebaseConfig(): FirebaseOptions {
  assertFirebaseEnvOrThrow();

  return {
    apiKey: requireFirebaseEnv(rawFirebaseConfig.apiKey, "EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requireFirebaseEnv(rawFirebaseConfig.authDomain, "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requireFirebaseEnv(rawFirebaseConfig.projectId, "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requireFirebaseEnv(rawFirebaseConfig.storageBucket, "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireFirebaseEnv(
      rawFirebaseConfig.messagingSenderId,
      "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    ),
    appId: requireFirebaseEnv(rawFirebaseConfig.appId, "EXPO_PUBLIC_FIREBASE_APP_ID"),
  };
}

function createFirebaseDiagnostics() {
  return {
    hasApiKey: !isMissingFirebaseEnv(rawFirebaseConfig.apiKey),
    apiKeyLength: rawFirebaseConfig.apiKey?.trim().length ?? 0,
    projectId: rawFirebaseConfig.projectId?.trim() ?? "",
    authDomain: rawFirebaseConfig.authDomain?.trim() ?? "",
    appIdLength: rawFirebaseConfig.appId?.trim().length ?? 0,
  };
}

const firebaseDiagnostics = createFirebaseDiagnostics();

let firebaseConfig: FirebaseOptions;
try {
  firebaseConfig = buildFirebaseConfig();
  console.info("[Firebase] startup config diagnostics", firebaseDiagnostics);
} catch (error) {
  console.error("[Firebase] Invalid startup config", firebaseDiagnostics);
  throw error;
}

export function getFirebaseStartupDiagnostics() {
  return { ...firebaseDiagnostics };
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

type AuthDeps = Parameters<typeof FirebaseAuth.initializeAuth>[1];

function getAuthDependencies(): AuthDeps | undefined {
  if (Platform.OS === "web") {
    return {
      persistence: FirebaseAuth.browserLocalPersistence,
    };
  }

  const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence as
    | ((storage: typeof AsyncStorage) => unknown)
    | undefined;

  if (typeof getReactNativePersistence === "function") {
    return {
      persistence: getReactNativePersistence(AsyncStorage),
    } as AuthDeps;
  }

  return undefined;
}

export const auth = (() => {
  const deps = getAuthDependencies();
  try {
    return deps ? FirebaseAuth.initializeAuth(app, deps) : FirebaseAuth.initializeAuth(app);
  } catch {
    return FirebaseAuth.getAuth(app);
  }
})();

export type FirebaseUser = FirebaseAuth.User;

export function onAuthStateChanged(
  authInstance: FirebaseAuth.Auth,
  nextOrObserver: (...args: any[]) => void,
  error?: (...args: any[]) => void,
  completed?: (...args: any[]) => void
) {
  return FirebaseAuth.onAuthStateChanged(authInstance, nextOrObserver as any, error as any, completed as any);
}

export function signInWithEmailAndPassword(authInstance: FirebaseAuth.Auth, email: string, password: string) {
  return FirebaseAuth.signInWithEmailAndPassword(authInstance, email, password);
}

export function createUserWithEmailAndPassword(authInstance: FirebaseAuth.Auth, email: string, password: string) {
  return FirebaseAuth.createUserWithEmailAndPassword(authInstance, email, password);
}

export function signOut(authInstance: FirebaseAuth.Auth) {
  return FirebaseAuth.signOut(authInstance);
}

export const db = getFirestore(app);

let firestoreOfflineUnsub: (() => void) | null = null;
let firestoreNetworkUpdate: Promise<void> = Promise.resolve();

async function applyFirestoreNetworkState() {
  const isOnline = getIsOnline();
  try {
    if (isOnline) {
      console.log("🟢 Firestore: enabling network");
      await enableNetwork(db);
    } else {
      console.log("🔴 Firestore: disabling network");
      await disableNetwork(db);
    }
  } catch (error) {
    console.error("Firestore network state update error:", error);
  }
}

export async function initializeFirestoreOffline(): Promise<() => void> {
  if (firestoreOfflineUnsub) {
    return firestoreOfflineUnsub;
  }

  startNetworkListener();

  if (Platform.OS === "web") {
    try {
      await enableIndexedDbPersistence(db);
      console.log("Firestore offline persistence enabled (web)");
    } catch (err: any) {
      if (err?.code === "failed-precondition") {
        console.warn("Firestore persistence unavailable: multiple tabs open");
      } else if (err?.code === "unimplemented") {
        console.warn("Firestore persistence unavailable: browser does not support IndexedDB");
      } else {
        console.error("Firestore persistence setup error:", err);
      }
    }
  } else if (__DEV__) {
    console.log(`Firestore IndexedDB persistence skipped on ${Platform.OS}`);
  }

  await applyFirestoreNetworkState();

  const unsubscribe = subscribeNetworkStatus(() => {
    firestoreNetworkUpdate = firestoreNetworkUpdate
      .catch(() => undefined)
      .then(() => applyFirestoreNetworkState());
  });

  firestoreOfflineUnsub = () => {
    unsubscribe();
    firestoreOfflineUnsub = null;
  };

  return firestoreOfflineUnsub;
}
