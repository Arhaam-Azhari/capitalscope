import { csvCell } from './csvCell';
import type { comparePrices } from './priceComparison';
import type { PriceHistory } from './types';

export function priceIntervals(result: ReturnType<typeof comparePrices>) {
  if (result.rows.length < 2) throw new Error('Interval analysis needs at least two shared observations.');
  const rows = result.rows.slice(1).map((end, i) => {
    const start = result.rows[i];
    const calendarDays = (Date.parse(end.date) - Date.parse(start.date)) / 86_400_000;
    if (!Number.isInteger(calendarDays) || calendarDays <= 0 || [start.currentClose, end.currentClose, start.referenceClose, end.referenceClose].some(close => !Number.isFinite(close) || close <= 0))
      throw new Error('Intervals need ordered distinct dates and finite positive closes.');
    const currentChangePercent = (end.currentClose / start.currentClose - 1) * 100;
    const referenceChangePercent = (end.referenceClose / start.referenceClose - 1) * 100;
    const gapPoints = currentChangePercent - referenceChangePercent;
    if (![currentChangePercent, referenceChangePercent, gapPoints].every(Number.isFinite)) throw new Error('Interval changes exceed the supported numeric range.');
    return { startDate: start.date, endDate: end.date, calendarDays, currentStartClose: start.currentClose, currentEndClose: end.currentClose,
      referenceStartClose: start.referenceClose, referenceEndClose: end.referenceClose, currentChangePercent, referenceChangePercent, gapPoints };
  });
  const extreme = (field: 'currentChangePercent' | 'referenceChangePercent', highest: boolean) => rows.reduce((best, row) => (highest ? row[field] > best[field] : row[field] < best[field]) ? row : best);
  return { rows, currentHighest: extreme('currentChangePercent', true), currentLowest: extreme('currentChangePercent', false),
    referenceHighest: extreme('referenceChangePercent', true), referenceLowest: extreme('referenceChangePercent', false) };
}

export function priceIntervalsCsv(current: PriceHistory, reference: PriceHistory, result: ReturnType<typeof comparePrices>, calculatedAt: string, exportedAt: string) {
  const header = ['model_version', 'current_ticker', 'reference_ticker', 'requested_start', 'requested_end', 'interval_start', 'interval_end', 'calendar_days', 'current_start_raw_close_usd', 'current_end_raw_close_usd', 'reference_start_raw_close_usd', 'reference_end_raw_close_usd', 'current_interval_change_percent', 'reference_interval_change_percent', 'current_minus_reference_change_points', 'shared_observations', 'current_excluded_observations', 'reference_excluded_observations', 'current_source', 'current_source_url', 'current_retrieved_at', 'reference_source', 'reference_source_url', 'reference_retrieved_at', 'currency', 'adjusted', 'data_mode', 'calculated_at', 'exported_at', 'scope'];
  const scope = 'Adjacent shared-date endpoints only. Each change is (end raw close / start raw close - 1) * 100; gap is current change minus reference change in percentage points, not a relative return. Calendar days measure date spacing, not trading sessions. Unequal interval lengths are not normalized. Highest/lowest ties use the earliest interval. Changes compound rather than sum; no filled prices, split/dividend adjustments, total returns, annualization, probability estimates, or investment rankings.';
  return [header, ...priceIntervals(result).rows.map(row => ['shared-raw-price-intervals-v1', current.ticker, reference.ticker, result.start, result.end, row.startDate, row.endDate, row.calendarDays, row.currentStartClose, row.currentEndClose, row.referenceStartClose, row.referenceEndClose, row.currentChangePercent, row.referenceChangePercent, row.gapPoints, result.rows.length, result.currentExcluded, result.referenceExcluded, current.source, current.sourceUrl, current.retrievedAt, reference.source, reference.sourceUrl, reference.retrievedAt, current.currency, String(current.adjusted), current.dataMode, calculatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
