import type { WatchlistEntry } from './types';

export type ReviewBucket = 'overdue' | 'today' | 'soon' | 'later' | 'undated' | 'archived';
export function localReviewDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}
export function reviewState(entry: WatchlistEntry, today: string): { bucket: ReviewBucket; days: number | null } {
  if (entry.status === 'archived') return { bucket: 'archived', days: null };
  if (!entry.reviewDate) return { bucket: 'undated', days: null };
  // I compare calendar dates rather than elapsed hours, so daylight-saving changes don't move the due day.
  const days = dayNumber(entry.reviewDate) - dayNumber(today);
  return { bucket: days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'soon' : 'later', days };
}
export function reviewQueue(entries: WatchlistEntry[], today: string) {
  const tier: Record<ReviewBucket, number> = { overdue: 0, today: 1, soon: 2, later: 3, undated: 4, archived: 5 };
  return [...entries].sort((a, b) => tier[reviewState(a, today).bucket] - tier[reviewState(b, today).bucket]
    || (a.reviewDate || '9999').localeCompare(b.reviewDate || '9999') || a.ticker.localeCompare(b.ticker));
}
