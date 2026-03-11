import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { workoutsRepo } from "@/lib/storage";
import type { WorkoutTemplate } from "@/lib/types";
import { generateFriendRefId, isValidFriendRefId, normalizeFriendRefId } from "@/lib/friends/id";
import type {
  FriendActionResult,
  FriendRequestStatus,
  FriendRequestView,
  FriendSearchResult,
  FriendsDashboard,
  FriendSummary,
  FriendUserSummary,
  SendFriendRequestResult,
  SharedWorkoutView,
} from "@/lib/friends/types";

const FRIEND_REFS_COLLECTION = "friend_refs_v1";
const FRIEND_REQUESTS_COLLECTION = "friend_requests_v1";
const FRIENDSHIPS_COLLECTION = "friendships_v1";
const SHARED_WORKOUTS_COLLECTION = "shared_workouts_v1";
const SHARED_WORKOUT_COPIES_COLLECTION = "shared_workout_copies_v1";
const CACHE_KEY = (uid: string) => `@6pac:friends_dashboard_v1:${uid}`;
const REF_COLLISION_ERROR = "friend_ref_collision";

type FriendRequestDoc = {
  pairKey: string;
  requesterUid: string;
  receiverUid: string;
  status: FriendRequestStatus;
  requestedAt?: unknown;
  respondedAt?: unknown;
  requesterName?: string | null;
  requesterFriendRefId?: string | null;
  requesterEmail?: string | null;
  receiverName?: string | null;
  receiverFriendRefId?: string | null;
  receiverEmail?: string | null;
};

type FriendshipDoc = {
  userAUid: string;
  userBUid: string;
  memberUids: string[];
  createdAt?: unknown;
};

type SharedWorkoutDoc = {
  ownerUid: string;
  templateId: string;
  template: WorkoutTemplate;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type SharedWorkoutCopyDoc = {
  ownerUid: string;
  copierUid: string;
  sourceTemplateId: string;
  copiedTemplateId: string;
  createdAt?: unknown;
};

function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("__");
}

function otherUidFromFriendship(uid: string, friendship: FriendshipDoc): string | null {
  if (friendship.userAUid === uid) return friendship.userBUid;
  if (friendship.userBUid === uid) return friendship.userAUid;
  return null;
}

function copyEventDocId(ownerUid: string, copierUid: string, sourceTemplateId: string): string {
  return `${encodeURIComponent(ownerUid)}__${encodeURIComponent(copierUid)}__${encodeURIComponent(sourceTemplateId)}`;
}

function toIso(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value && typeof value === "object") {
    const anyValue = value as { toDate?: () => Date; seconds?: number };
    if (typeof anyValue.toDate === "function") {
      try {
        const asDate = anyValue.toDate();
        if (asDate instanceof Date) return asDate.toISOString();
      } catch {
        return null;
      }
    }
    if (typeof anyValue.seconds === "number") {
      return new Date(anyValue.seconds * 1000).toISOString();
    }
  }
  return null;
}

function sortByRecentIso<T>(items: T[], getIso: (item: T) => string | null): T[] {
  return [...items].sort((a, b) => {
    const aIso = getIso(a);
    const bIso = getIso(b);
    if (!aIso && !bIso) return 0;
    if (!aIso) return 1;
    if (!bIso) return -1;
    return bIso.localeCompare(aIso);
  });
}

function normalizeRefFromUnknown(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = normalizeFriendRefId(raw);
  return isValidFriendRefId(normalized) ? normalized : null;
}

async function getUserSummary(uid: string): Promise<FriendUserSummary> {
  const profileSnap = await getDoc(doc(getFirebaseDb(), "users", uid));
  const profile = (profileSnap.data() || {}) as Record<string, unknown>;

  return {
    uid,
    fullName: typeof profile.fullName === "string" ? profile.fullName : null,
    email: typeof profile.email === "string" ? profile.email : null,
    friendRefId: normalizeRefFromUnknown(profile.friendRefId),
  };
}

async function getUserSummaryMap(uids: string[]): Promise<Map<string, FriendUserSummary>> {
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const entries = await Promise.all(
    unique.map(async (uid) => {
      const summary = await getUserSummary(uid);
      return [uid, summary] as const;
    })
  );

  return new Map(entries);
}

