export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayYMD(): string {
  return toYMD(new Date());
}

export function getMondayOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMondayYMD(date?: Date): string {
  return toYMD(getMondayOfWeek(date));
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

export function getWeekDates(weekStartYMD: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartYMD, i));
}

export function formatDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLong(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function dayLabel(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function isToday(ymd: string): boolean {
  return ymd === todayYMD();
}

export function isFuture(ymd: string): boolean {
  return ymd > todayYMD();
}

export function isPast(ymd: string): boolean {
  return ymd < todayYMD();
}

export function getWeekNumber(weekStartYMD: string): number {
  const d = new Date(weekStartYMD + 'T00:00:00');
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
}

export function monthLabel(weekStartYMD: string): string {
  const d = new Date(weekStartYMD + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function isSameWeek(date: string, weekStart: string): boolean {
  return date >= weekStart && date <= addDays(weekStart, 6);
}
