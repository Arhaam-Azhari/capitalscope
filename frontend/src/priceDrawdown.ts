import { csvCell } from './csvCell';
import type { PriceHistory } from './types';

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function priceDrawdown(history: PriceHistory, start: string, end: string) {
  if (history.currency !== 'USD' || history.adjusted !== false) throw new Error('This analysis requires unadjusted USD closing prices.');
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Choose a valid start date no later than the end date.');
  const sorted = [...history.days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.some((day, i) => !validDate(day.date) || !Number.isFinite(day.close) || day.close <= 0 || (i > 0 && day.date === sorted[i - 1].date)))
    throw new Error('Price history needs unique valid dates and finite positive closes.');
  const days = sorted.filter(day => day.date >= start && day.date <= end);
  if (days.length < 2) throw new Error('Choose a window containing at least two stored observations.');
  let peakIndex = 0;
  let worstPeakIndex = 0;
  let troughIndex = 0;
  let maximumDeclinePercent = 0;
  const rows = days.map((day, i) => {
    if (day.close >= days[peakIndex].close) peakIndex = i;
    const declinePercent = (1 - day.close / days[peakIndex].close) * 100;
    if (declinePercent > maximumDeclinePercent) { maximumDeclinePercent = declinePercent; worstPeakIndex = peakIndex; troughIndex = i; }
    return { ...day, runningPeakDate: days[peakIndex].date, runningPeakClose: days[peakIndex].close, declinePercent };
  });
  const peak = maximumDeclinePercent > 0 ? days[worstPeakIndex] : null;
  const trough = maximumDeclinePercent > 0 ? days[troughIndex] : null;
  const recoveryIndex = peak ? days.findIndex((day, i) => i > troughIndex && day.close >= peak.close) : -1;
  return { start, end, rows, maximumDeclinePercent, peak, trough,
    recovery: recoveryIndex >= 0 ? days[recoveryIndex] : null,
    peakToTroughIntervals: peak ? troughIndex - worstPeakIndex : null,
    troughToRecoveryIntervals: recoveryIndex >= 0 ? recoveryIndex - troughIndex : null,
    latestDeclinePercent: rows[rows.length - 1].declinePercent };
}

export function priceDrawdownCsv(history: PriceHistory, result: ReturnType<typeof priceDrawdown>, calculatedAt: string, exportedAt: string) {
  const headers = ['model_version', 'ticker', 'data_mode', 'currency', 'adjusted', 'source', 'source_url', 'retrieved_at', 'requested_start', 'requested_end', 'observation_date', 'raw_close_usd', 'running_peak_date', 'running_peak_close_usd', 'decline_from_peak_percent', 'maximum_decline_percent', 'maximum_peak_date', 'maximum_peak_close_usd', 'maximum_trough_date', 'maximum_trough_close_usd', 'recovery_date', 'peak_to_trough_observation_intervals', 'trough_to_recovery_observation_intervals', 'latest_decline_percent', 'calculated_at', 'exported_at', 'scope'];
  const scope = 'Stored observations within the inclusive window only; positive decline magnitudes from raw closing prices, not total returns; no split or dividend adjustments, intraday extrema, gap filling, or annualization. Equal highs reset the running peak to the latest date; equal maximum declines retain the first trough. Recovery is the first stored close at or above that episode peak after its trough; intervals count observations, not calendar or exchange trading days. Earlier peaks and later recovery outside the window are excluded.';
  return [headers, ...result.rows.map(row => ['raw-close-drawdown-v1', history.ticker, history.dataMode, history.currency, String(history.adjusted), history.source, history.sourceUrl, history.retrievedAt, result.start, result.end, row.date, row.close, row.runningPeakDate, row.runningPeakClose, row.declinePercent, result.maximumDeclinePercent, result.peak?.date, result.peak?.close, result.trough?.date, result.trough?.close, result.recovery?.date, result.peakToTroughIntervals, result.troughToRecoveryIntervals, result.latestDeclinePercent, calculatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
