import { useState } from 'react';
import { priceIntervals, priceIntervalsCsv } from './priceIntervals';
import type { comparePrices } from './priceComparison';
import type { PriceHistory } from './types';

export default function PriceIntervalPanel({ current, reference, result, calculatedAt }: { current: PriceHistory; reference: PriceHistory; result: ReturnType<typeof comparePrices>; calculatedAt: string }) {
  const [error, setError] = useState('');
  let intervals: ReturnType<typeof priceIntervals>;
  try { intervals = priceIntervals(result); }
  catch (e) { return <p className="notice warning" role="status">Interval comparison unavailable: {(e as Error).message}</p>; }
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
    <div className="table-scroll"><table><caption>Highest and lowest observed interval changes</caption><thead><tr><th>Company</th><th>Highest interval change</th><th>Lowest interval change</th></tr></thead><tbody>
      <tr><th scope="row">{current.ticker}</th><td>{evidence(intervals.currentHighest, 'currentChangePercent')}</td><td>{evidence(intervals.currentLowest, 'currentChangePercent')}</td></tr>
      <tr><th scope="row">{reference.ticker}</th><td>{evidence(intervals.referenceHighest, 'referenceChangePercent')}</td><td>{evidence(intervals.referenceLowest, 'referenceChangePercent')}</td></tr>
    </tbody></table></div>
    <p className="muted small">Ties keep the earliest interval. Highest can still be negative and lowest can still be positive. Interval changes compound rather than add to the full-window change. The gap is not a relative return or a ranking.</p>
    <details><summary>Inspect every shared-date interval</summary><div className="table-scroll"><table><caption>Shared-date interval price changes, oldest first</caption><thead><tr><th>Start</th><th>End</th><th>Calendar days</th><th>{current.ticker} change</th><th>{reference.ticker} change</th><th>Gap (percentage points)</th></tr></thead><tbody>{intervals.rows.map(row => <tr key={row.endDate}><th scope="row">{row.startDate}</th><td>{row.endDate}</td><td>{row.calendarDays}</td><td>{row.currentChangePercent.toFixed(2)}%</td><td>{row.referenceChangePercent.toFixed(2)}%</td><td>{row.gapPoints.toFixed(2)}</td></tr>)}</tbody></table></div></details>
    <div className="export-actions"><button className="secondary" onClick={download}>Download price intervals CSV</button><p className="muted small">Includes both raw endpoint closes, unrounded changes and gaps, date spacing, coverage counts, source evidence, and calculation dates.</p></div>
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
