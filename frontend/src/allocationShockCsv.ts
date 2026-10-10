import type { allocationShock } from './allocationShock';
import { csvCell } from './csvCell';
import type { PortfolioMarks } from './types';

export function allocationShockCsv(result: ReturnType<typeof allocationShock>, marks: PortfolioMarks, planCalculatedAt: string, shockCalculatedAt: string, exportedAt: string) {
  const headers = ['portfolio_id', 'model_version', 'data_mode', 'currency', 'bucket', 'bucket_kind', 'default_shock_percent', 'applied_shock_percent',
    'current_value_usd', 'target_value_usd', 'current_stressed_value_usd', 'target_stressed_value_usd', 'current_change_usd', 'target_change_usd',
    'baseline_total_usd', 'current_stressed_total_usd', 'target_stressed_total_usd', 'current_total_change_usd', 'target_total_change_usd',
    'current_total_change_percent', 'target_total_change_percent', 'target_minus_current_stressed_usd', 'baseline_evaluated_at', 'plan_calculated_at', 'shock_calculated_at', 'exported_at', 'scope'];
  const rows = result.rows.map(row => [marks.portfolioId, 'allocation-shock-v1', marks.dataMode, 'USD', row.label, row.kind, result.defaultShockPercent, row.shockPercent,
    row.currentValue, row.targetValue, row.currentStressedValue, row.targetStressedValue, row.currentChange, row.targetChange,
    result.baselineTotal, result.currentTotal, result.targetTotal, result.currentChange, result.targetChange, result.currentChangePercent, result.targetChangePercent,
    result.targetMinusCurrent, marks.evaluatedAt, planCalculatedAt, shockCalculatedAt, exportedAt,
    'User-entered hypothetical shocks applied once to current and target dollar allocations from the same dated baseline; sector overrides replace the default; each mix retains its own cash reserve; target mix assumes immediate cost-free allocation at baseline values; fixed catalog buckets include Unclassified and fictional DEMO; no subsequent rebalancing, fees, taxes, share rounding, correlations, forecast probabilities, or recorded fills; total fields repeat per bucket; price evidence is in the allocation plan CSV']);
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
