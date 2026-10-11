import type { priceIntervals } from './priceIntervals';

export type IntervalDirection = 'all' | 'current-higher' | 'reference-higher';
export type IntervalOrder = 'oldest' | 'largest-gap';

export function reviewPriceIntervals(rows: ReturnType<typeof priceIntervals>['rows'], minimumGap: string, direction: IntervalDirection, order: IntervalOrder) {
  const entered = minimumGap.trim() || '0';
  const threshold = Number(entered);
  if (!/^\d+(\.\d{1,2})?$/.test(entered) || !Number.isFinite(threshold)) throw new Error('Enter a nonnegative minimum gap with up to two decimal places.');
  if (!['all', 'current-higher', 'reference-higher'].includes(direction) || !['oldest', 'largest-gap'].includes(order)) throw new Error('Choose a supported interval review option.');
  return rows.filter(row => {
    const displayedGap = Number(row.gapPoints.toFixed(2));
    return Math.abs(displayedGap) >= threshold && (direction === 'all' || (direction === 'current-higher' ? displayedGap > 0 : displayedGap < 0));
  }).sort((a, b) => (order === 'largest-gap' ? Math.abs(b.gapPoints) - Math.abs(a.gapPoints) : 0) || a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
}
