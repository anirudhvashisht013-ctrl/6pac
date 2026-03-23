import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { syncMyPublicIdentityClaim } from "@/lib/friends/service";
import {
  getAccountProfileBridgeBoundary,
  getAccountProfileCoreBoundary,
  getAccountProfileProjectionBoundary,
  toAccountProfileBoundary,
  toAccountProfileDocument,
  type AccountProfileBoundary,
  type AccountProfileBridgeFields,
  type AccountProfileCore,
  type AccountProfileDocument,
  type AccountProfileProjectionFields,
} from "@/lib/adapters/accountProfileAdapter";

export type UserProfileDoc = AccountProfileDocument;

const userDocRef = (uid: string) => doc(getFirebaseDb(), "users", uid);

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  return toAccountProfileDocument(snap.data() as Partial<UserProfileDoc>, "userProfile:get");
}

export async function getAccountProfileBoundary(uid: string): Promise<AccountProfileBoundary | null> {
  return toAccountProfileBoundary(await getUserProfile(uid), "userProfile:boundary");
}

export async function getAccountProfileCore(uid: string): Promise<AccountProfileCore | null> {
  return getAccountProfileCoreBoundary(await getUserProfile(uid), "userProfile:core");
}

export async function getAccountProfileBridge(uid: string): Promise<AccountProfileBridgeFields | null> {
  return getAccountProfileBridgeBoundary(await getUserProfile(uid), "userProfile:bridge");
}

export async function getAccountProfileProjection(
  uid: string
): Promise<AccountProfileProjectionFields | null> {
  return getAccountProfileProjectionBoundary(await getUserProfile(uid), "userProfile:projection");
}

/**
 * Call this right after signup/login to ensure /users/{uid} exists.
 */
export async function ensureUserProfile(uid: string, email: string): Promise<void> {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      email: email.trim().toLowerCase(),
      onboardingDone: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies UserProfileDoc);
  }
}

/**
 * Safe "finish onboarding" writer.
 * Works whether doc exists or not.
 */
export async function markOnboardingDone(
  uid: string,
  data: {
    fullName: string;
    dateOfBirth: string;
    sex: "male" | "female" | "other";
    currentWeightKg: number;
    goalType: "lean" | "recomp" | "buffed";
  }
): Promise<void> {
  const ref = userDocRef(uid);

  await setDoc(
    ref,
    {
      uid,
      onboardingDone: true,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      sex: data.sex,
      currentWeightKg: data.currentWeightKg,
      goalType: data.goalType,
      updatedAt: serverTimestamp(),
    } satisfies Partial<UserProfileDoc>,
    { merge: true }
  );

  await syncMyPublicIdentityClaim(uid, data.fullName);
}

/**
 * Generic profile updater (merge).
 * Use this for small edits like fullName without touching onboarding fields.
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfileDoc>
): Promise<void> {
  const ref = userDocRef(uid);

  await setDoc(
    ref,
    {
      uid,
      ...updates,
      updatedAt: serverTimestamp(),
    } satisfies Partial<UserProfileDoc>,
    { merge: true }
  );

  if (Object.prototype.hasOwnProperty.call(updates, "fullName")) {
    await syncMyPublicIdentityClaim(uid, updates.fullName ?? null);
  }
}

// Target-facing repo contract for AccountProfile semantics.
// Owns private account/onboarding/profile state on users/{uid}.
// Does not own public identity claims or derived streak projections long-term, even though
// some bridge/projection fields still live on the same physical doc in v1.
export const accountProfileRepo = {
  get: getUserProfile,
  getBoundary: getAccountProfileBoundary,
  getCore: getAccountProfileCore,
  getBridge: getAccountProfileBridge,
  getProjection: getAccountProfileProjection,
  ensureExists: ensureUserProfile,
  markOnboardingDone,
  update: updateUserProfile,
};
