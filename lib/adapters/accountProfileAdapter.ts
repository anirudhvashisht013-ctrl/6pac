const DEV_MODE = typeof __DEV__ !== "undefined" && __DEV__;

export type AccountProfileCore = {
  uid?: string;
  email?: string;
  onboardingDone: boolean;
  fullName?: string;
  dateOfBirth?: string;
  sex?: "male" | "female" | "other";
  currentWeightKg?: number;
  heightCm?: number;
  goalType?: "lean" | "recomp" | "buffed";
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type AccountProfileBridgeFields = {
  // Temporary bridge field duplicated on users/{uid} for bootstrap convenience.
  // Public discoverability ownership belongs to PublicIdentityClaim.
  friendRefId?: string;
};

export type AccountProfileProjectionFields = {
  // Derived profile projections; not core account ownership.
  currentStreakDays?: number;
  maxStreakDays?: number;
};

export type AccountProfileDocument = AccountProfileCore &
  AccountProfileBridgeFields &
  AccountProfileProjectionFields;

export type AccountProfileBoundary = {
  // Private account/onboarding semantics.
  core: AccountProfileCore;
  // Tolerated bridge fields that may overlap another logical boundary.
  bridge: AccountProfileBridgeFields;
  // Derived projections tolerated on the root profile doc for now.
  projection: AccountProfileProjectionFields;
  raw: AccountProfileDocument;
};

function logAccountProfileRecovery(message: string, raw: Partial<AccountProfileDocument>, context?: string) {
  if (!DEV_MODE) return;
  const label = context ? ` [${context}]` : "";
  console.warn(`[account-profile]${label} ${message}`, {
    uid: raw.uid,
    email: raw.email,
  });
}

export function toAccountProfileDocument(
  raw: Partial<AccountProfileDocument> | null | undefined,
  context?: string
): AccountProfileDocument | null {
  if (!raw) {
    return null;
  }

  const recovered: string[] = [];
  if (raw.onboardingDone !== true && raw.onboardingDone !== false) recovered.push("onboardingDone");
  if (raw.friendRefId != null && typeof raw.friendRefId !== "string") recovered.push("friendRefId");
  if (raw.currentStreakDays != null && typeof raw.currentStreakDays !== "number") {
    recovered.push("currentStreakDays");
  }
  if (raw.maxStreakDays != null && typeof raw.maxStreakDays !== "number") {
    recovered.push("maxStreakDays");
  }

  if (recovered.length > 0) {
    logAccountProfileRecovery(`recovered profile boundary fields: ${recovered.join(", ")}`, raw, context);
  }

  return {
    uid: typeof raw.uid === "string" ? raw.uid : undefined,
    email: typeof raw.email === "string" ? raw.email : undefined,
    onboardingDone: raw.onboardingDone === true,
    fullName: typeof raw.fullName === "string" ? raw.fullName : undefined,
    dateOfBirth: typeof raw.dateOfBirth === "string" ? raw.dateOfBirth : undefined,
    sex:
      raw.sex === "male" || raw.sex === "female" || raw.sex === "other"
        ? raw.sex
        : undefined,
    currentWeightKg:
      typeof raw.currentWeightKg === "number" ? raw.currentWeightKg : undefined,
    heightCm: typeof raw.heightCm === "number" ? raw.heightCm : undefined,
    goalType:
      raw.goalType === "lean" || raw.goalType === "recomp" || raw.goalType === "buffed"
        ? raw.goalType
        : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    friendRefId: typeof raw.friendRefId === "string" ? raw.friendRefId : undefined,
    currentStreakDays:
      typeof raw.currentStreakDays === "number" ? raw.currentStreakDays : undefined,
    maxStreakDays: typeof raw.maxStreakDays === "number" ? raw.maxStreakDays : undefined,
  };
}

export function toAccountProfileBoundary(
  raw: Partial<AccountProfileDocument> | null | undefined,
  context?: string
): AccountProfileBoundary | null {
  const doc = toAccountProfileDocument(raw, context);
  if (!doc) return null;

  return {
    core: {
      uid: doc.uid,
      email: doc.email,
      onboardingDone: doc.onboardingDone,
      fullName: doc.fullName,
      dateOfBirth: doc.dateOfBirth,
      sex: doc.sex,
      currentWeightKg: doc.currentWeightKg,
      heightCm: doc.heightCm,
      goalType: doc.goalType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    bridge: {
      friendRefId: doc.friendRefId,
    },
    projection: {
      currentStreakDays: doc.currentStreakDays,
      maxStreakDays: doc.maxStreakDays,
    },
    raw: doc,
  };
}

export function getAccountProfileCoreBoundary(
  raw: Partial<AccountProfileDocument> | null | undefined,
  context?: string
): AccountProfileCore | null {
  return toAccountProfileBoundary(raw, context)?.core || null;
}

export function getAccountProfileBridgeBoundary(
  raw: Partial<AccountProfileDocument> | null | undefined,
  context?: string
): AccountProfileBridgeFields | null {
  return toAccountProfileBoundary(raw, context)?.bridge || null;
}

export function getAccountProfileProjectionBoundary(
  raw: Partial<AccountProfileDocument> | null | undefined,
  context?: string
): AccountProfileProjectionFields | null {
  return toAccountProfileBoundary(raw, context)?.projection || null;
}
