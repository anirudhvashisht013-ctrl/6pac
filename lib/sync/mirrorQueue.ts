import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseDb } from "@/lib/firebase";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getIsOnline, startNetworkListener, subscribeNetworkStatus } from "@/lib/network";
import { useSyncExternalStore } from "react";

type QueueAction = "upsert" | "delete";

type QueueItem = {
  uid: string;
  collectionName: string;
  docId: string;
  action: QueueAction;
  payload?: Record<string, unknown>;
  attempts: number;
  nextRetryAt: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

type MirrorSyncState = {
  pendingCount: number;
  syncing: boolean;
  isOnline: boolean;
  lastError: string | null;
  runTotal: number;
  runProcessed: number;
  nextRetryAt: number | null;
  lastSyncedAt: number | null;
  updatedAt: number;
};

const QUEUE_KEY = "@6pac:mirror_queue_v1";
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 5000;

let initialized = false;
let processing = false;
const stateListeners = new Set<() => void>();
let queueMutation: Promise<void> = Promise.resolve();

let mirrorSyncState: MirrorSyncState = {
  pendingCount: 0,
  syncing: false,
  isOnline: true,
  lastError: null,
  runTotal: 0,
  runProcessed: 0,
  nextRetryAt: null,
  lastSyncedAt: null,
  updatedAt: Date.now(),
};

function setState(patch: Partial<MirrorSyncState>) {
  mirrorSyncState = {
    ...mirrorSyncState,
    ...patch,
    updatedAt: Date.now(),
  };
  stateListeners.forEach((l) => l());
}

function runQueueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueMutation.then(fn, fn);
  queueMutation = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function loadQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  const now = Date.now();
  const nextRetryAt = queue
    .filter((q) => q.nextRetryAt > now)
    .reduce<number | null>((min, item) => {
      if (min == null) return item.nextRetryAt;
      return Math.min(min, item.nextRetryAt);
    }, null);
  setState({ pendingCount: queue.length, nextRetryAt });
}

function itemKey(i: Pick<QueueItem, "uid" | "collectionName" | "docId">) {
  return `${i.uid}::${i.collectionName}::${i.docId}`;
}

function nextRetry(attempts: number) {
  return Date.now() + Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

async function applyItem(item: QueueItem) {
  const ref = doc(getFirebaseDb(), "users", item.uid, item.collectionName, item.docId);
  if (item.action === "delete") {
    await deleteDoc(ref);
    return;
  }
  await setDoc(
    ref,
    {
      ...(item.payload || {}),
      mirroredAt: serverTimestamp(),
      mirrorVersion: 1,
    },
    { merge: true }
  );
}

export function initializeMirrorQueue() {
  if (initialized) return;
  initialized = true;

  startNetworkListener();
  setState({ isOnline: getIsOnline() });

  subscribeNetworkStatus(() => {
    const online = getIsOnline();
    setState({ isOnline: online });
    if (online) void processMirrorQueue();
  });

  void loadQueue().then((q) => {
    setState({ pendingCount: q.length });
    if (q.length > 0) void processMirrorQueue();
  });
}

export async function enqueueMirrorUpsert(
  uid: string,
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>
) {
  await runQueueMutation(async () => {
    const queue = await loadQueue();
    const k = itemKey({ uid, collectionName, docId });
    const next: QueueItem = {
      uid,
      collectionName,
      docId,
      action: "upsert",
      payload,
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const idx = queue.findIndex((i) => itemKey(i) === k);
    if (idx >= 0) queue[idx] = { ...queue[idx], ...next };
    else queue.push(next);

    await saveQueue(queue);
  });
  void processMirrorQueue();
}

export async function enqueueMirrorDelete(uid: string, collectionName: string, docId: string) {
  await runQueueMutation(async () => {
    const queue = await loadQueue();
    const k = itemKey({ uid, collectionName, docId });
    const next: QueueItem = {
      uid,
      collectionName,
      docId,
      action: "delete",
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const idx = queue.findIndex((i) => itemKey(i) === k);
    if (idx >= 0) queue[idx] = { ...queue[idx], ...next };
    else queue.push(next);

    await saveQueue(queue);
  });
  void processMirrorQueue();
}

export async function processMirrorQueue(opts?: { force?: boolean }) {
  if (processing) return;
  const force = !!opts?.force;
  if (!force && !getIsOnline()) return;

  processing = true;
  setState({ syncing: true, lastError: null, runProcessed: 0, runTotal: 0 });
  try {
    const now = Date.now();
    const dequeue = await runQueueMutation(async () => {
      const queue = await loadQueue();
      if (queue.length === 0) {
        return {
          due: [] as QueueItem[],
          wasEmpty: true,
        };
      }

      const keep: QueueItem[] = [];
      const dueItems: QueueItem[] = [];
      for (const item of queue) {
        if (force || item.nextRetryAt <= now) dueItems.push(item);
        else keep.push(item);
      }

      await saveQueue(keep);
      return {
        due: dueItems,
        wasEmpty: false,
      };
    });

    const due = dequeue.due;
    if (due.length === 0) {
      if (dequeue.wasEmpty) {
        setState({ pendingCount: 0, nextRetryAt: null });
      }
      setState({ syncing: false, runProcessed: 0, runTotal: 0 });
      return;
    }

    setState({ runTotal: due.length, runProcessed: 0 });

    const retryQueue: QueueItem[] = [];
    let processed = 0;
    let successCount = 0;

    for (const item of due) {
      try {
        await applyItem(item);
        successCount += 1;
        processed += 1;
        setState({ runProcessed: processed });
      } catch (err: any) {
        const attempts = item.attempts + 1;
        retryQueue.push({
          ...item,
          attempts,
          updatedAt: new Date().toISOString(),
          nextRetryAt: nextRetry(attempts),
          lastError: String(err?.message || err || "mirror_write_failed"),
        });
        processed += 1;
        setState({ runProcessed: processed });
        setState({ lastError: String(err?.message || err || "mirror_write_failed") });
      }
    }

    if (retryQueue.length > 0) {
      await runQueueMutation(async () => {
        const queue = await loadQueue();
        const merged = new Map<string, QueueItem>(queue.map((item) => [itemKey(item), item]));
        for (const item of retryQueue) {
          merged.set(itemKey(item), item);
        }
        await saveQueue(Array.from(merged.values()));
      });
    }

    if (successCount > 0 && retryQueue.length === 0) {
      setState({ lastSyncedAt: Date.now() });
    } else if (successCount > 0) {
      setState({ lastSyncedAt: Date.now() });
    }
  } finally {
    processing = false;
    setState({ syncing: false, runProcessed: 0, runTotal: 0 });
  }
}

export async function syncMirrorNow() {
  await runQueueMutation(async () => {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    const patched = queue.map((item) => ({
      ...item,
      nextRetryAt: Date.now(),
      updatedAt: new Date().toISOString(),
    }));
    await saveQueue(patched);
  });
  await processMirrorQueue({ force: true });
}

export function subscribeMirrorSyncState(listener: () => void) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function useMirrorSyncState() {
  return useSyncExternalStore(
    subscribeMirrorSyncState,
    () => mirrorSyncState,
    () => mirrorSyncState
  );
}
