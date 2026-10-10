import type { PortfolioMarks } from './types';

export function rebalanceAvailable(marks: PortfolioMarks) {
  const total = marks.totalValue;
  const values = [marks.cash, ...marks.holdings.map(holding => holding.value)];
  return marks.complete && total !== null && Number.isFinite(total) && total > 0
    && values.every(value => value !== null && Number.isFinite(value) && value >= 0)
    && marks.holdings.length === marks.totalPositions
    && Math.abs(values.reduce<number>((sum, value) => sum + (value || 0), 0) - total) <= Math.max(0.000001, total * 1e-10);
}

export function rebalancePlan(marks: PortfolioMarks, targets: string[]) {
  if (!rebalanceAvailable(marks)) throw new Error('A complete, positive portfolio valuation is required.');
  const assets = [{ ticker: 'Cash', value: marks.cash }, ...marks.holdings.map(holding => ({ ticker: holding.ticker, value: holding.value! }))];
  if (targets.length !== assets.length || targets.some(value => !/^\d{1,3}(\.\d{1,2})?$/.test(value.trim())))
    throw new Error('Enter every target from 0 to 100, using up to two decimal places.');
  // I sum targets as integer basis points so 100% does not depend on floating-point rounding.
  const points = targets.map(value => Math.round(Number(value.trim()) * 100));
  if (points.some(value => value > 10000) || points.reduce((sum, value) => sum + value, 0) !== 10000)
    throw new Error('Targets must total exactly 100%, with each target between 0 and 100%.');
  const total = marks.totalValue!;
  return assets.map((asset, i) => {
    const targetWeight = points[i] / 10000, targetValue = total * targetWeight;
    return { ...asset, currentWeight: asset.value / total, targetWeight, targetValue, change: targetValue - asset.value };
  });
}

export function currentAllocationTargets(marks: PortfolioMarks) {
  if (!rebalanceAvailable(marks)) throw new Error('A complete, positive portfolio valuation is required.');
  const values = [marks.cash, ...marks.holdings.map(holding => holding.value!)];
  const sum = values.reduce((total, value) => total + value, 0);
  const quotas = values.map(value => value / sum * 10000);
  const points = quotas.map(Math.floor);
  const remaining = 10000 - points.reduce((total, value) => total + value, 0);
  if (remaining < 0 || remaining > points.length) throw new Error('Current weights could not be rounded to 100%.');
  // I distribute leftover basis points by largest remainder, then cash/holding order for ties.
  const order = quotas.map((quota, index) => ({ index, remainder: quota - points[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remaining; i++) points[order[i].index]++;
  return points.map(value => (value / 100).toFixed(2));
}

export function allocationShareEstimate(holding: PortfolioMarks['holdings'][number] | undefined, targetValue: number, basisChecked: boolean) {
  const unavailable = (reason: string | null) => ({ targetShares: null, shareChange: null, reason });
  if (!holding) return unavailable(null);
  if (!basisChecked) return unavailable('Share basis not checked');
  const { quantity, close, value } = holding;
  if (close === null || !Number.isFinite(close) || close <= 0 || !Number.isFinite(quantity) || quantity <= 0)
    return unavailable('Recorded shares or stored close unavailable');
  const impliedValue = quantity * close;
  // I check arithmetic consistency here; the manual acknowledgment does not verify split history.
  if (value === null || !Number.isFinite(value) || !Number.isFinite(impliedValue)
    || Math.abs(value - impliedValue) > Math.max(0.000001, Math.abs(value) * 1e-10))
    return unavailable('Recorded shares and stored value do not match');
  const targetShares = targetValue / close, shareChange = targetShares - quantity;
  if (!Number.isFinite(targetShares) || targetShares < 0 || !Number.isFinite(shareChange))
    return unavailable('Fractional estimate unavailable');
  return { targetShares, shareChange, reason: null };
}
