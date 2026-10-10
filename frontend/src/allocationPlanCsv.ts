import { allocationShareEstimate, rebalancePlan } from './portfolioRebalance';
import type { PortfolioMarks } from './types';

function cell(value: string | number | null | undefined) {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  // I quote text and protect formula-like fields while leaving signed dollar changes numeric.
  const safe = /^[=+@-]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function allocationPlanCsv(marks: PortfolioMarks, targets: string[], calculatedAt: string, exportedAt: string, basisChecked = false) {
  const plan = rebalancePlan(marks, targets);
  const headers = ['portfolio_id', 'model_version', 'data_mode', 'currency', 'asset_kind', 'ticker', 'current_value_usd',
    'current_weight_percent', 'target_weight_percent', 'target_value_usd', 'dollar_change_usd', 'baseline_total_usd',
    'recorded_shares', 'stored_raw_close_usd', 'price_date', 'price_age_calendar_days', 'price_source', 'price_source_url',
    'price_retrieved_at', 'baseline_evaluated_at', 'plan_calculated_at', 'exported_at', 'share_estimate_model_version', 'user_share_basis_acknowledged', 'estimated_target_shares', 'estimated_share_change', 'share_estimate_unavailable_reason', 'plan_scope'];
  const rows = plan.map((row, i) => {
    const holding = i === 0 ? undefined : marks.holdings[i - 1];
    const estimate = allocationShareEstimate(holding, row.targetValue, basisChecked);
    return [marks.portfolioId, 'allocation-dollars-v1', marks.dataMode, 'USD', holding ? 'holding' : 'cash', holding?.ticker,
      row.value, row.currentWeight * 100, Number(targets[i].trim()), row.targetValue, row.change, marks.totalValue,
      holding?.quantity, holding?.close, holding?.priceDate, holding?.priceAgeDays, holding?.source, holding?.sourceUrl,
      holding?.retrievedAt, marks.evaluatedAt, calculatedAt, exportedAt,
      'fractional-shares-v1', String(basisChecked), estimate.targetShares, estimate.shareChange, estimate.reason,
      'User-entered targets; complete dated stored valuation; fixed total value; unrounded dollar arithmetic; cash is a reserve, not a trade; excludes fees, taxes, slippage, external cash flows and share rounding; optional fractional shares use raw dated closes and a manual share-basis acknowledgment, not verified split history; no orders or recorded fills'];
  });
  return [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
