const DEV_MODE = typeof __DEV__ !== "undefined" && __DEV__;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeFirestoreValue(value: unknown): unknown {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const next: unknown[] = [];
    for (const item of value) {
      const sanitized = sanitizeFirestoreValue(item);
      if (typeof sanitized !== "undefined") {
        next.push(sanitized);
      }
    }
    return next;
  }

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const sanitized = sanitizeFirestoreValue(nested);
      if (typeof sanitized !== "undefined") {
        next[key] = sanitized;
      }
    }
    return next;
  }

  return value;
}

export function sanitizeFirestorePayload<T>(payload: T): T {
  return sanitizeFirestoreValue(payload) as T;
}

function shapeToken(value: unknown, depth: number): string {
  if (typeof value === "undefined") return "undefined";
  if (value === null) return "null";
  if (depth >= 2) {
    if (Array.isArray(value)) return `array(${value.length})`;
    if (isPlainObject(value)) return "object";
  }

  if (Array.isArray(value)) {
    const firstDefined = value.find((item) => typeof item !== "undefined");
    return `[${value.length}${typeof firstDefined !== "undefined" ? `:${shapeToken(firstDefined, depth + 1)}` : ""}]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).slice(0, 8);
    return `{${entries.map(([key, nested]) => `${key}:${shapeToken(nested, depth + 1)}`).join(",")}}`;
  }

  return typeof value;
}

export function summarizeFirestorePayloadShape(payload: unknown): string {
  try {
    return shapeToken(payload, 0);
  } catch {
    return DEV_MODE ? "unavailable" : "payload";
  }
}
