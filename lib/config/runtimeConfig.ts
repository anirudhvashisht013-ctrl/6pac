import Constants from "expo-constants";
import type { FirebaseConfigSource, FirebaseRuntimeConfigInput } from "@/lib/config/firebaseConfig";

export type RuntimeConfig = {
  appEnv: string;
  firebaseSource: FirebaseConfigSource;
  firebase: FirebaseRuntimeConfigInput;
};

type RuntimeExtra = {
  appEnv?: unknown;
  firebase?: FirebaseRuntimeConfigInput;
};

function normalizeFirebaseInput(firebase: FirebaseRuntimeConfigInput | undefined): FirebaseRuntimeConfigInput {
  return {
    apiKey: typeof firebase?.apiKey === "string" ? firebase.apiKey : "",
    authDomain: typeof firebase?.authDomain === "string" ? firebase.authDomain : "",
    projectId: typeof firebase?.projectId === "string" ? firebase.projectId : "",
    storageBucket: typeof firebase?.storageBucket === "string" ? firebase.storageBucket : "",
    messagingSenderId:
      typeof firebase?.messagingSenderId === "string" ? firebase.messagingSenderId : "",
    appId: typeof firebase?.appId === "string" ? firebase.appId : "",
    measurementId: typeof firebase?.measurementId === "string" ? firebase.measurementId : undefined,
  };
}

function fromExtra(
  source: FirebaseConfigSource,
  extra: RuntimeExtra | undefined
): RuntimeConfig | null {
  if (!extra || typeof extra !== "object") {
    return null;
  }

  const appEnv = typeof extra.appEnv === "string" ? extra.appEnv : "unknown";
  const firebase = normalizeFirebaseInput(extra.firebase);

  return {
    appEnv,
    firebaseSource: source,
    firebase,
  };
}

export function loadRuntimeConfig(): RuntimeConfig {
  const manifest2Extra = (Constants as any).manifest2?.extra as RuntimeExtra | undefined;
  const manifestExtra = (Constants as any).manifest?.extra as RuntimeExtra | undefined;

  const candidates: Array<{ source: FirebaseConfigSource; extra: RuntimeExtra | undefined }> = [
    {
      source: "Constants.expoConfig.extra.firebase",
      extra: Constants.expoConfig?.extra as RuntimeExtra | undefined,
    },
    {
      source: "Constants.manifest2.extra.firebase",
      extra: manifest2Extra,
    },
    {
      source: "Constants.manifest.extra.firebase",
      extra: manifestExtra,
    },
  ];

  for (const candidate of candidates) {
    const resolved = fromExtra(candidate.source, candidate.extra);
    if (!resolved) continue;

    return resolved;
  }

  return {
    appEnv: "unknown",
    firebaseSource: "missing-runtime-extra.firebase",
    firebase: normalizeFirebaseInput(undefined),
  };
}
