import { csvCell } from './csvCell';
import type { PriceHistory } from './types';

export function rawPricesCsv(history: PriceHistory, loadedAt: string, exportedAt: string) {
  if (history.currency !== 'USD' || history.adjusted !== false) throw new Error('Raw-price export requires unadjusted USD prices.');
  if (!history.days.length) throw new Error('There are no stored price observations to export.');
  const days = [...history.days].sort((a, b) => b.date.localeCompare(a.date));
  for (const [i, day] of days.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(Date.parse(day.date)) || new Date(day.date).toISOString().slice(0, 10) !== day.date || (i > 0 && day.date === days[i - 1].date))
      throw new Error('Raw-price export needs unique valid observation dates.');
    if ([day.open, day.high, day.low, day.close].some(value => !Number.isFinite(value) || value <= 0) || day.low > Math.min(day.open, day.close) || day.high < Math.max(day.open, day.close))
      throw new Error('Raw-price export needs finite positive OHLC values within the recorded high-low range.');
    if (!Number.isSafeInteger(day.volume) || day.volume < 0) throw new Error('Raw-price export needs nonnegative volume counts within the supported exact integer range.');
  }
  const header = ['model_version', 'ticker', 'data_mode', 'currency', 'adjusted', 'observation_date', 'open_usd', 'high_usd', 'low_usd', 'close_usd', 'volume', 'source', 'source_url', 'provider_retrieved_at', 'view_loaded_at', 'exported_at', 'loaded_observations', 'scope'];
  const scope = 'Full loaded snapshot, newest stored date first, independent of analysis windows and review filters. Unadjusted OHLC prices and recorded volume, not live quotes or total returns. No split/dividend adjustments, inferred exchange calendar, filled dates, or silent price refresh. Example observations are invented calendar-day fixtures. Numeric fields preserve the values received by this browser without display rounding.';
  return [header, ...days.map(day => ['raw-price-history-v1', history.ticker, history.dataMode, history.currency, String(history.adjusted), day.date, day.open, day.high, day.low, day.close, day.volume, history.source, history.sourceUrl, history.retrievedAt, loadedAt, exportedAt, days.length, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
