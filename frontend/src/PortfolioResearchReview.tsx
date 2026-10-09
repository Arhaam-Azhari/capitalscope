import { useEffect, useState } from 'react';
import { request } from './api';
import { localReviewDay, reviewState } from './watchlistReview';
import { researchChecks, reviewedCount } from './researchChecklist';
import { portfolioResearchCsv, portfolioResearchQueue, portfolioResearchRows } from './portfolioResearch';
import type { Company, PortfolioSummary, WatchlistEntry } from './types';

export default function PortfolioResearchReview({ summary, companies, onOpen }: {
  summary: PortfolioSummary; companies: Company[]; onOpen: (ticker: string) => void;
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState('');
  const [exportError, setExportError] = useState('');
  const [filter, setFilter] = useState('all');
  const [order, setOrder] = useState('holdings');
  const [today, setToday] = useState(localReviewDay);
  useEffect(() => {
    const refresh = () => setToday(localReviewDay());
    const timer = window.setInterval(refresh, 60000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController(); setLoading(true); setReady(false); setEntries([]); setError(''); setLoadedAt(''); setExportError('');
    request<WatchlistEntry[]>('/api/watchlist', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setEntries(data); setLoadedAt(new Date().toISOString()); setReady(true); }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Saved research is unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const rows = portfolioResearchRows(summary, companies, entries, today);
  function download() {
    setExportError('');
    try {
      const csv = portfolioResearchCsv(summary, rows, today, loadedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'portfolio-research.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('I could not prepare the research CSV. Please try again.'); }
  }
  const ordered = order === 'queue' ? portfolioResearchQueue(rows) : rows;
  const visible = filter === 'needs' ? ordered.filter(row => row.needsReview) : ordered;
  return <section className="portfolio-actions" aria-labelledby="portfolio-research-heading">
    <div className="panel-title"><h3 id="portfolio-research-heading">Research review for my holdings</h3><button className="secondary" disabled={loading || !rows.length} onClick={() => setAttempt(value => value + 1)}>{ready ? 'Reload portfolio research' : 'Load portfolio research'}</button></div>
    <p className="muted small">Current simulated positions matched to shared saved watchlist research. Cash and closed positions are excluded. Research is not a recommendation, a coverage score, or evidence supporting past trades. Manual checklist marks are self-reported. Drafts and browser-only notes are excluded; loading here reads saved notes without importing prices or filings.</p>
    <div className="export-actions"><button className="secondary" disabled={!ready || loading || !rows.length} onClick={download}>Download all holdings research CSV</button><p className="muted small">Exports every current holding, regardless of the filter or queue order, with the last loaded saved notes and their timestamps. Reload research for newer notes. This combines current positions with separately loaded research, not a synchronized database snapshot.</p></div>
    {exportError && <p className="notice error" role="alert">{exportError}</p>}
    {!rows.length ? <p className="muted">No open positions to review.</p> : loading ? <p role="status">Loading portfolio research…</p> : error ? <p role="alert" className="notice error">{error}</p> : !ready ? <p className="muted">Load saved research to review the current holdings.</p> : <>
      <p className="muted small">{rows.length} holdings · {rows.filter(row => row.supported && !row.entry).length} without a saved entry · {rows.filter(row => row.archived).length} with archived research · {rows.filter(row => row.missingNotes).length} with missing notes · {rows.filter(row => row.openChecks).length} with open manual checks · {rows.filter(row => row.due).length} due for review.</p>
      <p className="muted small">Missing notes, open checks, and due dates count active saved entries only; categories can overlap. Review dates use this browser's local calendar day ({today}), not scheduled alerts. Unsupported holdings remain labeled and cannot open a company view.</p>
      <label className="watchlist-filter">Portfolio research filter<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All current holdings</option><option value="needs">Research needs review</option></select></label>
      <label className="watchlist-filter">Portfolio research order<select value={order} onChange={event => setOrder(event.target.value)}><option value="holdings">Holdings order</option><option value="queue">Review queue</option></select></label>
      {order === 'queue' && <p className="muted small">Queue order: overdue, due today, no saved research, archived research, missing notes, open manual checks, reviews scheduled within seven days, no current gaps flagged, then unsupported instruments. Within a group, earlier review dates come first, then ticker. This is a workflow order, not an investment ranking.</p>}
      <div className="table-scroll"><table className="comparison-table"><caption>Saved research matched to current simulated holdings</caption><thead><tr><th>Holding / shares</th><th>Saved research</th><th>Notes and manual checks</th><th>Review / saved date</th><th>Company research</th></tr></thead><tbody>{visible.map(({ position, supported, entry, archived, reasons, queueGroup }) => <tr key={position.ticker}>
        <th scope="row">{position.ticker}<small className="comparison-evidence">{position.ticker === 'DEMO' ? 'Fictional company' : companies.find(c => c.ticker === position.ticker)?.name || 'Outside current catalog'}<span>{position.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} simulated shares</span></small></th>
        <td>{!supported ? 'Unsupported instrument for this portfolio mode' : !entry ? 'No saved watchlist entry' : archived ? 'Archived research' : entry.status}<small className="comparison-evidence">{queueGroup}<span>{reasons.length ? reasons.join(' · ') : 'No current gaps flagged; research quality is not verified.'}</span></small></td>
        <td>{entry ? <><p className="muted small">Thesis: {entry.thesis.trim() ? 'Recorded' : 'Missing'} · Risks: {entry.risks.trim() ? 'Recorded' : 'Missing'}<br />{reviewedCount(entry.checks)} of {researchChecks.length} marked reviewed</p><details><summary>Read saved notes for {position.ticker}</summary><h4>Investment thesis</h4><p className="summary-notes">{entry.thesis || 'No thesis recorded.'}</p><h4>Risks and evidence to check</h4><p className="summary-notes">{entry.risks || 'No risks recorded.'}</p></details></> : 'Unavailable'}</td>
        <td>{entry ? <>{entry.reviewDate || 'No review date'}{!archived && ['overdue', 'today'].includes(reviewState(entry, today).bucket) && <span> · due</span>}<small className="comparison-evidence">Version {entry.version}<span>Updated {new Date(entry.updatedAt).toLocaleString()}</span></small></> : '—'}</td>
        <td><button className="text-button" disabled={!supported} onClick={() => onOpen(position.ticker)}>Open research for {position.ticker}</button></td>
      </tr>)}{!visible.length && <tr><td colSpan={5}>No holdings match this research filter. This does not verify research quality.</td></tr>}</tbody></table></div>
    </>}
  </section>;
}
