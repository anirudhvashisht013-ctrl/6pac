import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import firebaseCompat from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import {
  disableNetwork,
  enableIndexedDbPersistence,
  enableNetwork,
  getFirestore,
} from "firebase/firestore";
import { getIsOnline, startNetworkListener, subscribeNetworkStatus } from "@/lib/network";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

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

function getCompatApp() {
  return firebaseCompat.apps.length
    ? firebaseCompat.app()
    : firebaseCompat.initializeApp(firebaseConfig);
}

export const auth = (() => {
  const deps = getAuthDependencies();
  try {
    return deps ? FirebaseAuth.initializeAuth(app, deps) : FirebaseAuth.initializeAuth(app);
  } catch (initializeError) {
    try {
      return FirebaseAuth.getAuth(app);
    } catch {
      console.warn("Modular auth unavailable, falling back to compat auth.", initializeError);
      return getCompatApp().auth() as any;
    }
  }
})();

export type FirebaseUser = import("firebase/auth").User;
type CompatAuth = {
  onAuthStateChanged: (
    nextOrObserver: (...args: any[]) => void,
    error?: (...args: any[]) => void,
    completed?: (...args: any[]) => void
  ) => () => void;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<{ user: FirebaseUser }>;
  createUserWithEmailAndPassword: (email: string, password: string) => Promise<{ user: FirebaseUser }>;
  signOut: () => Promise<void>;
};

function isCompatAuthInstance(candidate: unknown): candidate is CompatAuth {
  const authCandidate = candidate as any;
  return !!authCandidate
    && typeof authCandidate.onAuthStateChanged === "function"
    && typeof authCandidate.signInWithEmailAndPassword === "function"
    && typeof authCandidate.createUserWithEmailAndPassword === "function"
    && typeof authCandidate.signOut === "function";
}

export function onAuthStateChanged(
  authInstance: any,
  nextOrObserver: (...args: any[]) => void,
  error?: (...args: any[]) => void,
  completed?: (...args: any[]) => void
) {
  if (isCompatAuthInstance(authInstance)) {
    return authInstance.onAuthStateChanged(nextOrObserver, error, completed);
  }
  return FirebaseAuth.onAuthStateChanged(authInstance, nextOrObserver as any, error as any, completed as any);
}

export function signInWithEmailAndPassword(authInstance: any, email: string, password: string) {
  if (isCompatAuthInstance(authInstance)) {
    return authInstance.signInWithEmailAndPassword(email, password);
  }
  return FirebaseAuth.signInWithEmailAndPassword(authInstance, email, password);
}

export function createUserWithEmailAndPassword(authInstance: any, email: string, password: string) {
  if (isCompatAuthInstance(authInstance)) {
    return authInstance.createUserWithEmailAndPassword(email, password);
  }
  return FirebaseAuth.createUserWithEmailAndPassword(authInstance, email, password);
}

export function signOut(authInstance: any) {
  if (isCompatAuthInstance(authInstance)) {
    return authInstance.signOut();
  }
  return FirebaseAuth.signOut(authInstance);
}

export const db = (() => {
  try {
    return getFirestore(app);
  } catch (error) {
    console.warn("Modular firestore unavailable, falling back to compat firestore.", error);
    return getCompatApp().firestore() as any;
  }
})();

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

  try {
    await enableIndexedDbPersistence(db);
    console.log("✅ Firestore offline persistence enabled");
  } catch (err: any) {
    if (err?.code === "failed-precondition") {
      console.warn("⚠️ Multiple tabs open, persistence not available");
    } else if (err?.code === "unimplemented") {
      console.warn("⚠️ Browser doesn't support offline persistence");
    } else {
      console.error("Firestore persistence error:", err);
    }
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
