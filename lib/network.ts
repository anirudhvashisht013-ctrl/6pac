import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

type Listener = () => void;
type NetworkSnapshot = {
  isOnline: boolean;
  lastChangeAt: number;
};

let started = false;
let isOnline = true;
let lastChangeAt = Date.now();
const listeners = new Set<Listener>();
let snapshot: NetworkSnapshot = {
  isOnline,
  lastChangeAt,
};

function notify() {
  lastChangeAt = Date.now();
  snapshot = { isOnline, lastChangeAt };
  listeners.forEach((l) => l());
}

function computeOnline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function startNetworkListener() {
  if (started) return;
  started = true;

  void NetInfo.fetch().then((state) => {
    isOnline = computeOnline(state);
    notify();
  });

  NetInfo.addEventListener((state) => {
    const next = computeOnline(state);
    if (next !== isOnline) {
      isOnline = next;
      notify();
    }
  });
}

export function getIsOnline() {
  return isOnline;
}

export function subscribeNetworkStatus(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNetworkStatus() {
  const state = useSyncExternalStore(
    subscribeNetworkStatus,
    () => snapshot,
    () => snapshot
  );
  return state;
}
