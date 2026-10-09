import { useEffect, useState } from 'react';
import { request } from './api';
import { researchChecks, reviewedCount } from './researchChecklist';
import type { Company, WatchlistEntry } from './types';

export default function SavedResearchComparison({ companies, tickers, onOpen }: {
  companies: Company[]; tickers: string[]; onOpen: (ticker: string) => void;
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setEntries([]);
    request<WatchlistEntry[]>('/api/watchlist', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setEntries(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Saved research is unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const columns = tickers.map(ticker => ({ ticker, company: companies.find(c => c.ticker === ticker), entry: entries.find(e => e.ticker === ticker) }));
  return <section aria-labelledby="saved-comparison-heading" className="saved-research-comparison">
    <div className="panel-title"><h3 id="saved-comparison-heading">Compare saved company research</h3><button className="secondary" disabled={loading} onClick={() => setAttempt(n => n + 1)}>Reload saved research comparison</button></div>
    <p className="muted small">Shared watchlist research for the selected real companies. Unsaved drafts and browser-only notes are excluded. Checklist marks are manual acknowledgments, not verified evidence or an investment ranking. Archived research remains visible and labeled. Reloading reads saved research without importing prices or fetching filings.</p>
    {loading ? <p role="status">Loading saved research comparison…</p> : error ? <p className="notice error" role="alert">Saved research comparison is unavailable: {error}</p> : <div className="table-scroll"><table className="comparison-table"><caption>Saved theses, risks, and self-reported research checks</caption><thead><tr><th>Research</th>{columns.map(({ ticker, company }) => <th key={ticker}>{company?.name || ticker}<small className="comparison-evidence">{ticker} · {company?.sector || 'Sector unavailable'}</small><button className="text-button" onClick={() => onOpen(ticker)}>Open research for {ticker}</button></th>)}</tr></thead><tbody>
      <tr><th>Saved status</th>{columns.map(({ ticker, entry }) => <td key={ticker}>{entry ? entry.status === 'archived' ? 'Archived research' : entry.status : 'No saved watchlist entry'}</td>)}</tr>
      <tr><th>Investment thesis</th>{columns.map(({ ticker, entry }) => <td key={ticker} className="research-comparison-text">{entry ? entry.thesis || 'No thesis recorded' : '—'}</td>)}</tr>
      <tr><th>Risks and evidence to check</th>{columns.map(({ ticker, entry }) => <td key={ticker} className="research-comparison-text">{entry ? entry.risks || 'No risks recorded' : '—'}</td>)}</tr>
      <tr><th>Next review date</th>{columns.map(({ ticker, entry }) => <td key={ticker}>{entry ? entry.reviewDate || 'No review date' : '—'}</td>)}</tr>
      <tr><th>Manual research progress</th>{columns.map(({ ticker, entry }) => <td key={ticker}>{entry ? `${reviewedCount(entry.checks)} of ${researchChecks.length} marked reviewed` : '—'}</td>)}</tr>
      {researchChecks.map(check => <tr key={check.id}><th>{check.label}</th>{columns.map(({ ticker, entry }) => <td key={ticker}>{entry ? entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed' : '—'}</td>)}</tr>)}
      <tr><th>Saved record</th>{columns.map(({ ticker, entry }) => <td key={ticker}>{entry ? <>Version {entry.version}<small className="comparison-evidence">Updated {new Date(entry.updatedAt).toLocaleString()}</small></> : '—'}</td>)}</tr>
    </tbody></table></div>}
  </section>;
}