function toRequestView(
  currentUid: string,
  request: FriendRequestDoc,
  summaryMap: Map<string, FriendUserSummary>
): FriendRequestView {
  const otherUid = request.requesterUid === currentUid ? request.receiverUid : request.requesterUid;
  const snapshotFallback: FriendUserSummary =
    request.requesterUid === currentUid
      ? {
          uid: request.receiverUid,
          fullName: request.receiverName || null,
          email: request.receiverEmail || null,
          friendRefId: normalizeRefFromUnknown(request.receiverFriendRefId) || null,
        }
      : {
          uid: request.requesterUid,
          fullName: request.requesterName || null,
          email: request.requesterEmail || null,
          friendRefId: normalizeRefFromUnknown(request.requesterFriendRefId) || null,
        };

  const otherUser = summaryMap.get(otherUid) || snapshotFallback;

  return {
    pairKey: request.pairKey,
    status: request.status,
    requesterUid: request.requesterUid,
    receiverUid: request.receiverUid,
    requestedAt: toIso(request.requestedAt),
    respondedAt: toIso(request.respondedAt),
    otherUser,
  };
}

function buildFriendCopyTag(fullName: string | null, email: string | null): string {
  const source = (fullName || "").trim() || ((email || "").split("@")[0] || "").trim();
  const cleaned = source.replace(/[^a-zA-Z]/g, "");
  const tag = cleaned.slice(0, 3);
  if (!tag) return "FRD";
  if (tag.length === 1) return tag.toUpperCase();
  return tag[0].toUpperCase() + tag.slice(1).toLowerCase();
}

function copyName(baseName: string, existingNames: Set<string>, friendCopyTag: string): string {
  const base = `${baseName} (Copy ${friendCopyTag})`;
  if (!existingNames.has(base.toLowerCase())) return base;

  let idx = 2;
  while (idx < 2000) {
    const candidate = `${baseName} (Copy ${friendCopyTag} ${idx})`;
    if (!existingNames.has(candidate.toLowerCase())) return candidate;
    idx += 1;
  }

  return `${baseName} (Copy ${friendCopyTag} ${Date.now()})`;
}

async function writeDashboardCache(uid: string, dashboard: FriendsDashboard): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY(uid), JSON.stringify(dashboard));
}

async function readDashboardCache(uid: string): Promise<FriendsDashboard | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY(uid));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FriendsDashboard;
    return {
      ...parsed,
      fromCache: true,
    };
  } catch {
    return null;
  }
}

async function buildDashboardFromDocs(
  uid: string,
  myFriendRefId: string,
  incomingDocs: FriendRequestDoc[],
  sentDocs: FriendRequestDoc[],
  friendshipDocs: FriendshipDoc[],
  copyEvents: SharedWorkoutCopyDoc[]
): Promise<FriendsDashboard> {
  const relevantUids = new Set<string>();
  incomingDocs.forEach((request) => {
    relevantUids.add(request.requesterUid);
    relevantUids.add(request.receiverUid);
  });
  sentDocs.forEach((request) => {
    relevantUids.add(request.requesterUid);
    relevantUids.add(request.receiverUid);
  });

  const friendUids = friendshipDocs
    .map((friendship) => otherUidFromFriendship(uid, friendship))
    .filter((x): x is string => typeof x === "string");
  friendUids.forEach((friendUid) => relevantUids.add(friendUid));

  relevantUids.delete(uid);
  const summaryMap = await getUserSummaryMap(Array.from(relevantUids));

  const incoming = sortByRecentIso(
    incomingDocs.map((request) => toRequestView(uid, request, summaryMap)),
    (item) => item.requestedAt
  );

  const sent = sortByRecentIso(
    sentDocs.map((request) => toRequestView(uid, request, summaryMap)),
    (item) => item.requestedAt
  );

  const friends = sortByRecentIso(
    friendUids.map((friendUid) => {
      const summary = summaryMap.get(friendUid) || {
        uid: friendUid,
        friendRefId: null,
        fullName: null,
        email: null,
      };

      const friendship = friendshipDocs.find((item) => otherUidFromFriendship(uid, item) === friendUid);
      const copiedMyWorkoutsCount = copyEvents.filter((event) => event.copierUid === friendUid).length;

      return {
        ...summary,
        sinceAt: toIso(friendship?.createdAt),
        copiedMyWorkoutsCount,
      } satisfies FriendSummary;
    }),
    (item) => item.sinceAt
  );

  return {
    myFriendRefId,
    incoming,
    sent,
    friends,
    fromCache: false,
  };
}

