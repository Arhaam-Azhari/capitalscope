import { useEffect, useState, type FormEvent } from 'react';
import { request } from './api';
import type { Company, WatchlistEntry } from './types';

type ResearchSection = 'Financials' | 'Valuation' | 'Prices';
export default function WatchlistPanel({ companies, currentTicker, onOpen }: {
  companies: Company[]; currentTicker: string; onOpen: (ticker: string, section: ResearchSection) => void;
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [ticker, setTicker] = useState(currentTicker);
  const [status, setStatus] = useState('watching');
  const [thesis, setThesis] = useState(''); const [risks, setRisks] = useState(''); const [reviewDate, setReviewDate] = useState('');
  const [filter, setFilter] = useState('active'); const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  const entry = entries.find(item => item.ticker === ticker);
  const universe = [{ ticker: 'DEMO', name: 'Example Manufacturing', sector: 'Fictional' }, ...companies];
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setReady(false); setError(''); setSaved('');
    request<WatchlistEntry[]>('/api/watchlist', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setEntries(data); setReady(true); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    setStatus(entry?.status || 'watching'); setThesis(entry?.thesis || ''); setRisks(entry?.risks || ''); setReviewDate(entry?.reviewDate || '');
  }, [entry, ticker]);
  function edit(symbol: string) { setTicker(symbol); setError(''); setSaved(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSaved('');
    try {
      const result = await request<WatchlistEntry>(`/api/watchlist/${ticker}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, thesis, risks, reviewDate: reviewDate || null, version: entry?.version || 0, entryId: entry?.entryId || null }) });
      setEntries(items => [result, ...items.filter(item => item.ticker !== ticker)]); setSaved('Saved to the shared watchlist.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this research.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!entry) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const response = await fetch(`/api/watchlist/${ticker}?version=${entry.version}&entryId=${encodeURIComponent(entry.entryId)}`, { method: 'DELETE' });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Could not remove this entry.'); }
      setEntries(items => items.filter(item => item.ticker !== ticker)); setSaved('Removed from the shared watchlist.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this entry.'); }
    finally { setBusy(false); }
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const visible = entries.filter(item => filter === 'all' || (filter === 'due' ? item.status !== 'archived' && item.reviewDate && item.reviewDate <= today : item.status !== 'archived'));
  return <section className="panel" aria-labelledby="watchlist-heading">
    <div className="panel-title"><div><span className="eyebrow">RESEARCH SHORTLIST</span><h2 id="watchlist-heading">My watchlist</h2></div><button className="secondary" disabled={busy || loading} onClick={() => setAttempt(n => n + 1)}>Reload watchlist</button></div>
    <p className="muted small">A shared shortlist without accounts. Everyone with app access can read and edit these theses. Research status and review dates are your notes, not trade recommendations or scheduled notifications. Reloading replaces the open draft with saved research.</p>
    {error && <p className="notice error" role="alert">{error}</p>}{saved && <p className="save-status" role="status">{saved}</p>}
    <div className="watchlist-layout"><div>
      <label className="watchlist-filter">Show entries<select value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Active research</option><option value="due">Review due</option><option value="all">All entries, including archived</option></select></label>
      {loading ? <p role="status">Loading watchlist…</p> : <ul className="watchlist-cards">{visible.map(item => {
        const company = universe.find(c => c.ticker === item.ticker);
        return <li key={item.ticker}><div className="watchlist-card-heading"><strong>{item.ticker}</strong><span className="pill">{item.status}</span></div><h3>{company?.name || item.ticker}</h3><p>{item.thesis || 'No thesis recorded yet.'}</p><span className="muted small">{item.reviewDate ? `Review ${item.reviewDate}${item.status !== 'archived' && item.reviewDate <= today ? ' · due' : ''}` : 'No review date'} · {item.ticker === 'DEMO' ? 'Fictional company' : company?.sector}</span><div className="watchlist-card-actions"><button className="secondary" disabled={busy || loading || !ready} onClick={() => edit(item.ticker)}>Edit {item.ticker}</button>{(['Financials', 'Valuation', 'Prices'] as const).map(section => <button className="text-button" key={section} disabled={busy || loading || !ready} onClick={() => onOpen(item.ticker, section)}>{section} for {item.ticker}</button>)}</div></li>;
      })}{!visible.length && <li className="muted">{entries.length ? 'No entries match this filter.' : 'My shortlist is empty. Choose a company to start.'}</li>}</ul>}
    </div><form onSubmit={save} className="watchlist-editor"><h3>{entry ? `Edit ${ticker}` : 'Add a company'}</h3>
      <div className="model-fields"><label>Watchlist company<select disabled={busy || loading || !ready} value={ticker} onChange={e => edit(e.target.value)}>{universe.map(company => <option key={company.ticker} value={company.ticker}>{company.name} ({company.ticker})</option>)}</select></label><label>Research status<select disabled={busy || loading || !ready} value={status} onChange={e => setStatus(e.target.value)}><option value="watching">Watching</option><option value="researching">Researching</option><option value="archived">Archived</option></select></label><label>Next review date<input disabled={busy || loading || !ready} type="date" min="1900-01-01" max="2100-12-31" value={reviewDate} onChange={e => setReviewDate(e.target.value)} /></label></div>
      <label className="note-label" htmlFor="watchlist-thesis">My investment thesis</label><textarea id="watchlist-thesis" maxLength={2000} disabled={busy || loading || !ready} value={thesis} onChange={e => setThesis(e.target.value)} placeholder="What would need to be true for this business to become more valuable?" />
      <label className="note-label" htmlFor="watchlist-risks">Risks and evidence to check</label><textarea id="watchlist-risks" maxLength={1000} disabled={busy || loading || !ready} value={risks} onChange={e => setRisks(e.target.value)} placeholder="What could invalidate my thesis? Which filings should I revisit?" />
      <div className="model-actions"><button className="primary" disabled={busy || loading || !ready} type="submit">{busy ? 'Saving…' : 'Save watchlist entry'}</button>{entry && <button className="text-button" disabled={busy || loading || !ready} type="button" onClick={remove}>Remove {ticker} from watchlist</button>}</div>
      {entry && <p className="muted small">Version {entry.version} · Updated {new Date(entry.updatedAt).toLocaleString()}</p>}
    </form></div>
  </section>;
}
