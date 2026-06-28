// Lightweight client-side email validation.
// Rejects obviously malformed addresses before hitting Firebase Auth so users get
// an immediate inline message instead of a round-trip error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
