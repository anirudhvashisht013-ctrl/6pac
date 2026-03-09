const FRIEND_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FRIEND_ID_SEGMENT_LENGTH = 3;

export const FRIEND_ID_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;

function randomChar(): string {
  const idx = Math.floor(Math.random() * FRIEND_ID_CHARS.length);
  return FRIEND_ID_CHARS[idx] || "A";
}

export function generateFriendRefId(): string {
  const a = Array.from({ length: FRIEND_ID_SEGMENT_LENGTH }, randomChar).join("");
  const b = Array.from({ length: FRIEND_ID_SEGMENT_LENGTH }, randomChar).join("");
  return `${a}-${b}`;
}

export function normalizeFriendRefId(raw: string): string {
  const upper = (raw || "").toUpperCase().trim();
  const compact = upper.replace(/[^A-Z0-9]/g, "");

  if (compact.length <= FRIEND_ID_SEGMENT_LENGTH) {
    return compact;
  }

  const left = compact.slice(0, FRIEND_ID_SEGMENT_LENGTH);
  const right = compact.slice(FRIEND_ID_SEGMENT_LENGTH, FRIEND_ID_SEGMENT_LENGTH * 2);
  return right.length > 0 ? `${left}-${right}` : left;
}

export function isValidFriendRefId(value: string): boolean {
  return FRIEND_ID_PATTERN.test((value || "").trim().toUpperCase());
}
