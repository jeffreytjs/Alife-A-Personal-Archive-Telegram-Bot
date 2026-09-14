import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE = 'Asia/Singapore';

export function todayDateKey(timezone: string, now = DateTime.now()): string {
  return now.setZone(timezone).toFormat('yyyy-MM-dd');
}

export function parseDateKey(dateKey: string, timezone: string): DateTime {
  return DateTime.fromISO(dateKey, { zone: timezone }).startOf('day');
}

export function isoWeekKey(dateKey: string, timezone: string): string {
  const dt = parseDateKey(dateKey, timezone);
  const week = dt.weekNumber;
  const weekPadded = week.toString().padStart(2, '0');
  return `${dt.weekYear}-W${weekPadded}`;
}

export function monthKey(dateKey: string, timezone: string): string {
  return parseDateKey(dateKey, timezone).toFormat('yyyy-MM');
}

export function monthNameKey(dateKey: string, timezone: string): string {
  return parseDateKey(dateKey, timezone).toFormat('LLLL').toLowerCase();
}

export function compareDateKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDateInInclusiveRange(dateKey: string, from: string, until?: string): boolean {
  if (compareDateKeys(dateKey, from) < 0) {
    return false;
  }
  if (until && compareDateKeys(dateKey, until) > 0) {
    return false;
  }
  return true;
}
