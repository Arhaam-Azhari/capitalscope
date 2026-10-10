import { allocationConcentration, allocationPlanSummary, allocationSectorPlan } from './portfolioRebalance';
import { savedAllocationInputs, type SavedAllocationTarget } from './savedAllocationTargets';
import { csvCell } from './csvCell';
import type { Company, PortfolioMarks } from './types';

export function compareSavedAllocations(marks: PortfolioMarks, companies: Company[], selected: SavedAllocationTarget[]) {
  if (selected.length < 2 || selected.length > 4 || new Set(selected.map(item => item.id)).size !== selected.length)
    throw new Error('Choose two to four distinct saved allocation mixes.');
  // I recalculate each saved percentage mix against the same current marks, rather than comparing old dollar results.
  return selected.map(preset => {
    const targets = savedAllocationInputs(marks, preset);
    return { preset, targets, movement: allocationPlanSummary(marks, targets), concentration: allocationConcentration(marks, targets, companies) };
  });
}

export function savedAllocationComparisonCsv(marks: PortfolioMarks, companies: Company[], selected: SavedAllocationTarget[], exportedAt: string) {
  const cases = compareSavedAllocations(marks, companies, selected);
  const sectorEvidence = allocationSectorPlan(marks, cases[0].targets, companies).filter(group => group.kind === 'sector')
    .map(group => ({ label: group.label, tickers: group.tickers, currentValue: group.currentValue, currentWeightPercent: group.currentWeightPercent }));
  const headers = ['portfolio_id', 'comparison_model_version', 'data_mode', 'currency', 'saved_target_id', 'saved_target_name', 'saved_target_created_at',
    'saved_target_model_version', 'target_percentages_json', 'baseline_total_usd', 'baseline_cash_usd', 'baseline_holdings_json', 'baseline_sector_buckets_json', 'baseline_evaluated_at', 'exported_at',
    'target_cash_usd', 'target_cash_percent', 'holding_increases_usd', 'holding_reductions_usd', 'gross_holding_change_percent',
    'largest_target_holding', 'largest_target_holding_percent', 'target_top_three_holdings', 'target_top_three_percent', 'largest_target_sector_bucket', 'largest_target_sector_percent', 'scope'];
  const rows = cases.map(({ preset, movement, concentration }) => [marks.portfolioId, 'saved-allocation-comparison-v1', marks.dataMode, 'USD', preset.id, preset.name, preset.createdAt,
    preset.modelVersion, JSON.stringify(preset.targets), marks.totalValue, marks.cash, JSON.stringify(marks.holdings), JSON.stringify(sectorEvidence), marks.evaluatedAt, exportedAt,
    movement.targetCash, preset.targets.Cash, movement.holdingIncreases, movement.holdingReductions, movement.grossHoldingChangePercent,
    concentration[0].targetMembers.join('; '), concentration[0].targetWeightPercent, concentration[2].targetMembers.join('; '), concentration[2].targetWeightPercent,
    concentration[1].targetMembers.join('; '), concentration[1].targetWeightPercent,
    'Saved percentages recalculated against one current complete dated baseline; not saved dollar snapshots; cash included in weight denominator and excluded from rankings; positive weights ranked with alphabetical ties; top three uses up to three holdings; fixed catalog sector buckets including Unclassified and fictional DEMO; gross holding movement counts increases plus reductions; no fees, taxes, share rounding, returns, correlations, allocation recommendations, or recorded trades']);
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
