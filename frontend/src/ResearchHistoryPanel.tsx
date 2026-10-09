import ResearchRevisionComparison, { revisionAction } from './ResearchRevisionComparison';
import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import { researchChecks, reviewedCount } from './researchChecklist';
import type { ResearchHistory, ResearchRevision } from './types';

export default function ResearchHistoryPanel({ ticker, editorReady, hasDraft, onRestore }: { ticker: string; editorReady: boolean; hasDraft: boolean; onRestore: (revision: ResearchRevision) => void }) {
  const [items, setItems] = useState<ResearchRevision[]>([]);
  const [candidate, setCandidate] = useState<ResearchRevision | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function load(older = false) {
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setError('');
    if (!older) { setCandidate(null); setSelected([]); setItems([]); setLoaded(false); setBefore(null); }
    try {
      const history = await request<ResearchHistory>(`/api/watchlist/${ticker}/history${older && before ? `?before=${before}` : ''}`, { signal: controller.signal });
      if (!controller.signal.aborted) { setItems(previous => older ? [...previous, ...history.items] : history.items); setBefore(history.nextBefore); setLoaded(true); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Research history is unavailable.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function downloadHistory() {
    setExporting(true); setExportError('');
    try {
      const response = await fetch(`/api/watchlist/${ticker}/history/export.csv`);
      if (!response.ok) {
        let message = 'Could not download research history. Try again shortly.';
        try { message = (await response.json()).error || message; } catch { /* I keep a readable error when storage returns no JSON. */ }
        throw new Error(message);
      }
      if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv')) throw new Error('The research service did not return a CSV file. Try again shortly.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `${ticker}-research-history.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(e instanceof Error ? e.message : 'Could not download research history.'); }
    finally { setExporting(false); }
  }
  return <section className="research-history" aria-labelledby="research-history-heading">
    <div className="panel-title"><h3 id="research-history-heading">Research revision history · {ticker}</h3><button type="button" className="secondary" disabled={busy} onClick={() => load()}>{loaded ? 'Reload research history' : 'Load research history'}</button></div>
    <p className="muted small">Shared saved notes, newest recorded revision first, 20 at a time. Unsaved drafts and browser-only notes are excluded. Removal retains historical notes; a recreated entry starts a new entry ID and version sequence. Earlier edits made before history tracking are unavailable; a baseline captures only the surviving record when it is first changed. There are no accounts or verified editor identities. These are research changes, not historical financial data or recommendations.</p>
    <div className="export-actions"><button className="secondary" type="button" disabled={exporting} onClick={downloadHistory}>{exporting ? 'Downloading research history…' : `Download all ${ticker} research revisions CSV`}</button><span className="muted small">All recorded revisions from storage at download time, oldest record first, including removals and legacy baselines. Loaded pages and comparison selections do not limit the file. Drafts are excluded. Catalog company and sector labels describe the current catalog.</span></div>
    {exportError && <p className="notice error" role="alert">{exportError}</p>}
    {candidate && <section className="revision-restore" aria-labelledby="revision-restore-heading"><h4 id="revision-restore-heading">Prepare record {candidate.id} as an editor draft</h4>
      <p className="muted small">{revisionAction(candidate)} · Historical version {candidate.entry.version} · Source entry ID: {candidate.entry.entryId}</p>
      <p className="notice warning">{hasDraft ? 'This replaces your current unsaved editor draft.' : 'This copies historical fields into the editor.'} Nothing is saved until you choose Save watchlist entry. Current conflict checks still apply; if there is no active entry, saving creates a new entry ID. Revisit old review dates, archived status, and manual checklist marks before saving.</p>
      <p className="muted small">{candidate.entry.status} · Review date: {candidate.entry.reviewDate || 'Not set'}</p><h4>Investment thesis</h4><p className="summary-notes">{candidate.entry.thesis || 'No thesis recorded.'}</p><h4>Risks and evidence to check</h4><p className="summary-notes">{candidate.entry.risks || 'No risks recorded.'}</p>
      <ul className="summary-checklist">{researchChecks.map(check => <li key={check.id}>{check.label}: {candidate.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed'}</li>)}</ul>
      <div className="model-actions"><button className="primary" type="button" disabled={!editorReady || busy} onClick={() => { onRestore(candidate); setCandidate(null); }}>Replace editor draft with record {candidate.id}</button><button className="secondary" type="button" onClick={() => setCandidate(null)}>Cancel draft replacement</button></div>
    </section>}
    {busy && <p role="status">Loading research history…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {loaded && !items.length && <p className="muted">No recorded revisions for {ticker}. Existing legacy notes appear as a baseline when next saved or removed.</p>}
    {loaded && items.length > 0 && <><p className="muted small">Select any two loaded records to compare their saved fields. Load older pages to reach earlier research.</p>{selected.length > 0 && <button className="secondary" type="button" onClick={() => setSelected([])}>Clear revision comparison</button>}{selected.length === 1 && <p className="muted small">Select one more revision to compare.</p>}</>}
    {selected.length === 2 && <ResearchRevisionComparison key={selected.slice().sort((a, b) => a - b).join(':')} revisions={items.filter(item => selected.includes(item.id))} />}
    <div className="research-history-items">{items.map(item => <article key={item.id}><label className="revision-selection"><input type="checkbox" checked={selected.includes(item.id)} disabled={busy || (selected.length === 2 && !selected.includes(item.id))} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />Compare record {item.id} · {revisionAction(item)} · Version {item.entry.version}</label><details><summary>{revisionAction(item)} · Version {item.entry.version} · {new Date(item.recordedAt).toLocaleString()}</summary>
      <p className="muted small">Entry ID: {item.entry.entryId}<br />Record last saved: {new Date(item.entry.updatedAt).toLocaleString()} · {item.entry.status} · Review date: {item.entry.reviewDate || 'Not set'}</p>
      <h4>Investment thesis</h4><p className="summary-notes">{item.entry.thesis || 'No thesis recorded.'}</p>
      <h4>Risks and evidence to check</h4><p className="summary-notes">{item.entry.risks || 'No risks recorded.'}</p>
      <p className="muted small">{reviewedCount(item.entry.checks)} of {researchChecks.length} checks marked reviewed · self-reported</p>
      <ul className="summary-checklist">{researchChecks.map(check => <li key={check.id}>{check.label}: {item.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed'}</li>)}</ul>
      <button className="secondary" type="button" disabled={!editorReady || busy} onClick={() => setCandidate(item)}>Prepare draft from record {item.id}</button>
    </details></article>)}</div>
    {loaded && before !== null && <button type="button" className="secondary" disabled={busy} onClick={() => load(true)}>Load older research revisions</button>}
  </section>;
}
