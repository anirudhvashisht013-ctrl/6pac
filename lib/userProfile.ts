import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export type UserProfileDoc = {
  uid: string;
  email: string;
  onboardingDone: boolean;
  fullName?: string;
  dateOfBirth?: string;
  sex?: "male" | "female" | "other";
  currentWeightKg?: number;
  goalType?: "lean" | "recomp" | "buffed";
  createdAt?: any;
  updatedAt?: any;

  // streak tracking
  currentStreakDays?: number;
  maxStreakDays?: number;
};

const userDocRef = (uid: string) => doc(db, "users", uid);

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? (snap.data() as UserProfileDoc) : null;
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
}