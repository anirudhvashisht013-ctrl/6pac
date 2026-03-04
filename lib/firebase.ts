import { initializeApp, getApps, getApp } from "firebase/app";
import {
  disableNetwork,
  enableIndexedDbPersistence,
  enableNetwork,
  getFirestore,
} from "firebase/firestore";
import { initializeAuth, getAuth, browserLocalPersistence } from "firebase/auth";
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

/**
 * Firebase v12 React Native setup
 * No firebase/auth/react-native import required
 */
export const auth = (() => {
  try {
    return getAuth(app);
  } catch {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  }
})();

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
