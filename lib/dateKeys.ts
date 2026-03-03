// lib/dateKeys.ts
import type { ISODate } from "@/lib/models";

export function toISODate(d: Date): ISODate {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as ISODate;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}
