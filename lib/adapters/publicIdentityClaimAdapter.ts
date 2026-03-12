const DEV_MODE = typeof __DEV__ !== "undefined" && __DEV__;

export type PublicIdentityClaimDocument = {
  uid?: string;
  refId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PublicIdentityClaimBoundary = {
  // Public discoverability ownership lives here, not on AccountProfile.
  claim: {
    uid?: string;
    friendRefId?: string;
  };
  metadata: {
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  raw: PublicIdentityClaimDocument;
};

function logPublicIdentityRecovery(
  message: string,
  raw: Partial<PublicIdentityClaimDocument>,
  context?: string
) {
  if (!DEV_MODE) return;
  const label = context ? ` [${context}]` : "";
  console.warn(`[public-identity]${label} ${message}`, {
    uid: raw.uid,
    refId: raw.refId,
  });
}

export function toPublicIdentityClaimDocument(
  raw: Partial<PublicIdentityClaimDocument> | null | undefined,
  context?: string
): PublicIdentityClaimDocument | null {
  if (!raw) return null;

  const recovered: string[] = [];
  if (raw.uid != null && typeof raw.uid !== "string") recovered.push("uid");
  if (raw.refId != null && typeof raw.refId !== "string") recovered.push("refId");

  if (recovered.length > 0) {
    logPublicIdentityRecovery(
      `recovered public identity claim fields: ${recovered.join(", ")}`,
      raw,
      context
    );
  }

  return {
    uid: typeof raw.uid === "string" ? raw.uid : undefined,
    refId: typeof raw.refId === "string" ? raw.refId : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function toPublicIdentityClaimBoundary(
  raw: Partial<PublicIdentityClaimDocument> | null | undefined,
  context?: string
): PublicIdentityClaimBoundary | null {
  const doc = toPublicIdentityClaimDocument(raw, context);
  if (!doc) return null;

  return {
    claim: {
      uid: doc.uid,
      friendRefId: doc.refId,
    },
    metadata: {
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    raw: doc,
  };
}
