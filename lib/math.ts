// lib/math.ts
export function n0(x: number | null | undefined): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

export function addNullable(a: number | null, b: number | null): number | null {
  // If both are null, keep null. If either has a number, sum with 0 fallback.
  const hasA = typeof a === "number" && Number.isFinite(a);
  const hasB = typeof b === "number" && Number.isFinite(b);
  if (!hasA && !hasB) return null;
  return n0(a) + n0(b);
}

export function clampMin0(x: number): number {
  return x < 0 ? 0 : x;
}