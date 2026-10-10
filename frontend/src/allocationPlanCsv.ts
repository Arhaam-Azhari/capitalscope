import { allocationPlanSummary, allocationSectorPlan, allocationShareEstimate, rebalancePlan } from './portfolioRebalance';
import type { Company, PortfolioMarks } from './types';

function cell(value: string | number | null | undefined) {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  // I quote text and protect formula-like fields while leaving signed dollar changes numeric.
  const safe = /^[=+@-]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function allocationPlanCsv(marks: PortfolioMarks, targets: string[], calculatedAt: string, exportedAt: string, basisChecked = false, companies: Company[] = []) {
  const plan = rebalancePlan(marks, targets);
  const sectors = allocationSectorPlan(marks, targets, companies);
  const summary = allocationPlanSummary(marks, targets);
  const headers = ['portfolio_id', 'model_version', 'data_mode', 'currency', 'asset_kind', 'ticker', 'current_value_usd',
    'current_weight_percent', 'target_weight_percent', 'target_value_usd', 'dollar_change_usd', 'baseline_total_usd',
    'recorded_shares', 'stored_raw_close_usd', 'price_date', 'price_age_calendar_days', 'price_source', 'price_source_url',
    'price_retrieved_at', 'baseline_evaluated_at', 'plan_calculated_at', 'exported_at', 'share_estimate_model_version', 'user_share_basis_acknowledged', 'estimated_target_shares', 'estimated_share_change', 'share_estimate_unavailable_reason', 'movement_summary_model_version', 'plan_holding_increases_usd', 'plan_holding_reductions_usd', 'plan_gross_holding_change_percent', 'plan_target_cash_usd', 'plan_cash_change_usd', 'plan_balance_residual_usd', 'sector_model_version', 'allocation_bucket', 'bucket_kind', 'bucket_current_weight_percent', 'bucket_target_weight_percent', 'bucket_weight_change_pp', 'bucket_current_value_usd', 'bucket_target_value_usd', 'plan_scope'];
  const rows = plan.map((row, i) => {
    const holding = i === 0 ? undefined : marks.holdings[i - 1];
    const sector = sectors.find(group => holding ? group.kind === 'sector' && group.tickers.includes(holding.ticker) : group.kind === 'cash')!;
    const estimate = allocationShareEstimate(holding, row.targetValue, basisChecked);
    return [marks.portfolioId, 'allocation-dollars-v1', marks.dataMode, 'USD', holding ? 'holding' : 'cash', holding?.ticker,
      row.value, row.currentWeight * 100, Number(targets[i].trim()), row.targetValue, row.change, marks.totalValue,
      holding?.quantity, holding?.close, holding?.priceDate, holding?.priceAgeDays, holding?.source, holding?.sourceUrl,
      holding?.retrievedAt, marks.evaluatedAt, calculatedAt, exportedAt,
      'fractional-shares-v1', String(basisChecked), estimate.targetShares, estimate.shareChange, estimate.reason,
      'allocation-movement-v1', summary.holdingIncreases, summary.holdingReductions, summary.grossHoldingChangePercent, summary.targetCash, summary.cashChange, summary.balanceResidual,
      'allocation-sectors-v1', sector.label, sector.kind, sector.currentWeightPercent, sector.targetWeightPercent, sector.weightChangePoints, sector.currentValue, sector.targetValue,
      'User-entered targets; complete dated stored valuation; fixed total value; unrounded dollar arithmetic; cash is a reserve, not a trade; excludes fees, taxes, slippage, external cash flows and share rounding; optional fractional shares use raw dated closes and a manual share-basis acknowledgment, not verified split history; gross holding movement counts increases plus reductions over baseline total, excludes cash, and is not annual fund turnover; plan summary fields repeat on every asset row; sector groups use the fixed company catalog with Unclassified for missing classifications and Fictional Industrials for DEMO; sector weights include cash in the baseline denominator; bucket fields repeat for assets in the same bucket; percentage-point changes, not returns or correlation estimates; no orders or recorded fills'];
  });
  return [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