export async function ensureMyFriendRefId(uid: string): Promise<string> {
  const userRef = doc(getFirebaseDb(), "users", uid);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateFriendRefId();

    try {
      const claimed = await runTransaction(getFirebaseDb(), async (tx) => {
        const userSnap = await tx.get(userRef);
        const profile = (userSnap.data() || {}) as Record<string, unknown>;
        const existing = normalizeRefFromUnknown(profile.friendRefId);

        if (existing) {
          const existingRef = doc(getFirebaseDb(), FRIEND_REFS_COLLECTION, existing);
          const existingRefSnap = await tx.get(existingRef);
          const existingOwner = (existingRefSnap.data() as { uid?: unknown } | undefined)?.uid;

          if (!existingRefSnap.exists() || existingOwner === uid) {
            tx.set(
              existingRef,
              {
                uid,
                refId: existing,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );

            if (profile.friendRefId !== existing) {
              tx.set(
                userRef,
                {
                  uid,
                  friendRefId: existing,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }

            return existing;
          }
        }

        const friendRef = doc(getFirebaseDb(), FRIEND_REFS_COLLECTION, candidate);
        const friendRefSnap = await tx.get(friendRef);
        const ownerUid = (friendRefSnap.data() as { uid?: unknown } | undefined)?.uid;

        if (friendRefSnap.exists() && ownerUid !== uid) {
          throw new Error(REF_COLLISION_ERROR);
        }

        tx.set(
          friendRef,
          {
            uid,
            refId: candidate,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        tx.set(
          userRef,
          {
            uid,
            friendRefId: candidate,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        return candidate;
      });

      if (isValidFriendRefId(claimed)) return claimed;
    } catch (error) {
      if ((error as Error)?.message === REF_COLLISION_ERROR) continue;
      throw error;
    }
  }

  throw new Error("unable_to_allocate_friend_id");
}

export async function searchUserByFriendRefId(currentUid: string, rawValue: string): Promise<FriendSearchResult> {
  const normalized = normalizeFriendRefId(rawValue);
  if (!isValidFriendRefId(normalized)) {
    return { ok: false, code: "invalid_id" };
  }

  const snap = await getDoc(doc(getFirebaseDb(), FRIEND_REFS_COLLECTION, normalized));
  if (!snap.exists()) {
    return { ok: false, code: "not_found" };
  }

  const targetUid = (snap.data() as { uid?: unknown }).uid;
  if (typeof targetUid !== "string") {
    return { ok: false, code: "not_found" };
  }

  if (targetUid === currentUid) {
    return { ok: false, code: "self" };
  }

  const summary = await getUserSummary(targetUid);
  return { ok: true, user: summary };
}

export async function sendFriendRequestByRefId(
  currentUid: string,
  rawValue: string
): Promise<SendFriendRequestResult> {
  const searchResult = await searchUserByFriendRefId(currentUid, rawValue);
  if (!searchResult.ok) {
    if (searchResult.code === "invalid_id") return { ok: false, code: "invalid_id" };
    if (searchResult.code === "self") return { ok: false, code: "self" };
    return { ok: false, code: "not_found" };
  }

  const targetUid = searchResult.user.uid;
  const pairKey = pairKeyFor(currentUid, targetUid);
  const [requesterSummary, receiverSummary] = await Promise.all([
    getUserSummary(currentUid),
    Promise.resolve(searchResult.user),
  ]);

  try {
    await runTransaction(getFirebaseDb(), async (tx) => {
      const requestRef = doc(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION, pairKey);
      const friendshipRef = doc(getFirebaseDb(), FRIENDSHIPS_COLLECTION, pairKey);

      const [requestSnap, friendshipSnap] = await Promise.all([tx.get(requestRef), tx.get(friendshipRef)]);

      if (friendshipSnap.exists()) {
        throw new Error("already_friends");
      }

      const request = (requestSnap.data() || {}) as FriendRequestDoc;
      if (requestSnap.exists()) {
        if (request.status === "accepted" && friendshipSnap.exists()) {
          throw new Error("already_friends");
        }

        if (request.status === "pending") {
          if (request.requesterUid === currentUid) {
            throw new Error("duplicate_request");
          }
          if (request.receiverUid === currentUid) {
            throw new Error("incoming_pending");
          }
        }
      }

      tx.set(
        requestRef,
        {
          pairKey,
          requesterUid: currentUid,
          receiverUid: targetUid,
          requesterName: requesterSummary.fullName,
          requesterFriendRefId: requesterSummary.friendRefId,
          requesterEmail: requesterSummary.email,
          receiverName: receiverSummary.fullName,
          receiverFriendRefId: receiverSummary.friendRefId,
          receiverEmail: receiverSummary.email,
          status: "pending",
          requestedAt: serverTimestamp(),
          respondedAt: null,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true, targetUid };
  } catch (error) {
    const code = (error as Error)?.message;
    if (code === "already_friends") return { ok: false, code: "already_friends" };
    if (code === "duplicate_request") return { ok: false, code: "duplicate_request" };
    if (code === "incoming_pending") return { ok: false, code: "incoming_pending" };
    return { ok: false, code: "failed" };
  }
}

export async function acceptFriendRequest(currentUid: string, pairKey: string): Promise<FriendActionResult> {
  try {
    await runTransaction(getFirebaseDb(), async (tx) => {
      const requestRef = doc(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION, pairKey);
      const requestSnap = await tx.get(requestRef);

      if (!requestSnap.exists()) {
        throw new Error("not_found");
      }

      const request = requestSnap.data() as FriendRequestDoc;
      if (request.status !== "pending" || request.receiverUid !== currentUid) {
        throw new Error("invalid_state");
      }

      const friendshipRef = doc(getFirebaseDb(), FRIENDSHIPS_COLLECTION, pairKey);
      const [userAUid, userBUid] = [request.requesterUid, request.receiverUid].sort();

      tx.set(
        requestRef,
        {
          status: "accepted",
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        friendshipRef,
        {
          pairKey,
          userAUid,
          userBUid,
          memberUids: [userAUid, userBUid],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true };
  } catch (error) {
    const code = (error as Error)?.message;
    if (code === "not_found") return { ok: false, code: "not_found" };
    if (code === "invalid_state") return { ok: false, code: "invalid_state" };
    return { ok: false, code: "failed" };
  }
}

export async function declineFriendRequest(currentUid: string, pairKey: string): Promise<FriendActionResult> {
  try {
    await runTransaction(getFirebaseDb(), async (tx) => {
      const requestRef = doc(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION, pairKey);
      const requestSnap = await tx.get(requestRef);

      if (!requestSnap.exists()) {
        throw new Error("not_found");
      }

      const request = requestSnap.data() as FriendRequestDoc;
      if (request.status !== "pending" || request.receiverUid !== currentUid) {
        throw new Error("invalid_state");
      }

      tx.set(
        requestRef,
        {
          status: "declined",
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true };
  } catch (error) {
    const code = (error as Error)?.message;
    if (code === "not_found") return { ok: false, code: "not_found" };
    if (code === "invalid_state") return { ok: false, code: "invalid_state" };
    return { ok: false, code: "failed" };
  }
}

export async function cancelSentFriendRequest(currentUid: string, pairKey: string): Promise<FriendActionResult> {
  try {
    await runTransaction(getFirebaseDb(), async (tx) => {
      const requestRef = doc(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION, pairKey);
      const requestSnap = await tx.get(requestRef);

      if (!requestSnap.exists()) {
        throw new Error("not_found");
      }

      const request = requestSnap.data() as FriendRequestDoc;
      if (request.status !== "pending" || request.requesterUid !== currentUid) {
        throw new Error("invalid_state");
      }

      tx.set(
        requestRef,
        {
          status: "cancelled",
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true };
  } catch (error) {
    const code = (error as Error)?.message;
    if (code === "not_found") return { ok: false, code: "not_found" };
    if (code === "invalid_state") return { ok: false, code: "invalid_state" };
    return { ok: false, code: "failed" };
  }
}

export async function removeFriend(currentUid: string, friendUid: string): Promise<FriendActionResult> {
  const pairKey = pairKeyFor(currentUid, friendUid);

  try {
    await runTransaction(getFirebaseDb(), async (tx) => {
      const friendshipRef = doc(getFirebaseDb(), FRIENDSHIPS_COLLECTION, pairKey);
      const requestRef = doc(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION, pairKey);

      const [friendshipSnap, requestSnap] = await Promise.all([tx.get(friendshipRef), tx.get(requestRef)]);

      if (!friendshipSnap.exists()) {
        throw new Error("not_found");
      }

      tx.delete(friendshipRef);

      if (requestSnap.exists()) {
        tx.set(
          requestRef,
          {
            status: "cancelled",
            respondedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    return { ok: true };
  } catch (error) {
    const code = (error as Error)?.message;
    if (code === "not_found") return { ok: false, code: "not_found" };
    return { ok: false, code: "failed" };
  }
}

export async function loadFriendsDashboard(uid: string): Promise<FriendsDashboard> {
  const cached = await readDashboardCache(uid);

  try {
    const myFriendRefId = await ensureMyFriendRefId(uid);

    const [incomingSnap, sentSnap, friendshipsSnap, copyEventsSnap] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION), where("receiverUid", "==", uid))),
      getDocs(query(collection(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION), where("requesterUid", "==", uid))),
      getDocs(query(collection(getFirebaseDb(), FRIENDSHIPS_COLLECTION), where("memberUids", "array-contains", uid))),
      getDocs(query(collection(getFirebaseDb(), SHARED_WORKOUT_COPIES_COLLECTION), where("ownerUid", "==", uid))),
    ]);

    const incomingDocs = incomingSnap.docs
      .map((d) => d.data() as FriendRequestDoc)
      .filter((request) => request.status === "pending");
    const sentDocs = sentSnap.docs
      .map((d) => d.data() as FriendRequestDoc)
      .filter((request) => request.status === "pending");
    const friendshipDocs = friendshipsSnap.docs.map((d) => d.data() as FriendshipDoc);
    const copyEvents = copyEventsSnap.docs.map((d) => d.data() as SharedWorkoutCopyDoc);

    const fresh = await buildDashboardFromDocs(uid, myFriendRefId, incomingDocs, sentDocs, friendshipDocs, copyEvents);

    await writeDashboardCache(uid, fresh);
    return fresh;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

export function subscribeFriendsDashboard(
  uid: string,
  handlers: {
    onData: (dashboard: FriendsDashboard) => void;
    onError?: (error: unknown) => void;
  }
): Unsubscribe {
  let active = true;
  let incomingDocs: FriendRequestDoc[] = [];
  let sentDocs: FriendRequestDoc[] = [];
  let friendshipDocs: FriendshipDoc[] = [];
  let copyEvents: SharedWorkoutCopyDoc[] = [];
  let hasIncoming = false;
  let hasSent = false;
  let hasFriendships = false;
  let hasCopyEvents = false;
  let pendingEmit: Promise<void> = Promise.resolve();

  void readDashboardCache(uid).then((cached) => {
    if (active && cached) {
      handlers.onData(cached);
    }
  });

  const emit = () => {
    if (!active || !hasIncoming || !hasSent || !hasFriendships || !hasCopyEvents) return;

    pendingEmit = pendingEmit
      .catch(() => undefined)
      .then(async () => {
        const myFriendRefId = await ensureMyFriendRefId(uid);
        const dashboard = await buildDashboardFromDocs(
          uid,
          myFriendRefId,
          incomingDocs,
          sentDocs,
          friendshipDocs,
          copyEvents
        );
        await writeDashboardCache(uid, dashboard);
        if (active) handlers.onData(dashboard);
      })
      .catch((error) => {
        if (active) handlers.onError?.(error);
      });
  };

  const unsubIncoming = onSnapshot(
    query(collection(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION), where("receiverUid", "==", uid)),
    (snap) => {
      hasIncoming = true;
      incomingDocs = snap.docs
        .map((d) => d.data() as FriendRequestDoc)
        .filter((request) => request.status === "pending");
      emit();
    },
    (error) => handlers.onError?.(error)
  );

  const unsubSent = onSnapshot(
    query(collection(getFirebaseDb(), FRIEND_REQUESTS_COLLECTION), where("requesterUid", "==", uid)),
    (snap) => {
      hasSent = true;
      sentDocs = snap.docs
        .map((d) => d.data() as FriendRequestDoc)
        .filter((request) => request.status === "pending");
      emit();
    },
    (error) => handlers.onError?.(error)
  );

  const unsubFriendships = onSnapshot(
    query(collection(getFirebaseDb(), FRIENDSHIPS_COLLECTION), where("memberUids", "array-contains", uid)),
    (snap) => {
      hasFriendships = true;
      friendshipDocs = snap.docs.map((d) => d.data() as FriendshipDoc);
      emit();
    },
    (error) => handlers.onError?.(error)
  );

  const unsubCopyEvents = onSnapshot(
    query(collection(getFirebaseDb(), SHARED_WORKOUT_COPIES_COLLECTION), where("ownerUid", "==", uid)),
    (snap) => {
      hasCopyEvents = true;
      copyEvents = snap.docs.map((d) => d.data() as SharedWorkoutCopyDoc);
      emit();
    },
    (error) => handlers.onError?.(error)
  );

  return () => {
    active = false;
    unsubIncoming();
    unsubSent();
    unsubFriendships();
    unsubCopyEvents();
  };
}

export async function loadFriendSharedWorkouts(
  currentUid: string,
  friendUid: string
): Promise<SharedWorkoutView[]> {
  const pairKey = pairKeyFor(currentUid, friendUid);
  const friendshipSnap = await getDoc(doc(getFirebaseDb(), FRIENDSHIPS_COLLECTION, pairKey));
  if (!friendshipSnap.exists()) return [];

  const snaps = await getDocs(
    query(collection(getFirebaseDb(), SHARED_WORKOUTS_COLLECTION), where("ownerUid", "==", friendUid))
  );

  const shared = snaps.docs
    .map((snap) => {
      const data = snap.data() as SharedWorkoutDoc;
      return {
        id: snap.id,
        ownerUid: data.ownerUid,
        templateId: data.templateId,
        template: data.template,
        updatedAt: toIso(data.updatedAt),
        createdAt: toIso(data.createdAt),
      } satisfies SharedWorkoutView;
    })
    .filter((item) => !!item.template && item.template.sharedWithFriends)
    .sort((a, b) => {
      const aTs = a.updatedAt || a.template.updatedAt || "";
      const bTs = b.updatedAt || b.template.updatedAt || "";
      return bTs.localeCompare(aTs);
    });

  return shared;
}

export async function copySharedWorkoutToMyAccount(
  uid: string,
  sharedWorkout: SharedWorkoutView
): Promise<WorkoutTemplate> {
  const copyEventRef = doc(
    getFirebaseDb(),
    SHARED_WORKOUT_COPIES_COLLECTION,
    copyEventDocId(sharedWorkout.ownerUid, uid, sharedWorkout.templateId)
  );
  const existingCopy = await getDoc(copyEventRef);
  if (existingCopy.exists()) {
    throw new Error("already_copied");
  }

  const [existingTemplates, ownerSummary] = await Promise.all([
    workoutsRepo.getAll(uid),
    getUserSummary(sharedWorkout.ownerUid),
  ]);
  const existingNames = new Set(existingTemplates.map((template) => template.name.trim().toLowerCase()));
  const cloned = JSON.parse(JSON.stringify(sharedWorkout.template)) as WorkoutTemplate;
  const friendCopyTag = buildFriendCopyTag(ownerSummary.fullName, ownerSummary.email);

  const now = new Date().toISOString();
  const duplicated: WorkoutTemplate = {
    ...cloned,
    id: Crypto.randomUUID(),
    name: copyName(cloned.name, existingNames, friendCopyTag),
    sharedWithFriends: false,
    createdAt: now,
    updatedAt: now,
  };

  await workoutsRepo.save(uid, duplicated);
  await setDoc(copyEventRef, {
    ownerUid: sharedWorkout.ownerUid,
    copierUid: uid,
    sourceTemplateId: sharedWorkout.templateId,
    copiedTemplateId: duplicated.id,
    sourceTemplateName: sharedWorkout.template.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return duplicated;
}

export async function loadCopiedTemplateIdsFromOwner(copierUid: string, ownerUid: string): Promise<Set<string>> {
  const snaps = await getDocs(
    query(collection(getFirebaseDb(), SHARED_WORKOUT_COPIES_COLLECTION), where("ownerUid", "==", ownerUid))
  );

  const copiedIds = new Set<string>();
  snaps.docs.forEach((snap) => {
    const data = snap.data() as SharedWorkoutCopyDoc;
    if (data.copierUid === copierUid && typeof data.sourceTemplateId === "string") {
      copiedIds.add(data.sourceTemplateId);
    }
  });

  return copiedIds;
}

export async function removeStaleSharedWorkoutDoc(ownerUid: string, templateId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), SHARED_WORKOUTS_COLLECTION, `${ownerUid}__${templateId}`));
}
