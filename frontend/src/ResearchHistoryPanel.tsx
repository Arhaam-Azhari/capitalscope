import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import { researchChecks, reviewedCount } from './researchChecklist';
import type { ResearchHistory, ResearchRevision } from './types';

export default function ResearchHistoryPanel({ ticker }: { ticker: string }) {
  const [items, setItems] = useState<ResearchRevision[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function load(older = false) {
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setError('');
    if (!older) { setItems([]); setLoaded(false); setBefore(null); }
    try {
      const history = await request<ResearchHistory>(`/api/watchlist/${ticker}/history${older && before ? `?before=${before}` : ''}`, { signal: controller.signal });
      if (!controller.signal.aborted) { setItems(previous => older ? [...previous, ...history.items] : history.items); setBefore(history.nextBefore); setLoaded(true); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Research history is unavailable.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="research-history" aria-labelledby="research-history-heading">
    <div className="panel-title"><h3 id="research-history-heading">Research revision history · {ticker}</h3><button type="button" className="secondary" disabled={busy} onClick={() => load()}>{loaded ? 'Reload research history' : 'Load research history'}</button></div>
    <p className="muted small">Shared saved notes, newest recorded revision first, 20 at a time. Unsaved drafts and browser-only notes are excluded. Removal retains historical notes; a recreated entry starts a new entry ID and version sequence. Earlier edits made before history tracking are unavailable; a baseline captures only the surviving record when it is first changed. There are no accounts or verified editor identities. These are research changes, not historical financial data or recommendations.</p>
    {busy && <p role="status">Loading research history…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {loaded && !items.length && <p className="muted">No recorded revisions for {ticker}. Existing legacy notes appear as a baseline when next saved or removed.</p>}
    <div className="research-history-items">{items.map(item => <details key={item.id}><summary>{item.action === 'removed' ? 'Removed from watchlist' : item.action === 'baseline' ? 'Legacy baseline captured' : 'Saved revision'} · Version {item.entry.version} · {new Date(item.recordedAt).toLocaleString()}</summary>
      <p className="muted small">Entry ID: {item.entry.entryId}<br />Record last saved: {new Date(item.entry.updatedAt).toLocaleString()} · {item.entry.status} · Review date: {item.entry.reviewDate || 'Not set'}</p>
      <h4>Investment thesis</h4><p className="summary-notes">{item.entry.thesis || 'No thesis recorded.'}</p>
      <h4>Risks and evidence to check</h4><p className="summary-notes">{item.entry.risks || 'No risks recorded.'}</p>
      <p className="muted small">{reviewedCount(item.entry.checks)} of {researchChecks.length} checks marked reviewed · self-reported</p>
      <ul className="summary-checklist">{researchChecks.map(check => <li key={check.id}>{check.label}: {item.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed'}</li>)}</ul>
    </details>)}</div>
    {loaded && before !== null && <button type="button" className="secondary" disabled={busy} onClick={() => load(true)}>Load older research revisions</button>}
  </section>;
}
