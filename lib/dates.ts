import type { ISODate } from "@/lib/models";

type DateLike = Date | ISODate;

function toDate(input: DateLike): Date {
  if (input instanceof Date) return new Date(input);
  // ISODate -> local midnight
  return new Date(`${input}T00:00:00`);
}

/**
 * Format a Date -> ISODate ("YYYY-MM-DD")
 */
export function toYMD(d: Date): ISODate {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as ISODate;
}

/**
 * Today as ISODate ("YYYY-MM-DD")
 */
export function todayYMD(): ISODate {
  return toYMD(new Date());
}

/**
 * Add days to a Date -> Date
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns Monday (ISODate) for the week that contains `base`.
 * Sunday (0) -> go back 6 days
 * Otherwise -> go back (day - 1)
 */
export function getMondayYMD(base: DateLike = new Date()): ISODate {
  const d = toDate(base);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  return toYMD(d);
}

/**
 * Pretty date for UI (e.g., "Mon, Mar 2")
 * Accepts ISODate or Date
 */
export function formatDateLong(input: DateLike): string {
  const d = toDate(input);
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d.toDateString();
  }
}

/**
 * Compact UI date for screens that should not expose raw ISO keys.
 * Example: "Mar-12-26"
 */
export function formatDateCompact(input: DateLike): string {
  const d = toDate(input);
  try {
    const month = d.toLocaleDateString(undefined, { month: "short" });
    const day = String(d.getDate()).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  } catch {
    return toYMD(d);
  }
}

/**
 * Returns an array of 7 ISO dates for the week (Mon -> Sun)
 * If you pass a date OR an ISODate, it uses that date’s week; otherwise current week.
 */
export function getWeekDates(base: DateLike = new Date()): ISODate[] {
  const mondayYMD = getMondayYMD(base);
  const monday = new Date(`${mondayYMD}T00:00:00`);

  const days: ISODate[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(toYMD(addDays(monday, i)));
  }
  return days;
}
