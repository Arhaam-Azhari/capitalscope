import { allocationShock } from './allocationShock';
import { compareSavedAllocations } from './savedAllocationComparison';
import { csvCell } from './csvCell';
import type { SavedAllocationTarget } from './savedAllocationTargets';
import type { Company, PortfolioMarks } from './types';

export function compareSavedAllocationShocks(marks: PortfolioMarks, companies: Company[], selected: SavedAllocationTarget[], defaultShock: string, overrides: Record<string, string>) {
  return compareSavedAllocations(marks, companies, selected).map(item => ({
    preset: item.preset,
    result: allocationShock(marks, item.targets, companies, defaultShock, overrides),
  }));
}

export function savedAllocationShockCsv(cases: ReturnType<typeof compareSavedAllocationShocks>, marks: PortfolioMarks, calculatedAt: string, exportedAt: string) {
  const header = ['model_version', 'preset_id', 'preset_name', 'preset_saved_at', 'target_model_version', 'target_percentages_json', 'baseline_total_usd', 'baseline_cash_usd', 'baseline_holdings_json', 'baseline_evaluated_at', 'default_shock_percent', 'bucket_evidence_json', 'current_shocked_total_usd', 'target_shocked_total_usd', 'target_change_usd', 'target_change_percent', 'target_minus_current_usd', 'target_cash_usd', 'shock_calculated_at', 'exported_at', 'scope'];
  const scope = 'Same current stored baseline for every mix; immediate cost-free target allocation followed by one shared price shock; each cash reserve stays fixed; no further rebalancing, fees, taxes, share rounding, correlations, probabilities, forecasts, recommendations, or trades.';
  return [header, ...cases.map(({ preset, result }) => ['saved-allocation-shocks-v1', preset.id, preset.name, preset.createdAt, preset.modelVersion, JSON.stringify(preset.targets), result.baselineTotal, marks.cash, JSON.stringify(marks.holdings), marks.evaluatedAt, result.defaultShockPercent, JSON.stringify(result.rows), result.currentTotal, result.targetTotal, result.targetChange, result.targetChangePercent, result.targetMinusCurrent, result.rows.find(row => row.kind === 'cash')!.targetValue, calculatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
