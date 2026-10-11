import { csvCell } from './csvCell';
import type { priceDrawdown } from './priceDrawdown';
import type { PriceHistory } from './types';

type Drawdown = ReturnType<typeof priceDrawdown>;
export type DrawdownEpisode = {
  peak: Drawdown['rows'][number]; trough: Drawdown['rows'][number];
  recovery: Drawdown['rows'][number] | null; last: Drawdown['rows'][number];
  maximumDeclinePercent: number; peakToTroughIntervals: number;
  troughToRecoveryIntervals: number | null; peakToEndIntervals: number; belowPeakObservations: number;
};

export function priceDrawdownEpisodes(result: Drawdown): DrawdownEpisode[] {
  const episodes: DrawdownEpisode[] = [];
  let peakIndex = 0;
  let troughIndex = 0;
  let active = false;
  let belowPeakObservations = 0;
  function finish(endIndex: number, recovered: boolean) {
    episodes.push({ peak: result.rows[peakIndex], trough: result.rows[troughIndex],
      recovery: recovered ? result.rows[endIndex] : null, last: result.rows[endIndex],
      maximumDeclinePercent: result.rows[troughIndex].declinePercent,
      peakToTroughIntervals: troughIndex - peakIndex,
      troughToRecoveryIntervals: recovered ? endIndex - troughIndex : null,
      peakToEndIntervals: endIndex - peakIndex, belowPeakObservations });
  }
  result.rows.forEach((row, i) => {
    if (row.close >= result.rows[peakIndex].close) {
      if (active) finish(i, true);
      active = false; belowPeakObservations = 0; peakIndex = i;
    } else {
      if (!active) { active = true; troughIndex = i; }
      if (row.declinePercent > result.rows[troughIndex].declinePercent) troughIndex = i;
      belowPeakObservations++;
    }
  });
  if (active) finish(result.rows.length - 1, false);
  return episodes;
}

export function priceDrawdownEpisodesCsv(history: PriceHistory, result: Drawdown, calculatedAt: string, exportedAt: string) {
  const header = ['model_version', 'ticker', 'data_mode', 'currency', 'adjusted', 'source', 'source_url', 'retrieved_at', 'requested_start', 'requested_end', 'window_closes_json', 'episode_number', 'status', 'peak_date', 'peak_close_usd', 'trough_date', 'trough_close_usd', 'maximum_decline_percent', 'recovery_date', 'recovery_close_usd', 'episode_last_date', 'peak_to_trough_observation_intervals', 'trough_to_recovery_observation_intervals', 'peak_to_end_observation_intervals', 'below_peak_observations', 'calculated_at', 'exported_at', 'scope'];
  const evidence = JSON.stringify(result.rows.map(row => ({ date: row.date, close: row.close })));
  const scope = 'Each episode starts below the latest equal-or-higher running raw-close peak and ends at the first close at or above it, or the window end if unrecovered. Tied troughs retain the first date. Below-peak counts exclude peak and recovery; intervals count stored observations, not calendar or trading days. The window excludes earlier peaks and later recovery. No gap filling, intraday extrema, split or dividend adjustments, annualization, forecasts, or total returns.';
  return [header, ...priceDrawdownEpisodes(result).map((episode, i) => ['raw-close-episodes-v1', history.ticker, history.dataMode, history.currency, String(history.adjusted), history.source, history.sourceUrl, history.retrievedAt, result.start, result.end, evidence, i + 1, episode.recovery ? 'Recovered within window' : 'Recovery not observed within window', episode.peak.date, episode.peak.close, episode.trough.date, episode.trough.close, episode.maximumDeclinePercent, episode.recovery?.date, episode.recovery?.close, episode.last.date, episode.peakToTroughIntervals, episode.troughToRecoveryIntervals, episode.peakToEndIntervals, episode.belowPeakObservations, calculatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
