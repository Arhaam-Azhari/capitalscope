import { useEffect, useState } from 'react';
import { money, request } from './api';
import type { Company, PriceHistory } from './types';

export default function PricePanel({ company }: { company: Company }) {
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setHistory(null); setError('');
    const path = company.ticker === 'DEMO' ? '/api/examples/prices' : `/api/companies/${company.ticker}/prices`;
    request<PriceHistory>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setHistory(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [company.ticker, attempt]);
  const days = history ? [...history.days].reverse() : [];
  const low = Math.min(...days.map(d => d.close)); const high = Math.max(...days.map(d => d.close));
  const y = (close: number) => 170 - (close - low) / (high - low || 1) * 130;
  const x = (i: number) => days.length === 1 ? 260 : 45 + i / (days.length - 1) * 440;
  return <section className="panel" aria-labelledby="prices-heading">
    <div className="panel-title"><div><span className="eyebrow">MARKET HISTORY</span><h2 id="prices-heading">Daily prices</h2></div><span className="pill">Raw close · USD</span></div>
    <p className="notice warning">These are unadjusted daily prices, not live quotes. Splits and dividends are not accounted for. Price changes here are not total returns.</p>
    {error ? <div className="notice error" role="alert">{error}<button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry prices</button></div> : !history ? <p role="status">Loading daily prices…</p> : <>
      {history.dataMode === 'example' && <p className="notice example">These prices are invented for the fictional example company. Dates include calendar days and do not represent an exchange trading calendar.</p>}
      <p className="muted small">{history.source} · {history.days.length} observations{history.retrievedAt && ` · Retrieved ${new Date(history.retrievedAt).toLocaleString()}`}{history.sourceUrl && <> · <a href={history.sourceUrl} target="_blank" rel="noreferrer">Provider documentation ↗</a></>}</p>
      {days.length > 0 && <div className="trend"><svg viewBox="0 0 520 220" role="img" aria-label="Daily closing price trend; exact prices are in the table below">
        <text x="45" y="25">{money(high, false)}</text><text x="45" y="195">{money(low, false)}</text>
        <polyline fill="none" stroke="var(--accent)" strokeWidth="3" points={days.map((d, i) => `${x(i)},${y(d.close)}`).join(' ')} />
        <text x="45" y="215">{days[0].date}</text><text x="485" y="215" textAnchor="end">{days[days.length - 1].date}</text>
      </svg><p className="muted small">Vertical axis spans the observed close-price range; it does not start at zero.</p></div>}
      <div className="table-scroll"><table><caption>Daily raw prices, newest first</caption><thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody>{history.days.map(d => <tr key={d.date}><th scope="row">{d.date}</th><td>{money(d.open, false)}</td><td>{money(d.high, false)}</td><td>{money(d.low, false)}</td><td>{money(d.close, false)}</td><td>{d.volume.toLocaleString()}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
