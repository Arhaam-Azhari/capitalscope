import ResearchHistoryPanel from './ResearchHistoryPanel';
import { watchlistDrafts, type WatchlistDraft } from './researchDrafts';
import { researchChecks, reviewedCount } from './researchChecklist';
import { localReviewDay, reviewQueue, reviewState } from './watchlistReview';
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
  const [checks, setChecks] = useState<string[]>([]);
  const [thesis, setThesis] = useState(''); const [risks, setRisks] = useState(''); const [reviewDate, setReviewDate] = useState('');
  const [today, setToday] = useState(localReviewDay);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active'); const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false); const [exportError, setExportError] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  const entry = entries.find(item => item.ticker === ticker);
  const universe = [{ ticker: 'DEMO', name: 'Example Manufacturing', sector: 'Fictional' }, ...companies];
  useEffect(() => {
    const refreshDay = () => setToday(localReviewDay());
    const timer = window.setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay); document.addEventListener('visibilitychange', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); document.removeEventListener('visibilitychange', refreshDay); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setReady(false); setError(''); setSaved('');
    request<WatchlistEntry[]>('/api/watchlist', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setEntries(data); setReady(true); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const draft = watchlistDrafts.get(ticker) ?? entry;
    setChecks(draft?.checks || []); setStatus(draft?.status || 'watching'); setThesis(draft?.thesis || ''); setRisks(draft?.risks || ''); setReviewDate(draft?.reviewDate || '');
  }, [entry, ticker, ready]);
  function keepDraft(patch: Partial<WatchlistDraft>) {
    const previous = watchlistDrafts.get(ticker);
    watchlistDrafts.set(ticker, { status, thesis, risks, checks, reviewDate: reviewDate || null,
      version: previous?.version ?? entry?.version ?? 0, entryId: previous ? previous.entryId : entry?.entryId || null, ...patch });
    setSaved('');
  }
  function edit(symbol: string) { setTicker(symbol); setError(''); setSaved(''); }
  async function downloadResearch() {
    setExporting(true); setExportError('');
    try {
      const response = await fetch('/api/watchlist/export.csv');
      if (!response.ok) {
        let message = 'Could not download saved research. Try again shortly.';
        try { message = (await response.json()).error || message; } catch { /* I keep a readable message when storage returns no JSON. */ }
        throw new Error(message);
      }
      if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv')) throw new Error('The research service did not return a CSV file. Try again shortly.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'watchlist-research.csv'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(e instanceof Error ? e.message : 'Could not download saved research.'); }
    finally { setExporting(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSaved('');
    try {
      const result = await request<WatchlistEntry>(`/api/watchlist/${ticker}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, thesis, risks, checks, reviewDate: reviewDate || null, version: watchlistDrafts.get(ticker)?.version ?? entry?.version ?? 0, entryId: watchlistDrafts.has(ticker) ? watchlistDrafts.get(ticker)!.entryId : entry?.entryId || null }) });
      watchlistDrafts.delete(ticker);
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
      watchlistDrafts.delete(ticker);
      setEntries(items => items.filter(item => item.ticker !== ticker)); setSaved('Removed from the shared watchlist.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this entry.'); }
    finally { setBusy(false); }
  }
  const counts = { overdue: 0, today: 0, soon: 0, undated: 0 };
  entries.forEach(item => { const bucket = reviewState(item, today).bucket; if (bucket in counts) counts[bucket as keyof typeof counts]++; });
  const query = search.trim().toLowerCase();
  const visible = reviewQueue(entries, today).filter(item => {
    const bucket = reviewState(item, today).bucket;
    const matches = filter === 'all' || (filter === 'active' ? bucket !== 'archived' : filter === 'due' ? bucket === 'overdue' || bucket === 'today' : filter === 'checks' ? bucket !== 'archived' && reviewedCount(item.checks) < researchChecks.length : filter === 'notes' ? bucket !== 'archived' && (!item.thesis.trim() || !item.risks.trim()) : bucket === filter);
    const company = universe.find(c => c.ticker === item.ticker);
    return matches && (!query || [item.ticker, company?.name, company?.sector, item.thesis, item.risks].filter(Boolean).join(' ').toLowerCase().includes(query));
  });
  return <section className="panel" aria-labelledby="watchlist-heading">
    <div className="panel-title"><div><span className="eyebrow">RESEARCH SHORTLIST</span><h2 id="watchlist-heading">My watchlist</h2></div><button className="secondary" disabled={busy || loading} onClick={() => { watchlistDrafts.delete(ticker); setAttempt(n => n + 1); }}>Reload watchlist</button></div>
    <p className="muted small">A shared shortlist without accounts. Everyone with app access can read and edit these theses. Research status and review dates are your notes, not trade recommendations or scheduled notifications. Unsaved drafts stay available when switching companies or views while this app is open. Closing or refreshing can lose drafts. Saved revision history is shared too; removing an entry retains its historical notes. Reloading replaces the open draft with saved research.</p>
    {error && <p className="notice error" role="alert">{error}</p>}{saved && <p className="save-status" role="status">{saved}</p>}
    <div className="export-actions"><button className="secondary" type="button" disabled={!ready || loading || busy || exporting} onClick={downloadResearch}>{exporting ? 'Downloading research…' : 'Download all saved research CSV'}</button><span className="muted small">Includes archived entries and saved notes from storage at download time. Search, filters, and unsaved drafts are excluded.</span></div>
    {exportError && <p className="notice error" role="alert">{exportError}</p>}
    <section className="review-queue" aria-label="Research review queue">
      <div className="panel-title"><h3>Research review queue</h3><span className="pill">Calendar day · {today}</span></div>
      <p className="muted small">Counts cover active saved research and exclude archived entries. Dates use your browser's local calendar day and refresh while this view is open. These are review tasks, not market alerts. Filters and search change the list below without changing your draft.</p>
      <div className="review-counts">{([['overdue', 'Overdue'], ['today', 'Due today'], ['soon', 'Next 7 days'], ['undated', 'No review date']] as const).map(([bucket, label]) => <button type="button" className={`review-count ${filter === bucket ? 'selected' : ''}`} aria-pressed={filter === bucket} disabled={!ready || loading} key={bucket} onClick={() => setFilter(bucket)}><span>{label}</span><strong data-testid={`review-count-${bucket}`}>{ready && !loading ? counts[bucket] : '—'}</strong></button>)}</div>
      <p className="muted small">Dated active entries appear first, with the oldest overdue date first; undated entries follow and archived entries come last. Equal dates sort by ticker. “Next 7 days” means tomorrow through seven calendar days from now. Missing notes flag an empty thesis or risks field, without assessing research quality.</p>
    </section>
    <div className="watchlist-layout"><div>
      <label className="watchlist-filter">Show entries<select value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Active research</option><option value="due">Review due</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="soon">Next 7 days</option><option value="later">Later reviews</option><option value="undated">No review date</option><option value="notes">Missing thesis or risks</option><option value="checks">Research checks still open</option><option value="all">All entries, including archived</option></select></label>
      <label className="watchlist-search">Search saved research<input type="search" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="Ticker, company, sector, thesis, or risks" /></label>
      {!loading && ready && <p className="muted small">{visible.length} of {entries.length} saved entries shown.</p>}
      {loading ? <p role="status">Loading watchlist…</p> : !ready ? <p className="notice warning">The review queue is unavailable until the watchlist reload succeeds.</p> : <ul className="watchlist-cards">{visible.map(item => {
        const company = universe.find(c => c.ticker === item.ticker);
        const review = reviewState(item, today);
        return <li key={item.ticker}><div className="watchlist-card-heading"><strong>{item.ticker}</strong><span className="pill">{item.status}</span></div><h3>{company?.name || item.ticker}</h3><p>{item.thesis || 'No thesis recorded yet.'}</p><span className="muted small">{item.reviewDate ? `Review ${item.reviewDate}${review.bucket === 'overdue' || review.bucket === 'today' ? ' · due' : ''}${review.bucket === 'overdue' ? ` · ${Math.abs(review.days!)} calendar days overdue` : review.bucket === 'today' ? ' · today' : review.bucket === 'soon' ? ` · in ${review.days} calendar days` : ''}` : 'No review date'} · {item.ticker === 'DEMO' ? 'Fictional company' : company?.sector}</span>{item.status !== 'archived' && (!item.thesis.trim() || !item.risks.trim()) && <p className="review-note-gap">Missing notes: {[!item.thesis.trim() ? 'thesis' : '', !item.risks.trim() ? 'risks' : ''].filter(Boolean).join(' and ')}.</p>}<p className="muted small">{reviewedCount(item.checks)} of {researchChecks.length} research checks marked reviewed · self-reported</p><div className="watchlist-card-actions"><button className="secondary" disabled={busy || loading || !ready} onClick={() => edit(item.ticker)}>Edit {item.ticker}</button>{(['Financials', 'Valuation', 'Prices'] as const).map(section => <button className="text-button" key={section} disabled={busy || loading || !ready} onClick={() => onOpen(item.ticker, section)}>{section} for {item.ticker}</button>)}</div></li>;
      })}{!visible.length && <li className="muted">{entries.length ? 'No entries match this filter.' : 'My shortlist is empty. Choose a company to start.'}</li>}</ul>}
    </div><form onSubmit={save} className="watchlist-editor"><h3>{entry ? `Edit ${ticker}` : 'Add a company'}</h3>
      <div className="model-fields"><label>Watchlist company<select disabled={busy || loading || !ready} value={ticker} onChange={e => edit(e.target.value)}>{universe.map(company => <option key={company.ticker} value={company.ticker}>{company.name} ({company.ticker})</option>)}</select></label><label>Research status<select disabled={busy || loading || !ready} value={status} onChange={e => { setStatus(e.target.value); keepDraft({ status: e.target.value }); }}><option value="watching">Watching</option><option value="researching">Researching</option><option value="archived">Archived</option></select></label><label>Next review date<input disabled={busy || loading || !ready} type="date" min="1900-01-01" max="2100-12-31" value={reviewDate} onChange={e => { setReviewDate(e.target.value); keepDraft({ reviewDate: e.target.value }); }} /></label></div>
      <label className="note-label" htmlFor="watchlist-thesis">My investment thesis</label><textarea id="watchlist-thesis" maxLength={2000} disabled={busy || loading || !ready} value={thesis} onChange={e => { setThesis(e.target.value); keepDraft({ thesis: e.target.value }); }} placeholder="What would need to be true for this business to become more valuable?" />
      <label className="note-label" htmlFor="watchlist-risks">Risks and evidence to check</label><textarea id="watchlist-risks" maxLength={1000} disabled={busy || loading || !ready} value={risks} onChange={e => { setRisks(e.target.value); keepDraft({ risks: e.target.value }); }} placeholder="What could invalidate my thesis? Which filings should I revisit?" />
      <fieldset className="research-checklist" disabled={busy || loading || !ready}><legend>My research checklist</legend><p className="muted small">These are my manual acknowledgments, not verified evidence or an investment score. Saving the watchlist also saves these checks. Revisit them when facts change; checking share basis here does not confirm a valuation price comparison.</p>{researchChecks.map(check => <label key={check.id}><input type="checkbox" checked={checks.includes(check.id)} onChange={event => { const next = event.target.checked ? [...checks, check.id] : checks.filter(id => id !== check.id); setChecks(next); keepDraft({ checks: next }); }} /><span>{check.label}<small>{check.detail}</small></span></label>)}<p className="muted small">{reviewedCount(checks)} of {researchChecks.length} marked reviewed in this draft.</p></fieldset>
      <div className="model-actions"><button className="primary" disabled={busy || loading || !ready} type="submit">{busy ? 'Saving…' : 'Save watchlist entry'}</button>{entry && <button className="text-button" disabled={busy || loading || !ready} type="button" onClick={remove}>Remove {ticker} from watchlist</button>}</div>
      {entry && <p className="muted small">Version {entry.version} · Updated {new Date(entry.updatedAt).toLocaleString()}</p>}
    </form></div>
    <ResearchHistoryPanel key={`${ticker}:${entry?.entryId || 'none'}:${entry?.version || 0}`} ticker={ticker} />
  </section>;
}
