import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import type { PeerMeasure } from './peerMeasures';
import type { Company } from './types';
import { fundamentalsSetupCompatible, fundamentalsSetupsCsv, searchFundamentalsSetups, setupMeasureLabel, type FundamentalsSetup as Setup } from './fundamentalsSetupReview';
export default function SavedFundamentalsSetups({ companies, tickers, measure, onLoad }: { companies: Company[]; tickers: string[] | null; measure: PeerMeasure; onLoad: (tickers: string[], measure: PeerMeasure) => void }) {
  const path = '/api/research/comparison-setups';
  const [search, setSearch] = useState(''); const [updatedAt, setUpdatedAt] = useState('');
  const [items, setItems] = useState<Setup[]>([]);
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setItems([]); setUpdatedAt(''); setError('');
    request<Setup[]>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setItems(data); setUpdatedAt(new Date().toISOString()); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => mutation.current?.abort(), []);
  function validPeers(peers: string[] | null) {
    return peers !== null && peers.length >= 2 && peers.length <= 4 && new Set(peers).size === peers.length && peers.every(ticker => companies.some(company => company.ticker === ticker));
  }
  function compatible(item: Setup) {
    return fundamentalsSetupCompatible(item, companies);
  }
  const visible = searchFundamentalsSetups(items, search, companies);
  function download() {
    try {
      const csv = fundamentalsSetupsCsv(items, companies, updatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'saved-company-comparison-setups.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError('');
    } catch { setError('The saved company setup CSV could not be prepared. Please try again.'); }
  }
  async function save() {
    if (!validPeers(tickers)) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const item = await request<Setup>(path, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), tickers, measure }) });
      if (!controller.signal.aborted) { setItems(current => [item, ...current]); setUpdatedAt(new Date().toISOString()); setName(''); setNotice(`Saved ${item.name}.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(item: Setup) {
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${path}/${encodeURIComponent(item.id)}`, { method: 'DELETE', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('This company comparison setup could not be deleted.');
      if (!controller.signal.aborted) { setItems(current => current.filter(saved => saved.id !== item.id)); setUpdatedAt(new Date().toISOString()); setNotice(`Deleted ${item.name}.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="saved-scenarios" aria-label="Saved company comparison setups">
    <h3>Saved company comparison setups</h3>
    <p className="muted small">Save a real-company peer group and chart measure in this shared database. Anyone with workspace access can view or delete setups. They contain selections only; loading requests current reports and does not restore historical figures.</p>
    <div className="scenario-save"><label>Company comparison setup name<input maxLength={80} disabled={busy} value={name} onChange={event => setName(event.target.value)} placeholder="My semiconductor peers" /></label><button type="button" className="primary" disabled={loading || busy || !validPeers(tickers) || !name.trim()} onClick={save}>Save company comparison setup</button></div>
    {!validPeers(tickers) && <p className="muted small">Choose two to four real catalog companies to save a setup. Fictional peers remain separate.</p>}
    <div className="export-actions"><button type="button" className="secondary" disabled={loading || busy} onClick={() => { setNotice(''); setAttempt(value => value + 1); }}>Refresh company comparison setups</button></div>
    {!loading && items.length > 0 && <>
      <div className="scenario-save"><label>Search saved company setups<input type="search" placeholder="Name, company, ticker, or measure" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      <p className="muted small" role="status">Showing {visible.length} of {items.length} loaded setups.{!visible.length && ' No saved setups match this search.'}</p>
      <div className="export-actions"><button type="button" className="secondary" disabled={busy} onClick={download}>Download all saved company setups CSV</button><p className="muted small">Exports all loaded setups, including those hidden by search or unavailable to open. Includes ordered peers, measure, saved date, version, and this list's update time. No financial figures or results.</p></div>
    </>}
    {loading ? <p role="status">Loading saved company comparisons…</p> : !items.length ? <p className="muted small">No saved company comparison setups.</p> : <ul className="scenario-list">{visible.map(item => <li key={item.id}><div><strong>{item.name}</strong><span className="muted small">{item.tickers.join(' / ')} · {setupMeasureLabel(item.measure)} · Saved {new Date(item.createdAt).toLocaleString()}</span></div>
      {!compatible(item) && <p className="notice warning">This setup contains an unavailable company, measure, or version.</p>}
      <button type="button" className="secondary" disabled={busy || !compatible(item)} onClick={() => { if (compatible(item)) { onLoad(item.tickers, item.measure as PeerMeasure); setNotice(`Opened ${item.name}; current reports requested.`); } }}>Open company setup {item.name}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => remove(item)}>Delete company setup {item.name}</button>
    </li>)}</ul>}
    {notice && <p role="status" className="save-status">{notice}</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
  </section>;
}
