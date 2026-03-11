export type BootLogScope = "BOOT" | "CONFIG" | "FIREBASE" | "ERROR" | "FATAL";

type LogPayload = Record<string, unknown> | undefined;

function prefix(scope: BootLogScope): string {
  return `[6PAC ${scope}]`;
}

function messageWithScope(scope: BootLogScope, message: string): string {
  return `${prefix(scope)} ${message}`;
}

function logInfo(scope: BootLogScope, message: string, payload?: LogPayload) {
  const line = messageWithScope(scope, message);
  if (payload) {
    console.log(line, payload);
    return;
  }
  console.log(line);
}

function logWarn(scope: BootLogScope, message: string, payload?: LogPayload) {
  const line = messageWithScope(scope, message);
  if (payload) {
    console.warn(line, payload);
    return;
  }
  console.warn(line);
}

function toErrorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const enriched = error as Error & {
      code?: unknown;
      customData?: unknown;
      cause?: unknown;
    };

    const payload: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack || "",
    };

    if (typeof enriched.code === "string") {
      payload.code = enriched.code;
    }

    if (typeof enriched.customData !== "undefined") {
      payload.customData = enriched.customData;
    }

    if (enriched.cause) {
      payload.cause =
        enriched.cause instanceof Error
          ? {
              name: enriched.cause.name,
              message: enriched.cause.message,
              stack: enriched.cause.stack || "",
            }
          : String(enriched.cause);
    }

    return payload;
  }

  if (error && typeof error === "object") {
    const asRecord = error as Record<string, unknown>;
    return {
      ...asRecord,
      message: typeof asRecord.message === "string" ? asRecord.message : String(error),
    };
  }

  return {
    message: String(error),
  };
}

export function logBoot(message: string, payload?: LogPayload) {
  logInfo("BOOT", message, payload);
}

export function logConfig(message: string, payload?: LogPayload) {
  logInfo("CONFIG", message, payload);
}

export function logFirebase(message: string, payload?: LogPayload) {
  logInfo("FIREBASE", message, payload);
}

export function logError(message: string, error?: unknown, payload?: LogPayload) {
  if (!error) {
    logWarn("ERROR", message, payload);
    return;
  }

  const mergedPayload = {
    ...(payload || {}),
    ...toErrorPayload(error),
  };

  logWarn("ERROR", message, mergedPayload);
}

export function logFatal(message: string, error?: unknown, payload?: LogPayload) {
  if (!error) {
    logWarn("FATAL", message, payload);
    return;
  }

  const mergedPayload = {
    ...(payload || {}),
    ...toErrorPayload(error),
  };

  logWarn("FATAL", message, mergedPayload);
}
