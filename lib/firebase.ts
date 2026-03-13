import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import {
  disableNetwork,
  enableIndexedDbPersistence,
  enableNetwork,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getIsOnline, startNetworkListener, subscribeNetworkStatus } from "@/lib/network";
import {
  buildFirebaseConfigSummary,
  formatFirebaseValidationIssues,
  validateFirebaseConfig,
  type FirebaseConfigIssue,
  type FirebaseConfigSource,
  type FirebaseRuntimeConfig,
} from "@/lib/config/firebaseConfig";
import { loadRuntimeConfig } from "@/lib/config/runtimeConfig";
import { logConfig, logError, logFirebase } from "@/lib/bootstrap/logger";

type AuthDependencies = Parameters<typeof FirebaseAuth.initializeAuth>[1];

type FirebaseBootstrapStep =
  | "idle"
  | "runtime-config"
  | "config-validate"
  | "app-init"
  | "auth-init"
  | "firestore-init"
  | "storage-init"
  | "ready"
  | "failed";

type FirebaseBootstrapStatus = "idle" | "initializing" | "ready" | "failed";

export type FirebaseBootstrapDiagnostics = {
  status: FirebaseBootstrapStatus;
  step: FirebaseBootstrapStep;
  source: FirebaseConfigSource;
  summary: Record<string, unknown>;
  issues: FirebaseConfigIssue[];
  errorMessage: string | null;
};

export type FirebaseBootstrapResult =
  | {
      ok: true;
      diagnostics: FirebaseBootstrapDiagnostics;
    }
  | {
      ok: false;
      error: Error;
      diagnostics: FirebaseBootstrapDiagnostics;
    };

type FirebaseServices = {
  config: FirebaseRuntimeConfig;
  app: FirebaseApp;
  auth: FirebaseAuth.Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
};

class FirebaseBootstrapError extends Error {
  readonly step: FirebaseBootstrapStep;
  readonly source: FirebaseConfigSource;
  readonly issues: FirebaseConfigIssue[];

  constructor(message: string, options: {
    step: FirebaseBootstrapStep;
    source: FirebaseConfigSource;
    issues?: FirebaseConfigIssue[];
    cause?: unknown;
  }) {
    super(message);
    this.name = "FirebaseBootstrapError";
    this.step = options.step;
    this.source = options.source;
    this.issues = options.issues || [];

    if (options.cause && !(this as any).cause) {
      (this as any).cause = options.cause;
    }
  }
}

let bootstrapStatus: FirebaseBootstrapStatus = "idle";
let bootstrapStep: FirebaseBootstrapStep = "idle";
let bootstrapSource: FirebaseConfigSource = "missing-runtime-extra.firebase";
let bootstrapSummary: Record<string, unknown> = {};
let bootstrapIssues: FirebaseConfigIssue[] = [];
let bootstrapErrorMessage: string | null = null;

let bootstrapPromise: Promise<FirebaseBootstrapResult> | null = null;
let services: FirebaseServices | null = null;

function setBootstrapState(patch: Partial<FirebaseBootstrapDiagnostics>) {
  if (patch.status) bootstrapStatus = patch.status;
  if (patch.step) bootstrapStep = patch.step;
  if (patch.source) bootstrapSource = patch.source;
  if (patch.summary) bootstrapSummary = patch.summary;
  if (patch.issues) bootstrapIssues = patch.issues;
  if (Object.prototype.hasOwnProperty.call(patch, "errorMessage")) {
    bootstrapErrorMessage = patch.errorMessage ?? null;
  }
}

function createBootstrapError(
  step: FirebaseBootstrapStep,
  source: FirebaseConfigSource,
  message: string,
  options?: {
    cause?: unknown;
    issues?: FirebaseConfigIssue[];
  }
): FirebaseBootstrapError {
  return new FirebaseBootstrapError(message, {
    step,
    source,
    issues: options?.issues,
    cause: options?.cause,
  });
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

type AsyncStorageLike = Pick<typeof AsyncStorage, "setItem" | "getItem" | "removeItem">;

function hasAsyncStorageMethods(value: unknown): value is AsyncStorageLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AsyncStorageLike>;

  return (
    typeof candidate.setItem === "function" &&
    typeof candidate.getItem === "function" &&
    typeof candidate.removeItem === "function"
  );
}

function getFirebaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isAlreadyInitializedError(error: unknown): boolean {
  const code = getFirebaseErrorCode(error);
  return Boolean(code && code.includes("already-initialized"));
}

function resolveAuthDependencies(platform: typeof Platform.OS): AuthDependencies {
  if (platform === "web") {
    return {
      persistence: FirebaseAuth.browserLocalPersistence,
    } as AuthDependencies;
  }

  if (!hasAsyncStorageMethods(AsyncStorage)) {
    throw new Error(
      "React Native AsyncStorage module is unavailable. " +
        "Install and link @react-native-async-storage/async-storage for Firebase Auth persistence."
    );
  }

  const getReactNativePersistence = (FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: AsyncStorageLike) => FirebaseAuth.Persistence;
  }).getReactNativePersistence;

  if (typeof getReactNativePersistence !== "function") {
    throw new Error(
      "firebase/auth does not expose getReactNativePersistence in this runtime. " +
        "Ensure Expo Go resolves the React Native Firebase Auth entrypoint."
    );
  }

  return {
    persistence: getReactNativePersistence(AsyncStorage),
  } as AuthDependencies;
}

