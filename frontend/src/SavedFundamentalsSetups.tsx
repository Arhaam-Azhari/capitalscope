import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import { peerMeasures, type PeerMeasure } from './peerMeasures';
import type { Company } from './types';

type Setup = { id: string; name: string; tickers: string[]; measure: string; createdAt: string; modelVersion: string };
export default function SavedFundamentalsSetups({ companies, tickers, measure, onLoad }: { companies: Company[]; tickers: string[] | null; measure: PeerMeasure; onLoad: (tickers: string[], measure: PeerMeasure) => void }) {
  const path = '/api/research/comparison-setups';
  const [items, setItems] = useState<Setup[]>([]);
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setItems([]); setError('');
    request<Setup[]>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setItems(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => mutation.current?.abort(), []);
  function validPeers(peers: string[] | null) {
    return peers !== null && peers.length >= 2 && peers.length <= 4 && new Set(peers).size === peers.length && peers.every(ticker => companies.some(company => company.ticker === ticker));
  }
  function compatible(item: Setup) {
    return item.modelVersion === 'fundamentals-comparison-v1' && validPeers(item.tickers) && Object.prototype.hasOwnProperty.call(peerMeasures, item.measure);
  }
  async function save() {
    if (!validPeers(tickers)) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const item = await request<Setup>(path, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), tickers, measure }) });
      if (!controller.signal.aborted) { setItems(current => [item, ...current]); setName(''); setNotice(`Saved ${item.name}.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(item: Setup) {
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${path}/${encodeURIComponent(item.id)}`, { method: 'DELETE', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('This company comparison setup could not be deleted.');
      if (!controller.signal.aborted) { setItems(current => current.filter(saved => saved.id !== item.id)); setNotice(`Deleted ${item.name}.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="saved-scenarios" aria-label="Saved company comparison setups">
    <h3>Saved company comparison setups</h3>
    <p className="muted small">Save a real-company peer group and chart measure in this shared database. Anyone with workspace access can view or delete setups. They contain selections only; loading requests current reports and does not restore historical figures.</p>
    <div className="scenario-save"><label>Company comparison setup name<input maxLength={80} disabled={busy} value={name} onChange={event => setName(event.target.value)} placeholder="My semiconductor peers" /></label><button type="button" className="primary" disabled={loading || busy || !validPeers(tickers) || !name.trim()} onClick={save}>Save company comparison setup</button></div>
    {!validPeers(tickers) && <p className="muted small">Choose two to four real catalog companies to save a setup. Fictional peers remain separate.</p>}
    <div className="export-actions"><button type="button" className="secondary" disabled={loading || busy} onClick={() => { setNotice(''); setAttempt(value => value + 1); }}>Refresh company comparison setups</button></div>
    {loading ? <p role="status">Loading saved company comparisons…</p> : !items.length ? <p className="muted small">No saved company comparison setups.</p> : <ul className="scenario-list">{items.map(item => <li key={item.id}><div><strong>{item.name}</strong><span className="muted small">{item.tickers.join(' / ')} · {Object.prototype.hasOwnProperty.call(peerMeasures, item.measure) ? peerMeasures[item.measure as PeerMeasure] : 'Unsupported measure'} · Saved {new Date(item.createdAt).toLocaleString()}</span></div>
      {!compatible(item) && <p className="notice warning">This setup contains an unavailable company, measure, or version.</p>}
      <button type="button" className="secondary" disabled={busy || !compatible(item)} onClick={() => { if (compatible(item)) { onLoad(item.tickers, item.measure as PeerMeasure); setNotice(`Opened ${item.name}; current reports requested.`); } }}>Open company setup {item.name}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => remove(item)}>Delete company setup {item.name}</button>
    </li>)}</ul>}
    {notice && <p role="status" className="save-status">{notice}</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
  </section>;
}
