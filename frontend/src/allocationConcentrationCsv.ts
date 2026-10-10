import { csvCell } from './csvCell';
import { allocationConcentration } from './portfolioRebalance';
import type { Company, PortfolioMarks } from './types';

export function allocationConcentrationCsv(marks: PortfolioMarks, targets: string[], companies: Company[], calculatedAt: string, exportedAt: string) {
  const headers = ['portfolio_id', 'model_version', 'data_mode', 'currency', 'baseline_total_usd', 'metric',
    'current_members', 'current_weight_percent', 'target_members', 'target_weight_percent', 'weight_change_pp',
    'baseline_evaluated_at', 'plan_calculated_at', 'exported_at', 'scope'];
  const rows = allocationConcentration(marks, targets, companies).map(row => [marks.portfolioId, 'allocation-concentration-v1', marks.dataMode, 'USD', marks.totalValue,
    row.metric, row.currentMembers.join('; '), row.currentWeightPercent, row.targetMembers.join('; '), row.targetWeightPercent, row.weightChangePoints,
    marks.evaluatedAt, calculatedAt, exportedAt,
    'User-entered targets; complete dated stored valuation; full baseline denominator including cash; cash excluded from holding and sector rankings; only positive weights ranked independently on each side; alphabetical tie breaks; top three means up to three holdings; fixed catalog sector buckets including Unclassified and fictional DEMO; changes in metric level, not the same assets when leaders change; not returns, correlations or an allocation recommendation; per-holding price evidence is in the allocation plan CSV; no orders or recorded fills']);
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
