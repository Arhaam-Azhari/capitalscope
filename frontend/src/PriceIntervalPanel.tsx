import EvidenceTable from './EvidenceTable';
import { useState } from 'react';
import { priceIntervals, priceIntervalsCsv } from './priceIntervals';
import { reviewPriceIntervals, type IntervalDirection, type IntervalOrder } from './priceIntervalReview';
import type { comparePrices } from './priceComparison';
import type { PriceHistory } from './types';

export default function PriceIntervalPanel({ current, reference, result, calculatedAt }: { current: PriceHistory; reference: PriceHistory; result: ReturnType<typeof comparePrices>; calculatedAt: string }) {
  const [error, setError] = useState('');
  const [minimumGap, setMinimumGap] = useState('');
  const [direction, setDirection] = useState<IntervalDirection>('all');
  const [order, setOrder] = useState<IntervalOrder>('oldest');
  let intervals: ReturnType<typeof priceIntervals>;
  try { intervals = priceIntervals(result); }
  catch (e) { return <p className="notice warning" role="status">Interval comparison unavailable: {(e as Error).message}</p>; }
  let reviewed: typeof intervals.rows = []; let reviewError = '';
  try { reviewed = reviewPriceIntervals(intervals.rows, minimumGap, direction, order); }
  catch (e) { reviewError = (e as Error).message; }
  const evidence = (row: typeof intervals.rows[number], field: 'currentChangePercent' | 'referenceChangePercent') => <>{row[field].toFixed(2)}%<small className="comparison-evidence">{row.startDate} → {row.endDate} · {row.calendarDays} calendar days</small></>;
  function download() {
    try {
      const csv = priceIntervalsCsv(current, reference, result, calculatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${current.ticker}-${reference.ticker}-price-intervals.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError('');
    } catch { setError('The interval comparison CSV could not be prepared. Please try again.'); }
  }
  return <section aria-labelledby="price-interval-heading">
    <h4 id="price-interval-heading">Changes between shared dates</h4>
    <p className="muted small">Each interval runs between adjacent shared closing-price dates. Changes use the starting close as denominator; the gap is {current.ticker}'s change minus {reference.ticker}'s in percentage points. Calendar spacing is shown explicitly: these intervals can span different numbers of days and are not normalized to daily changes or trading sessions. Raw prices omit split and dividend adjustments.</p>
    <EvidenceTable label="Interval change summary"><table><caption>Highest and lowest observed interval changes</caption><thead><tr><th scope="col">Company</th><th scope="col">Highest interval change</th><th scope="col">Lowest interval change</th></tr></thead><tbody>
      <tr><th scope="row">{current.ticker}</th><td>{evidence(intervals.currentHighest, 'currentChangePercent')}</td><td>{evidence(intervals.currentLowest, 'currentChangePercent')}</td></tr>
      <tr><th scope="row">{reference.ticker}</th><td>{evidence(intervals.referenceHighest, 'referenceChangePercent')}</td><td>{evidence(intervals.referenceLowest, 'referenceChangePercent')}</td></tr>
    </tbody></table></EvidenceTable>
    <p className="muted small">Ties keep the earliest interval. Highest can still be negative and lowest can still be positive. Interval changes compound rather than add to the full-window change. The gap is not a relative return or a ranking.</p>
    <details><summary>Inspect every shared-date interval</summary>
      <div className="stress-inputs">
        <label>Minimum absolute interval gap (percentage points)<input type="number" min="0" step="0.01" placeholder="0" value={minimumGap} onChange={event => setMinimumGap(event.target.value)} /></label>
        <label>Interval gap direction<select value={direction} onChange={event => setDirection(event.target.value as IntervalDirection)}><option value="all">Both directions</option><option value="current-higher">{current.ticker} change higher</option><option value="reference-higher">{reference.ticker} change higher</option></select></label>
        <label>Interval review order<select value={order} onChange={event => setOrder(event.target.value as IntervalOrder)}><option value="oldest">Oldest first</option><option value="largest-gap">Largest absolute gap first</option></select></label>
      </div>
      <p className="muted small">Filters use the displayed gap rounded to two decimals, with an inclusive minimum; blank means zero. Direction also uses that displayed gap, so displayed ties match neither higher direction. Gap sorting uses unrounded magnitudes, with earliest dates breaking ties. The summary and CSV still include every interval; review controls do not change the comparison or request prices.</p>
      {reviewError ? <p className="notice warning" role="status">{reviewError}</p> : <p className="muted small" role="status">Showing {reviewed.length} of {intervals.rows.length} intervals.{reviewed.length === 0 && ' No intervals match this review.'}</p>}
      <button className="secondary" onClick={() => { setMinimumGap(''); setDirection('all'); setOrder('oldest'); }}>Reset interval review</button>
      {!reviewError && <EvidenceTable label="Shared-date interval changes"><table><caption>Shared-date interval price changes, {order === 'oldest' ? 'oldest first' : 'largest absolute gap first'}</caption><thead><tr><th scope="col">Start</th><th scope="col">End</th><th scope="col">Calendar days</th><th scope="col">{current.ticker} change</th><th scope="col">{reference.ticker} change</th><th scope="col">Gap (percentage points)</th></tr></thead><tbody>{reviewed.map(row => <tr key={row.endDate}><th scope="row">{row.startDate}</th><td>{row.endDate}</td><td>{row.calendarDays}</td><td>{row.currentChangePercent.toFixed(2)}%</td><td>{row.referenceChangePercent.toFixed(2)}%</td><td>{row.gapPoints.toFixed(2)}</td></tr>)}</tbody></table></EvidenceTable>}
    </details>
    <div className="export-actions"><button className="secondary" onClick={download}>Download price intervals CSV</button><p className="muted small">Always includes every interval in chronological order, regardless of review filters, with raw endpoints, unrounded changes, date spacing, coverage counts, source evidence, and calculation dates.</p></div>
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
