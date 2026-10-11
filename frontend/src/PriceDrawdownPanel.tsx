import { useState, type FormEvent } from 'react';
import { priceDrawdown, priceDrawdownCsv } from './priceDrawdown';
import { priceDrawdownEpisodes, priceDrawdownEpisodesCsv } from './priceDrawdownEpisodes';
import PriceDrawdownChart from './PriceDrawdownChart';
import { money } from './api';
import type { PriceHistory } from './types';

export default function PriceDrawdownPanel({ history }: { history: PriceHistory }) {
  const dates = [...new Set(history.days.map(day => day.date))].sort();
  const [start, setStart] = useState(dates[0] || '');
  const [end, setEnd] = useState(dates[dates.length - 1] || '');
  const [result, setResult] = useState<ReturnType<typeof priceDrawdown> | null>(null);
  const [calculatedAt, setCalculatedAt] = useState('');
  const [error, setError] = useState('');
  function clear() { setResult(null); setError(''); }
  function calculate(event: FormEvent) {
    event.preventDefault(); clear();
    try { setResult(priceDrawdown(history, start, end)); setCalculatedAt(new Date().toISOString()); }
    catch (e) { setError((e as Error).message); }
  }
  function download(episodes = false) {
    if (!result) return;
    try {
      const csv = (episodes ? priceDrawdownEpisodesCsv : priceDrawdownCsv)(history, result, calculatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${history.ticker}-raw-close-${episodes ? 'episodes' : 'drawdown'}.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError('The drawdown CSV could not be prepared. Please try again.'); }
  }
  const episodes = result ? priceDrawdownEpisodes(result) : [];
  return <section aria-labelledby="drawdown-heading">
    <h3 id="drawdown-heading">Raw-close drawdown analysis</h3>
    <p className="muted small">Choose an inclusive window from the loaded observations. Declines are positive percentages below a prior closing-price peak inside that window. Splits can create apparent losses and dividends are excluded: this is not total-return performance. Missing days stay missing; no earlier peak or later recovery outside this window is included.</p>
    <form onSubmit={calculate}><div className="stress-inputs">
      <label>Drawdown start date<select value={start} onChange={event => { clear(); setStart(event.target.value); }}>{dates.map(date => <option key={date}>{date}</option>)}</select></label>
      <label>Drawdown end date<select value={end} onChange={event => { clear(); setEnd(event.target.value); }}>{dates.map(date => <option key={date}>{date}</option>)}</select></label>
    </div><button className="secondary" disabled={dates.length < 2}>Analyze price drawdown</button></form>
    {dates.length < 2 && <p className="muted small">At least two stored observations are needed.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {result && <>
      <dl className="allocation-plan-summary"><div><dt>Maximum observed decline</dt><dd>{result.maximumDeclinePercent.toFixed(2)}%</dd></div><div><dt>Latest decline from running peak</dt><dd>{result.latestDeclinePercent.toFixed(2)}%</dd></div></dl>
      {result.peak && result.trough ? <p>Peak: {result.peak.date} at {money(result.peak.close, false)}. Trough: {result.trough.date} at {money(result.trough.close, false)} ({result.peakToTroughIntervals} observation intervals after peak). {result.recovery ? `Recovery: ${result.recovery.date}, ${result.troughToRecoveryIntervals} observation intervals after trough.` : 'Recovery not observed within this window.'}</p> : <p>No closing-price decline observed within this window.</p>}
      <p className="muted small">{result.rows.length} observations, {result.rows[0].date} through {result.rows[result.rows.length - 1].date}. Equal highs use the most recent peak; tied maximum declines keep the first trough. Recovery means the first later stored close at or above that episode's peak. Intervals count observations, not calendar or exchange trading days.</p>
      <PriceDrawdownChart result={result} />
      <h4>Decline and recovery episodes</h4>
      <p className="muted small">Each episode begins below a running peak and ends at the first observed close at or above that peak. An unfinished episode stops at this window's last observation. Below-peak counts exclude the peak and recovery observations. Tied troughs keep the first date.</p>
      {episodes.length === 0 ? <p>No decline episodes observed within this window.</p> : <>
        <div className="table-scroll"><table><caption>Raw-close decline episodes, oldest first</caption><thead><tr><th>Peak</th><th>Trough</th><th>Deepest decline</th><th>Recovery</th><th>Peak → trough intervals</th><th>Trough → recovery intervals</th><th>Peak → end intervals</th><th>Below-peak observations</th></tr></thead><tbody>{episodes.map(episode => <tr key={episode.peak.date}><th scope="row">{episode.peak.date}<small className="comparison-evidence">{money(episode.peak.close, false)}</small></th><td>{episode.trough.date}<small className="comparison-evidence">{money(episode.trough.close, false)}</small></td><td>{episode.maximumDeclinePercent.toFixed(2)}%</td><td>{episode.recovery ? episode.recovery.date : 'Not observed within window'}</td><td>{episode.peakToTroughIntervals}</td><td>{episode.troughToRecoveryIntervals ?? '—'}</td><td>{episode.peakToEndIntervals}</td><td>{episode.belowPeakObservations}</td></tr>)}</tbody></table></div>
        <div className="export-actions"><button className="secondary" onClick={() => download(true)}>Download drawdown episodes CSV</button><p className="muted small">Exports one row per episode, the full window's closing-price evidence, source and calculation dates, and observation-count definitions.</p></div>
      </>}
      <div className="table-scroll"><table><caption>Window drawdown observations, oldest first</caption><thead><tr><th>Date</th><th>Raw close</th><th>Running peak date</th><th>Running peak close</th><th>Decline from peak</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{money(row.close, false)}</td><td>{row.runningPeakDate}</td><td>{money(row.runningPeakClose, false)}</td><td>{row.declinePercent.toFixed(2)}%</td></tr>)}</tbody></table></div>
      <div className="export-actions"><button className="secondary" onClick={() => download()}>Download drawdown CSV</button><p className="muted small">Includes every window close, unrounded calculations, source evidence, dates, and model limits.</p></div>
    </>}
  </section>;
}
