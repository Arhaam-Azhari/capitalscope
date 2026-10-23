import type { StressResult } from './PortfolioStressResult';

export type StressHoldingOrder = 'original' | 'lowest' | 'absolute';
export function reviewStressHoldings(rows: StressResult['holdings'], order: StressHoldingOrder, unavailableOnly: boolean) {
  const available = (row: StressResult['holdings'][number]) => row.change !== null && Number.isFinite(row.change);
  // I copy the rows so reviewing them never changes the result used by totals, saving, or export.
  const shown = rows.filter(row => !unavailableOnly || !available(row));
  if (order === 'original') return shown;
  return shown.sort((left, right) => {
    if (!available(left) || !available(right)) return available(left) ? -1 : available(right) ? 1 : left.baseline.ticker.localeCompare(right.baseline.ticker);
    const difference = order === 'lowest' ? left.change! - right.change! : Math.abs(right.change!) - Math.abs(left.change!);
    return difference || left.baseline.ticker.localeCompare(right.baseline.ticker);
  });
}
