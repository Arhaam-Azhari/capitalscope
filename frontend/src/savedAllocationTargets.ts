import { rebalancePlan } from './portfolioRebalance';
import type { PortfolioMarks } from './types';

export type SavedAllocationTarget = { id: string; portfolioId: string; name: string; createdAt: string;
  dataMode: string; modelVersion: string; targets: Record<string, number> };

export function savedAllocationInputs(marks: PortfolioMarks, saved: SavedAllocationTarget) {
  if (saved.portfolioId !== marks.portfolioId || saved.dataMode !== marks.dataMode || saved.modelVersion !== 'allocation-targets-v1')
    throw new Error('These targets belong to a different portfolio, data mode, or model version.');
  const assets = ['Cash', ...marks.holdings.map(holding => holding.ticker)];
  if (!saved.targets || Object.keys(saved.targets).length !== assets.length || assets.some(asset => !Object.hasOwn(saved.targets, asset)))
    throw new Error('The holdings have changed. These saved targets cannot be loaded into this plan.');
  const targets = assets.map(asset => {
    const value = saved.targets[asset];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('These saved targets contain an invalid percentage.');
    return String(value);
  });
  // I revalidate saved percentages and current coverage before filling any inputs.
  rebalancePlan(marks, targets);
  return targets;
}
