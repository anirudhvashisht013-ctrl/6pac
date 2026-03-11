export type FirebaseConfigSource =
  | "Constants.expoConfig.extra.firebase"
  | "Constants.manifest2.extra.firebase"
  | "Constants.manifest.extra.firebase"
  | "missing-runtime-extra.firebase"
  | "process.env"
  | `script-env:${string}`;

export type FirebaseConfigKey =
  | "apiKey"
  | "authDomain"
  | "projectId"
  | "storageBucket"
  | "messagingSenderId"
  | "appId"
  | "measurementId";

export type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export type FirebaseRuntimeConfigInput = Partial<Record<FirebaseConfigKey, string | null | undefined>>;

export type FirebaseConfigIssue = {
  key: FirebaseConfigKey;
  reason: string;
  source: FirebaseConfigSource;
};

export type FirebaseConfigValidationResult =
  | {
      ok: true;
      config: FirebaseRuntimeConfig;
      issues: [];
    }
  | {
      ok: false;
      issues: FirebaseConfigIssue[];
    };

const REQUIRED_KEYS: Array<Exclude<FirebaseConfigKey, "measurementId">> = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const BLOCKED_VALUES = new Set([
  "",
  "undefined",
  "null",
  "none",
  "n/a",
  "na",
  "dummy",
  "placeholder",
  "replace-me",
  "changeme",
  "your-api-key",
  "your-auth-domain",
  "your-project-id",
  "your-storage-bucket",
  "your-messaging-sender-id",
  "your-app-id",
]);

function normalizeValue(value: string | null | undefined): string {
  return (value || "").trim();
}

function isPlaceholderLike(value: string): boolean {
  const lowered = value.toLowerCase();
  if (BLOCKED_VALUES.has(lowered)) return true;

  return (
    lowered.includes("your_") ||
    lowered.includes("your-") ||
    lowered.includes("replace") ||
    lowered.includes("placeholder") ||
    lowered.includes("example") ||
    lowered.includes("dummy")
  );
}

function validateRequiredValue(
  rawConfig: FirebaseRuntimeConfigInput,
  key: Exclude<FirebaseConfigKey, "measurementId">,
  source: FirebaseConfigSource,
  issues: FirebaseConfigIssue[]
): string {
  const value = normalizeValue(rawConfig[key]);

  if (!value || isPlaceholderLike(value)) {
    issues.push({
      key,
      source,
      reason: "missing, empty, or placeholder value",
    });
  }

  return value;
}

function runStructuralChecks(config: FirebaseRuntimeConfig, source: FirebaseConfigSource, issues: FirebaseConfigIssue[]) {
  if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(config.apiKey)) {
    issues.push({
      key: "apiKey",
      source,
      reason: "apiKey format looks invalid",
    });
  }

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(config.authDomain)) {
    issues.push({
      key: "authDomain",
      source,
      reason: "authDomain must be a valid domain",
    });
  }

  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)) {
    issues.push({
      key: "projectId",
      source,
      reason: "projectId format looks invalid",
    });
  }

  if (!/^[a-z0-9._-]+\.[a-z0-9._-]+$/.test(config.storageBucket)) {
    issues.push({
      key: "storageBucket",
      source,
      reason: "storageBucket format looks invalid",
    });
  }

  if (!/^\d{6,20}$/.test(config.messagingSenderId)) {
    issues.push({
      key: "messagingSenderId",
      source,
      reason: "messagingSenderId must be numeric",
    });
  }

  if (!/^\d+:\d+:(web|android|ios):[A-Za-z0-9]+$/.test(config.appId)) {
    issues.push({
      key: "appId",
      source,
      reason: "appId format looks invalid",
    });
  }

  if (config.measurementId && !/^G-[A-Z0-9]+$/i.test(config.measurementId)) {
    issues.push({
      key: "measurementId",
      source,
      reason: "measurementId format looks invalid",
    });
  }
}

function maskSecret(raw: string): string {
  if (!raw) return "missing";
  if (raw.length <= 6) return "present (masked)";
  const tail = raw.slice(-4);
  return `present (masked ***${tail})`;
}

function describePresence(raw: string): string {
  return raw ? "present" : "missing";
}

export function buildFirebaseConfigSummary(rawConfig: FirebaseRuntimeConfigInput, source: FirebaseConfigSource) {
  const normalized = {
    apiKey: normalizeValue(rawConfig.apiKey),
    authDomain: normalizeValue(rawConfig.authDomain),
    projectId: normalizeValue(rawConfig.projectId),
    storageBucket: normalizeValue(rawConfig.storageBucket),
    messagingSenderId: normalizeValue(rawConfig.messagingSenderId),
    appId: normalizeValue(rawConfig.appId),
    measurementId: normalizeValue(rawConfig.measurementId),
  };

  return {
    source,
    projectId: normalized.projectId || "missing",
    apiKey: maskSecret(normalized.apiKey),
    authDomain: describePresence(normalized.authDomain),
    storageBucket: describePresence(normalized.storageBucket),
    messagingSenderId: describePresence(normalized.messagingSenderId),
    appId: describePresence(normalized.appId),
    measurementId: normalized.measurementId ? "present" : "not-set",
  };
}

export function validateFirebaseConfig(
  rawConfig: FirebaseRuntimeConfigInput,
  source: FirebaseConfigSource
): FirebaseConfigValidationResult {
  const issues: FirebaseConfigIssue[] = [];

  const config: FirebaseRuntimeConfig = {
    apiKey: validateRequiredValue(rawConfig, "apiKey", source, issues),
    authDomain: validateRequiredValue(rawConfig, "authDomain", source, issues),
    projectId: validateRequiredValue(rawConfig, "projectId", source, issues),
    storageBucket: validateRequiredValue(rawConfig, "storageBucket", source, issues),
    messagingSenderId: validateRequiredValue(rawConfig, "messagingSenderId", source, issues),
    appId: validateRequiredValue(rawConfig, "appId", source, issues),
  };

  const measurementId = normalizeValue(rawConfig.measurementId);
  if (measurementId) {
    config.measurementId = measurementId;
    if (isPlaceholderLike(measurementId)) {
      issues.push({
        key: "measurementId",
        source,
        reason: "measurementId cannot be placeholder text",
      });
    }
  }

  if (issues.length === 0) {
    runStructuralChecks(config, source, issues);
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    config,
    issues: [],
  };
}

export function formatFirebaseValidationIssues(issues: FirebaseConfigIssue[]): string {
  return issues
    .map((issue) => `- ${issue.key}: ${issue.reason} (source: ${issue.source})`)
    .join("\n");
}

export function requiredFirebaseKeys(): ReadonlyArray<string> {
  return REQUIRED_KEYS;
}
