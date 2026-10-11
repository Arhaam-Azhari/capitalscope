import { priceDrawdown } from './priceDrawdown';
import { csvCell } from './csvCell';
import type { PriceHistory } from './types';

export function priceComparisonCoverage(current: PriceHistory, reference: PriceHistory, start: string, end: string) {
  if (current.dataMode !== 'market' || reference.dataMode !== 'market' || current.ticker === reference.ticker)
    throw new Error('Choose two distinct market companies; example prices cannot be mixed into this comparison.');
  const currentWindow = priceDrawdown(current, start, end);
  const referenceWindow = priceDrawdown(reference, start, end);
  const currentByDate = new Map(currentWindow.rows.map(row => [row.date, row.close]));
  const referenceByDate = new Map(referenceWindow.rows.map(row => [row.date, row.close]));
  const dates = [...new Set([...currentByDate.keys(), ...referenceByDate.keys()])].sort();
  const rows = dates.map(date => ({ date, currentClose: currentByDate.get(date) ?? null, referenceClose: referenceByDate.get(date) ?? null,
    included: currentByDate.has(date) && referenceByDate.has(date) }));
  const shared = rows.filter(row => row.included).length;
  return { start, end, rows, shared, currentWindow, referenceWindow,
    currentSharedPercent: shared / currentWindow.rows.length * 100,
    referenceSharedPercent: shared / referenceWindow.rows.length * 100 };
}

export function comparePrices(current: PriceHistory, reference: PriceHistory, start: string, end: string) {
  const { currentWindow, referenceWindow } = priceComparisonCoverage(current, reference, start, end);
  const referenceByDate = new Map(referenceWindow.rows.map(row => [row.date, row]));
  const common = currentWindow.rows.filter(row => referenceByDate.has(row.date));
  if (common.length < 2) throw new Error('The chosen window needs at least two dates with stored closes for both companies.');
  const currentBase = common[0].close;
  const referenceBase = referenceByDate.get(common[0].date)!.close;
  const rows = common.map(row => ({ date: row.date, currentClose: row.close, referenceClose: referenceByDate.get(row.date)!.close,
    currentIndex: row.close / currentBase * 100, referenceIndex: referenceByDate.get(row.date)!.close / referenceBase * 100 }));
  if (rows.some(row => !Number.isFinite(row.currentIndex) || !Number.isFinite(row.referenceIndex) || row.currentIndex <= 0 || row.referenceIndex <= 0)) throw new Error('Indexed prices exceed the supported numeric range.');
  const sharedDates = new Set(rows.map(row => row.date));
  const drawdown = (history: PriceHistory) => priceDrawdown({ ...history, days: history.days.filter(day => sharedDates.has(day.date)) }, start, end).maximumDeclinePercent;
  return { start, end, rows, currentExcluded: currentWindow.rows.length - rows.length, referenceExcluded: referenceWindow.rows.length - rows.length,
    currentChangePercent: rows[rows.length - 1].currentIndex - 100, referenceChangePercent: rows[rows.length - 1].referenceIndex - 100,
    currentMaximumDeclinePercent: drawdown(current), referenceMaximumDeclinePercent: drawdown(reference) };
}

export function priceCoverageCsv(current: PriceHistory, reference: PriceHistory, coverage: ReturnType<typeof priceComparisonCoverage>, calculatedAt: string, exportedAt: string) {
  const header = ['model_version', 'current_ticker', 'reference_ticker', 'requested_start', 'requested_end', 'stored_date', 'current_raw_close_usd', 'reference_raw_close_usd', 'alignment_status', 'shared_observations', 'current_window_observations', 'reference_window_observations', 'current_shared_percent', 'reference_shared_percent', 'current_full_window_maximum_decline_percent', 'reference_full_window_maximum_decline_percent', 'current_source', 'current_source_url', 'current_retrieved_at', 'reference_source', 'reference_source_url', 'reference_retrieved_at', 'currency', 'adjusted', 'data_mode', 'calculated_at', 'exported_at', 'scope'];
  const scope = 'Union of stored dates inside the inclusive window; shared percentages use each company\'s own loaded observation count, not expected trading days. Blank closes are absent from that snapshot, not zero. Full-window drawdowns use each company\'s own dates and are not aligned comparisons. No inferred calendar gaps, filled dates, split/dividend adjustments, or total returns; earlier peaks and later recovery are excluded.';
  return [header, ...coverage.rows.map(row => ['raw-price-coverage-v1', current.ticker, reference.ticker, coverage.start, coverage.end, row.date, row.currentClose, row.referenceClose,
    row.included ? 'Shared date' : `No stored close for ${row.currentClose === null ? current.ticker : reference.ticker}`,
    coverage.shared, coverage.currentWindow.rows.length, coverage.referenceWindow.rows.length, coverage.currentSharedPercent, coverage.referenceSharedPercent,
    coverage.currentWindow.maximumDeclinePercent, coverage.referenceWindow.maximumDeclinePercent, current.source, current.sourceUrl, current.retrievedAt, reference.source, reference.sourceUrl, reference.retrievedAt,
    current.currency, String(current.adjusted), current.dataMode, calculatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function priceComparisonCsv(current: PriceHistory, reference: PriceHistory, result: ReturnType<typeof comparePrices>, calculatedAt: string, exportedAt: string) {
  const header = ['model_version', 'current_ticker', 'reference_ticker', 'data_mode', 'currency', 'adjusted', 'requested_start', 'requested_end', 'shared_date', 'current_raw_close_usd', 'reference_raw_close_usd', 'current_index_start_100', 'reference_index_start_100', 'current_window_change_percent', 'reference_window_change_percent', 'current_shared_date_maximum_decline_percent', 'reference_shared_date_maximum_decline_percent', 'current_excluded_observations', 'reference_excluded_observations', 'current_source', 'current_source_url', 'current_retrieved_at', 'reference_source', 'reference_source_url', 'reference_retrieved_at', 'calculated_at', 'exported_at', 'scope'];
  const scope = 'Distinct market companies, unadjusted USD closes; inclusive requested window; exact shared-date intersection only, no forward filling or trading-calendar assumptions. Each series starts at 100 on the first shared date. Changes and maximum closing-price declines use shared observations only; omitted observations may hide larger declines. Prices can be retrieved separately. No split or dividend adjustments, total returns, annualization, correlation estimates, forecasts, or investment ranking.';
  return [header, ...result.rows.map(row => ['shared-date-raw-prices-v1', current.ticker, reference.ticker, current.dataMode, current.currency, String(current.adjusted), result.start, result.end, row.date, row.currentClose, row.referenceClose, row.currentIndex, row.referenceIndex, result.currentChangePercent, result.referenceChangePercent, result.currentMaximumDeclinePercent, result.referenceMaximumDeclinePercent, result.currentExcluded, result.referenceExcluded, current.source, current.sourceUrl, current.retrievedAt, reference.source, reference.sourceUrl, reference.retrievedAt, calculatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
