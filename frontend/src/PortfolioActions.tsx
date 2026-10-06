import { useRef, useState, type FormEvent } from 'react';
import { money, request } from './api';
import type { PortfolioSummary } from './types';

export default function PortfolioActions({ summary, busy, setBusy, onSaved }: {
  summary: PortfolioSummary; busy: boolean; setBusy: (value: boolean) => void; onSaved: (value: PortfolioSummary) => void;
}) {
  const [kind, setKind] = useState('DIVIDEND'); const [ticker, setTicker] = useState('');
  const [value, setValue] = useState(''); const [denominator, setDenominator] = useState('1');
  const [error, setError] = useState('');
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const held = summary.positions.some(p => p.ticker === ticker) ? ticker : summary.positions[0]?.ticker || '';
  const actions = summary.events.filter(event => event.kind !== 'TRADE');
  async function record(event: FormEvent) {
    event.preventDefault();
    const action = { kind, ticker: held, value, denominator: kind === 'SPLIT' ? denominator : null };
    const signature = JSON.stringify([summary.portfolio.id, action]);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const result = await request<PortfolioSummary>(`/api/portfolios/${summary.portfolio.id}/actions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, requestId: pending.current!.id })
      });
      onSaved(result); setValue(''); pending.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record this event.'); }
    finally { setBusy(false); }
  }
  return <section className="portfolio-actions" aria-labelledby="actions-heading">
    <h3 id="actions-heading">Record a simulated company event</h3>
    <p className="muted small">These are manual practice events, not verified corporate actions. They apply to current holdings in recorded order. Dividends use the shares held now, without ex-date entitlement, withholding, or reinvestment. Splits do not alter the provider’s price history.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!summary.positions.length ? <p>Open a position before recording a split or dividend.</p> : <form onSubmit={record}><div className="model-fields">
      <label>Event company<select disabled={busy} value={held} onChange={e => setTicker(e.target.value)}>{summary.positions.map(position => <option key={position.ticker}>{position.ticker}</option>)}</select></label>
      <label>Event type<select disabled={busy} value={kind} onChange={e => { setKind(e.target.value); setValue(''); setError(''); }}><option value="DIVIDEND">Cash dividend</option><option value="SPLIT">Share split</option></select></label>
      <label>{kind === 'SPLIT' ? 'New shares in split ratio' : 'Cash dividend per share (USD)'}<input disabled={busy} type="number" required min={kind === 'SPLIT' ? '1' : '0.0001'} max="1000000000" step={kind === 'SPLIT' ? '1' : '0.0001'} value={value} onChange={e => setValue(e.target.value)} /></label>
      {kind === 'SPLIT' && <label>Old shares in split ratio<input disabled={busy} type="number" required min="1" max="1000000000" step="1" value={denominator} onChange={e => setDenominator(e.target.value)} /></label>}
    </div>{kind === 'SPLIT' && <p className="muted small">For a 2-for-1 split, enter 2 new shares and 1 old share. Reverse splits are supported when the resulting shares fit six decimal places. Cash in lieu is unavailable.</p>}
      <button className="primary" disabled={busy} type="submit">Record simulated event</button></form>}
    {actions.length > 0 && <div className="table-scroll"><table><caption>Recorded simulated company events</caption><thead><tr><th>Recorded</th><th>Ticker</th><th>Event</th><th>Manual terms</th></tr></thead><tbody>{actions.map(action => <tr key={action.requestId}><td>{new Date(action.recordedAt).toLocaleString()}</td><td>{action.ticker}</td><td>{action.kind}</td><td>{action.kind === 'SPLIT' ? `${action.value} new : ${action.denominator} old` : `${money(action.value!, false)} / share`}</td></tr>)}</tbody></table></div>}
  </section>;
}
