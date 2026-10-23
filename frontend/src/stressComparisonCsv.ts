import type { SavedStress } from './SavedPortfolioStress';
import { csvCell } from './csvCell';

function baselineKey(item: SavedStress) {
  const baseline = item.result.baseline;
  // I compare the saved holdings and quote evidence, without treating evaluation time or display order as a price change.
  return JSON.stringify({ portfolioId: item.portfolioId, mode: baseline.dataMode, cash: baseline.cash,
    complete: baseline.complete, priced: baseline.pricedPositions, total: baseline.totalPositions,
    totalValue: baseline.totalValue, subtotal: baseline.pricedHoldingsValue,
    holdings: [...item.result.holdings].sort((a, b) => a.baseline.ticker.localeCompare(b.baseline.ticker)).map(({ baseline: mark, sector }) => ({
      ticker: mark.ticker, sector, quantity: mark.quantity, costBasis: mark.costBasis, close: mark.close,
      priceDate: mark.priceDate, source: mark.source, sourceUrl: mark.sourceUrl, retrievedAt: mark.retrievedAt, value: mark.value, error: mark.error
    })) });
}
export function matchingStressBaselines(item: SavedStress, reference: SavedStress) {
  return item.modelVersion === 'price-shock-v1' && reference.modelVersion === 'price-shock-v1'
    && item.result.baseline.complete && reference.result.baseline.complete && baselineKey(item) === baselineKey(reference);
}
export function stressReferenceDifference(item: SavedStress, reference: SavedStress) {
  if (!matchingStressBaselines(item, reference)) return { value: null, reason: 'Different or incomplete baseline, or unsupported model version' };
  const value = item.result.stressedTotalValue, base = reference.result.stressedTotalValue;
  if (value === null || base === null || !Number.isFinite(value) || !Number.isFinite(base) || !Number.isFinite(value - base))
    return { value: null, reason: 'Missing or non-finite stressed total or difference' };
  return { value: value - base, reason: '' };
}

export function stressComparisonCsv(selected: SavedStress[], referenceId: string, exportedAt: string) {
  if (selected.length < 2 || selected.length > 4 || new Set(selected.map(item => item.id)).size !== selected.length
    || selected.some(item => item.portfolioId !== selected[0].portfolioId || item.result.baseline.portfolioId !== selected[0].portfolioId))
    throw new Error('Choose two to four different saved stress cases for the same portfolio.');
  const reference = selected.find(item => item.id === referenceId);
  if (!reference) throw new Error('Choose a reference from the selected stress cases.');
  const header = ['schema_version', 'record_type', 'portfolio_id', 'scenario_id', 'scenario_name', 'saved_at', 'model_version', 'data_mode',
    'reference_scenario_id', 'reference_name', 'reference_model_version', 'reference_stressed_total_value', 'baseline_matches_reference',
    'reference_difference', 'reference_difference_unavailable_reason', 'baseline_evaluated_at', 'complete', 'priced_positions', 'total_positions',
    'cash', 'baseline_total', 'baseline_priced_holdings_value', 'stressed_total', 'stressed_priced_holdings_value', 'change', 'relative_change',
    'default_shock', 'sector', 'override_kind', 'sector_override', 'applied_shock', 'ticker', 'quantity', 'cost_basis', 'raw_close', 'price_date',
    'price_age_days', 'source', 'source_url', 'retrieved_at', 'baseline_value', 'stressed_value', 'holding_change', 'price_error', 'exported_at', 'currency', 'scope'];
  type Row = Record<string, string | number | null | undefined>;
  const rows: Row[] = [];
  const sectors = [...new Set(selected.flatMap(item => Object.keys(item.result.assumptions.sectorShocks)))].sort();
  for (const item of selected) {
    const r = item.result, b = r.baseline, difference = stressReferenceDifference(item, reference);
    const common: Row = { schema_version: 'stress-comparison-v1', portfolio_id: item.portfolioId, scenario_id: item.id, scenario_name: item.name,
      saved_at: item.createdAt, model_version: item.modelVersion, data_mode: b.dataMode, reference_scenario_id: reference.id,
      reference_name: reference.name, reference_model_version: reference.modelVersion, reference_stressed_total_value: reference.result.stressedTotalValue,
      baseline_matches_reference: String(matchingStressBaselines(item, reference)), reference_difference: difference.value,
      reference_difference_unavailable_reason: difference.reason, baseline_evaluated_at: b.evaluatedAt, complete: String(b.complete),
      priced_positions: b.pricedPositions, total_positions: b.totalPositions, cash: b.cash, baseline_total: b.totalValue,
      baseline_priced_holdings_value: b.pricedHoldingsValue, stressed_total: r.stressedTotalValue,
      stressed_priced_holdings_value: r.stressedPricedHoldingsValue, change: r.change, relative_change: r.relativeChange,
      default_shock: r.assumptions.defaultShock, exported_at: exportedAt, currency: 'USD',
      scope: 'All selected saved snapshots regardless of screen filters. Rates are decimal fractions. Hypothetical price shocks; not returns, forecasts, probabilities, or trade instructions. Reference differences require matching complete baselines and supported models.' };
    rows.push({ ...common, record_type: 'scenario' });
    for (const sector of sectors) {
      const explicit = Object.hasOwn(r.assumptions.sectorShocks, sector);
      rows.push({ ...common, record_type: 'sector_assumption', sector, override_kind: explicit ? 'explicit' : 'inherit_default',
        sector_override: explicit ? r.assumptions.sectorShocks[sector] : null,
        applied_shock: explicit ? r.assumptions.sectorShocks[sector] : r.assumptions.defaultShock });
    }
    for (const holding of r.holdings) {
      const mark = holding.baseline;
      rows.push({ ...common, record_type: 'holding', sector: holding.sector, applied_shock: holding.shock, ticker: mark.ticker,
        quantity: mark.quantity, cost_basis: mark.costBasis, raw_close: mark.close, price_date: mark.priceDate, price_age_days: mark.priceAgeDays,
        source: mark.source, source_url: mark.sourceUrl, retrieved_at: mark.retrievedAt, baseline_value: mark.value,
        stressed_value: holding.stressedValue, holding_change: holding.change, price_error: mark.error });
    }
  }
  // I keep signed numbers numeric, leave unavailable values blank, and protect user-entered text.
  return [header, ...rows.map(row => header.map(key => row[key]))].map(row => row.map(value => csvCell(typeof value === 'number' && !Number.isFinite(value) ? null : value)).join(',')).join('\r\n') + '\r\n';
}
