import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import type { Company } from './types';

export type PriceComparisonSetup = { id: string; currentTicker: string; referenceTicker: string; name: string; startDate: string; endDate: string; createdAt: string; modelVersion: string };

export default function SavedPriceComparisonSetups({ currentTicker, referenceTicker, startDate, endDate, calculated, companies, onLoad }: { currentTicker: string; referenceTicker: string; startDate: string; endDate: string; calculated: boolean; companies: Company[]; onLoad: (setup: PriceComparisonSetup) => void }) {
  const [items, setItems] = useState<PriceComparisonSetup[]>([]);
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  const path = `/api/companies/${encodeURIComponent(currentTicker)}/price-comparison-setups`;
  useEffect(() => {
    const controller = new AbortController(); setItems([]); setLoading(true); setError('');
    request<PriceComparisonSetup[]>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setItems(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, attempt]);
  useEffect(() => () => mutation.current?.abort(), []);
  function compatible(item: PriceComparisonSetup) { return item.currentTicker === currentTicker && item.modelVersion === 'price-comparison-setup-v1' && item.referenceTicker !== currentTicker && companies.some(company => company.ticker === item.referenceTicker); }
  async function save() {
    if (!calculated) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const item = await request<PriceComparisonSetup>(path, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), referenceTicker, startDate, endDate }) });
      if (!controller.signal.aborted) { setItems(current => [item, ...current]); setName(''); setNotice(`Saved ${item.name}.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(item: PriceComparisonSetup) {
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${path}/${encodeURIComponent(item.id)}`, { method: 'DELETE', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('This comparison setup could not be deleted.');
      if (!controller.signal.aborted) { setItems(current => current.filter(saved => saved.id !== item.id)); setNotice(`Deleted ${item.name}.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="saved-scenarios" aria-labelledby="saved-price-setups-heading">
    <h4 id="saved-price-setups-heading">Saved price comparison setups</h4>
    <p className="muted small">Save the current pair and dates after a successful calculation. Setups live in this shared database; anyone with workspace access can view or delete them. They contain no prices or results. Loading fills inputs and clears the previous analysis; use Load price comparison to read the reference snapshot and calculate again. Old windows may no longer overlap the stored history.</p>
    <div className="scenario-save"><label>Price comparison setup name<input maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label></div>
    <div className="export-actions"><button className="secondary" disabled={loading || busy || !calculated || !name.trim()} onClick={save}>Save price comparison setup</button><button className="secondary" disabled={busy || loading} onClick={() => { setNotice(''); setAttempt(n => n + 1); }}>Refresh saved price setups</button></div>
    {loading ? <p role="status">Loading saved comparison setups…</p> : items.length === 0 ? <p className="muted small">No saved price comparison setups.</p> : <ul className="scenario-list">{items.map(item => <li key={item.id}><div><strong>{item.name}</strong><p className="muted small">{item.currentTicker} / {item.referenceTicker} · {item.startDate} through {item.endDate} · Saved {new Date(item.createdAt).toLocaleString()}</p></div>
      {!compatible(item) && <p className="notice warning">This setup uses an unavailable company or unsupported model version.</p>}
      <button className="secondary" disabled={busy || !compatible(item)} onClick={() => { onLoad(item); setNotice(`Loaded ${item.name}; calculate the comparison again.`); }}>Load setup {item.name}</button>
      <button className="secondary" disabled={busy} onClick={() => remove(item)}>Delete setup {item.name}</button>
    </li>)}</ul>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
  </section>;
}
