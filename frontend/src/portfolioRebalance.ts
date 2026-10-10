import type { Company, PortfolioMarks } from './types';

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

export function allocationPlanSummary(marks: PortfolioMarks, targets: string[]) {
  const [cash, ...holdings] = rebalancePlan(marks, targets);
  const holdingIncreases = holdings.reduce((sum, row) => sum + Math.max(0, row.change), 0);
  const holdingReductions = holdings.reduce((sum, row) => sum + Math.max(0, -row.change), 0);
  // I count both sides of holding changes and exclude cash from this movement measure.
  const grossHoldingChangePercent = (holdingIncreases / marks.totalValue! + holdingReductions / marks.totalValue!) * 100;
  return { holdingIncreases, holdingReductions, grossHoldingChangePercent,
    targetCash: cash.targetValue, cashChange: cash.change,
    balanceResidual: holdingReductions - holdingIncreases - cash.change };
}

export function allocationSectorPlan(marks: PortfolioMarks, targets: string[], companies: Company[]) {
  const plan = rebalancePlan(marks, targets);
  const groups = new Map<string, { kind: 'cash' | 'sector'; label: string; currentValue: number; targetValue: number; currentWeightPercent: number; targetWeightPercent: number; tickers: string[] }>();
  // I retain unknown holdings in an explicit bucket so the full portfolio remains in the denominator.
  for (const [i, row] of plan.entries()) {
    const kind = i === 0 ? 'cash' : 'sector';
    const label = i === 0 ? 'Cash reserve' : marks.dataMode === 'example' && row.ticker === 'DEMO' ? 'Fictional Industrials'
      : marks.dataMode === 'market' ? companies.find(company => company.ticker === row.ticker)?.sector.trim() || 'Unclassified' : 'Unclassified';
    const key = `${kind}:${label}`;
    const group = groups.get(key) || { kind, label, currentValue: 0, targetValue: 0, currentWeightPercent: 0, targetWeightPercent: 0, tickers: [] };
    group.currentValue += row.value; group.targetValue += row.targetValue;
    group.currentWeightPercent += row.currentWeight * 100; group.targetWeightPercent += Number(targets[i].trim());
    if (i !== 0) group.tickers.push(row.ticker);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === 'cash' ? -1 : 1)
    .map(group => ({ ...group, weightChangePoints: group.targetWeightPercent - group.currentWeightPercent }));
}

export function allocationConcentration(marks: PortfolioMarks, targets: string[], companies: Company[]) {
  const holdings = rebalancePlan(marks, targets).slice(1);
  const sectors = allocationSectorPlan(marks, targets, companies).filter(group => group.kind === 'sector');
  type Ranked = { label: string; weight: number };
  // I rank each side independently, exclude zero weights, and break ties alphabetically.
  const rank = (rows: Ranked[]) => rows.filter(row => row.weight > 0).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
  const currentHoldings = rank(holdings.map(row => ({ label: row.ticker, weight: row.currentWeight * 100 })));
  const targetHoldings = rank(holdings.map(row => ({ label: row.ticker, weight: row.targetWeight * 100 })));
  const currentSectors = rank(sectors.map(row => ({ label: row.label, weight: row.currentWeightPercent })));
  const targetSectors = rank(sectors.map(row => ({ label: row.label, weight: row.targetWeightPercent })));
  const summary = (metric: string, current: Ranked[], target: Ranked[]) => {
    const currentWeightPercent = current.reduce((sum, row) => sum + row.weight, 0);
    const targetWeightPercent = target.reduce((sum, row) => sum + row.weight, 0);
    return { metric, currentMembers: current.map(row => row.label), targetMembers: target.map(row => row.label),
      currentWeightPercent, targetWeightPercent, weightChangePoints: targetWeightPercent - currentWeightPercent };
  };
  return [summary('Largest holding', currentHoldings.slice(0, 1), targetHoldings.slice(0, 1)),
    summary('Largest sector bucket', currentSectors.slice(0, 1), targetSectors.slice(0, 1)),
    summary('Top three holdings', currentHoldings.slice(0, 3), targetHoldings.slice(0, 3))];
}