export function getFirebaseBootstrapDiagnostics(): FirebaseBootstrapDiagnostics {
  return {
    status: bootstrapStatus,
    step: bootstrapStep,
    source: bootstrapSource,
    summary: { ...bootstrapSummary },
    issues: [...bootstrapIssues],
    errorMessage: bootstrapErrorMessage,
  };
}

export function getFirebaseStartupDiagnostics(): FirebaseBootstrapDiagnostics {
  return getFirebaseBootstrapDiagnostics();
}

export async function initializeFirebase(): Promise<FirebaseBootstrapResult> {
  if (services) {
    return {
      ok: true,
      diagnostics: getFirebaseBootstrapDiagnostics(),
    };
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  setBootstrapState({
    status: "initializing",
    step: "runtime-config",
    issues: [],
    errorMessage: null,
  });

  bootstrapPromise = (async (): Promise<FirebaseBootstrapResult> => {
    try {
      logFirebase("Firebase initialization started");

      logConfig("Loading runtime configuration");
      const runtimeConfig = loadRuntimeConfig();
      setBootstrapState({
        step: "runtime-config",
        source: runtimeConfig.firebaseSource,
      });

      logConfig("Env/config source selected", {
        appEnv: runtimeConfig.appEnv,
        source: runtimeConfig.firebaseSource,
      });

      const summary = buildFirebaseConfigSummary(runtimeConfig.firebase, runtimeConfig.firebaseSource);
      setBootstrapState({ summary });
      logConfig("Firebase config summary", summary);

      setBootstrapState({ step: "config-validate" });
      logConfig("Validating Firebase configuration");
      const validation = validateFirebaseConfig(runtimeConfig.firebase, runtimeConfig.firebaseSource);

      if (!validation.ok) {
        const details = formatFirebaseValidationIssues(validation.issues);
        throw createBootstrapError(
          "config-validate",
          runtimeConfig.firebaseSource,
          `Firebase configuration invalid.\n${details}`,
          { issues: validation.issues }
        );
      }

      logConfig("Firebase config validated");

      setBootstrapState({ step: "app-init" });
      logFirebase("Initializing Firebase app");
      const app = getApps().length > 0 ? getApp() : initializeApp(validation.config);
      logFirebase("Firebase app initialized");

      setBootstrapState({ step: "auth-init" });
      logFirebase("Firebase Auth initialization started");
      let auth: FirebaseAuth.Auth;
      let authDeps: AuthDependencies;

      try {
        authDeps = resolveAuthDependencies(Platform.OS);
      } catch (error) {
        logError("Firebase Auth dependency resolution failed", error, {
          step: "auth-init",
          platform: Platform.OS,
        });
        throw createBootstrapError(
          "auth-init",
          runtimeConfig.firebaseSource,
          `Firebase Auth dependency resolution failed: ${describeUnknownError(error)}`,
          { cause: error }
        );
      }

      logFirebase("Firebase Auth dependencies resolved", {
        platform: Platform.OS,
        mode: Platform.OS === "web" ? "browserLocalPersistence" : "getReactNativePersistence(AsyncStorage)",
      });

      try {
        auth = FirebaseAuth.initializeAuth(app, authDeps);
      } catch (error) {
        const errorCode = getFirebaseErrorCode(error) || "unknown";
        logError("Firebase Auth initializeAuth failed", error, {
          step: "auth-init",
          platform: Platform.OS,
          code: errorCode,
        });

        if (!isAlreadyInitializedError(error)) {
          throw createBootstrapError(
            "auth-init",
            runtimeConfig.firebaseSource,
            `Firebase Auth initializeAuth failed (${errorCode}): ${describeUnknownError(error)}`,
            { cause: error }
          );
        }

        try {
          auth = FirebaseAuth.getAuth(app);
          logFirebase("Firebase Auth already initialized; reusing existing instance", {
            platform: Platform.OS,
            code: errorCode,
          });
        } catch (recoveryError) {
          logError("Firebase Auth getAuth recovery failed after already-initialized", recoveryError, {
            step: "auth-init",
            platform: Platform.OS,
            originalCode: errorCode,
          });
          throw createBootstrapError(
            "auth-init",
            runtimeConfig.firebaseSource,
            "Firebase Auth recovery failed after already-initialized error. " +
              `initializeAuth=${describeUnknownError(error)}; getAuth=${describeUnknownError(recoveryError)}`,
            { cause: recoveryError }
          );
        }
      }

      if (!auth) {
        throw createBootstrapError(
          "auth-init",
          runtimeConfig.firebaseSource,
          "Firebase Auth initialization failed: no auth instance returned"
        );
      }

      logFirebase("Firebase Auth initialized");

      setBootstrapState({ step: "firestore-init" });
      logFirebase("Firestore initialization started");
      const firestore = getFirestore(app);
      logFirebase("Firestore initialized");

      setBootstrapState({ step: "storage-init" });
      logFirebase("Storage initialization started");
      const storage = getStorage(app);
      logFirebase("Storage initialized");

      services = {
        config: validation.config,
        app,
        auth,
        firestore,
        storage,
      };

      setBootstrapState({
        status: "ready",
        step: "ready",
        issues: [],
        errorMessage: null,
      });

      return {
        ok: true,
        diagnostics: getFirebaseBootstrapDiagnostics(),
      };
    } catch (error) {
      const knownError =
        error instanceof FirebaseBootstrapError
          ? error
          : createBootstrapError(
              bootstrapStep === "idle" ? "failed" : bootstrapStep,
              bootstrapSource,
              `Firebase initialization failed at step ${bootstrapStep}: ${describeUnknownError(error)}`,
              { cause: error }
            );

      setBootstrapState({
        status: "failed",
        step: "failed",
        source: knownError.source,
        issues: knownError.issues,
        errorMessage: knownError.message,
      });

      logError("Firebase initialization failed", knownError, {
        step: knownError.step,
        source: knownError.source,
        issueCount: knownError.issues.length,
      });

      if (__DEV__) {
        throw knownError;
      }

      return {
        ok: false,
        error: knownError,
        diagnostics: getFirebaseBootstrapDiagnostics(),
      };
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

function requireFirebaseServices(caller: string): FirebaseServices {
  if (!services) {
    const diagnostics = getFirebaseBootstrapDiagnostics();

    throw new Error(
      `[6PAC FIREBASE] ${caller} called before Firebase was ready. ` +
        `status=${diagnostics.status}, step=${diagnostics.step}, source=${diagnostics.source}`
    );
  }

  return services;
}

export function getFirebaseApp(): FirebaseApp {
  return requireFirebaseServices("getFirebaseApp").app;
}

export function getFirebaseAuth(): FirebaseAuth.Auth {
  return requireFirebaseServices("getFirebaseAuth").auth;
}

export function getFirebaseDb(): Firestore {
  return requireFirebaseServices("getFirebaseDb").firestore;
}

export function getFirebaseStorage(): FirebaseStorage {
  return requireFirebaseServices("getFirebaseStorage").storage;
}

export function onAuthStateChanged(
  nextOrObserver: (...args: any[]) => void,
  error?: (...args: any[]) => void,
  completed?: (...args: any[]) => void
) {
  logFirebase("Auth state listener attached");
  return FirebaseAuth.onAuthStateChanged(getFirebaseAuth(), nextOrObserver as any, error as any, completed as any);
}

export function signInWithEmailAndPassword(email: string, password: string) {
  return FirebaseAuth.signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function createUserWithEmailAndPassword(email: string, password: string) {
  return FirebaseAuth.createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signInWithGoogleIdToken(idToken: string) {
  const credential = FirebaseAuth.GoogleAuthProvider.credential(idToken);
  return FirebaseAuth.signInWithCredential(getFirebaseAuth(), credential);
}

export function signOut() {
  return FirebaseAuth.signOut(getFirebaseAuth());
}

export type FirebaseUser = FirebaseAuth.User;

let firestoreOfflineUnsub: (() => void) | null = null;
let firestoreNetworkUpdate: Promise<void> = Promise.resolve();

async function applyFirestoreNetworkState(firestore: Firestore) {
  const isOnline = getIsOnline();

  try {
    if (isOnline) {
      logFirebase("Enabling Firestore network");
      await enableNetwork(firestore);
    } else {
      logFirebase("Disabling Firestore network");
      await disableNetwork(firestore);
    }
  } catch (error) {
    logError("Firestore network state update failed", error);
  }
}

export async function initializeFirestoreOffline(): Promise<() => void> {
  if (firestoreOfflineUnsub) {
    return firestoreOfflineUnsub;
  }

  const firestore = getFirebaseDb();

  startNetworkListener();

  if (Platform.OS === "web") {
    try {
      await enableIndexedDbPersistence(firestore);
      logFirebase("Firestore IndexedDB persistence enabled (web)");
    } catch (error: any) {
      if (error?.code === "failed-precondition") {
        logError("Firestore persistence unavailable: multiple tabs open", error);
      } else if (error?.code === "unimplemented") {
        logError("Firestore persistence unavailable: IndexedDB not supported", error);
      } else {
        logError("Firestore persistence setup failed", error);
      }
    }
  }

  await applyFirestoreNetworkState(firestore);

  const unsubscribe = subscribeNetworkStatus(() => {
    firestoreNetworkUpdate = firestoreNetworkUpdate
      .catch(() => undefined)
      .then(() => applyFirestoreNetworkState(firestore));
  });

  firestoreOfflineUnsub = () => {
    unsubscribe();
    firestoreOfflineUnsub = null;
  };

  return firestoreOfflineUnsub;
}
