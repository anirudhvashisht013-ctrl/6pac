import fs from "node:fs";
import path from "node:path";

const REQUIRED_KEYS = [
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
  "replace_me",
  "changeme",
  "your-api-key",
  "your-auth-domain",
  "your-project-id",
  "your-storage-bucket",
  "your-messaging-sender-id",
  "your-app-id",
]);

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function isPlaceholderLike(value) {
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

function parseArgs() {
  const envArg = process.argv.find((arg) => arg.startsWith("--env="));
  const value = envArg?.split("=")[1]?.trim().toLowerCase();

  if (value === "production" || value === "preview" || value === "development") {
    return value;
  }

  return "development";
}

function envFileFor(targetEnv) {
  if (targetEnv === "production" || targetEnv === "preview") {
    return ".env.production";
  }
  return ".env";
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const parsed = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function resolveFirebaseEnv(envVars) {
  return {
    apiKey: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_API_KEY),
    authDomain: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_APP_ID),
    measurementId: normalizeValue(envVars.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID),
  };
}

function summarize(config, source) {
  const maskApiKey =
    config.apiKey.length > 6
      ? `present (masked ***${config.apiKey.slice(-4)})`
      : config.apiKey
        ? "present (masked)"
        : "missing";

  return {
    source,
    projectId: config.projectId || "missing",
    apiKey: maskApiKey,
    authDomain: config.authDomain ? "present" : "missing",
    storageBucket: config.storageBucket ? "present" : "missing",
    messagingSenderId: config.messagingSenderId ? "present" : "missing",
    appId: config.appId ? "present" : "missing",
    measurementId: config.measurementId ? "present" : "not-set",
  };
}

function validate(config, source) {
  const issues = [];

  for (const key of REQUIRED_KEYS) {
    const value = normalizeValue(config[key]);
    if (!value || isPlaceholderLike(value)) {
      issues.push(`- ${key}: missing, empty, or placeholder value (source: ${source})`);
    }
  }

  if (issues.length === 0) {
    if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(config.apiKey)) {
      issues.push(`- apiKey: apiKey format looks invalid (source: ${source})`);
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(config.authDomain)) {
      issues.push(`- authDomain: authDomain must be a valid domain (source: ${source})`);
    }
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)) {
      issues.push(`- projectId: projectId format looks invalid (source: ${source})`);
    }
    if (!/^[a-z0-9._-]+\.[a-z0-9._-]+$/.test(config.storageBucket)) {
      issues.push(`- storageBucket: storageBucket format looks invalid (source: ${source})`);
    }
    if (!/^\d{6,20}$/.test(config.messagingSenderId)) {
      issues.push(`- messagingSenderId: messagingSenderId must be numeric (source: ${source})`);
    }
    if (!/^\d+:\d+:(web|android|ios):[A-Za-z0-9]+$/.test(config.appId)) {
      issues.push(`- appId: appId format looks invalid (source: ${source})`);
    }
  }

  if (config.measurementId) {
    if (isPlaceholderLike(config.measurementId)) {
      issues.push(`- measurementId: measurementId cannot be placeholder text (source: ${source})`);
    } else if (!/^G-[A-Z0-9]+$/i.test(config.measurementId)) {
      issues.push(`- measurementId: measurementId format looks invalid (source: ${source})`);
    }
  }

  return issues;
}

function main() {
  const targetEnv = parseArgs();
  const envFile = envFileFor(targetEnv);
  const envFilePath = path.join(process.cwd(), envFile);

  const fromFile = parseEnvFile(envFilePath);
  const merged = {
    ...fromFile,
    ...process.env,
  };

  const firebaseConfig = resolveFirebaseEnv(merged);
  const source = `script-env:${envFile}`;

  console.log(`[6PAC CONFIG] Validating Firebase config for env=${targetEnv}`);
  console.log("[6PAC CONFIG] Firebase config summary", summarize(firebaseConfig, source));

  const issues = validate(firebaseConfig, source);

  if (issues.length > 0) {
    console.error("[6PAC ERROR] Firebase configuration validation failed");
    for (const issue of issues) {
      console.error(issue);
    }
    console.error(`[6PAC ERROR] Required keys: ${REQUIRED_KEYS.join(", ")}`);
    process.exit(1);
  }

  console.log("[6PAC CONFIG] Firebase configuration validation passed");
}

main();
