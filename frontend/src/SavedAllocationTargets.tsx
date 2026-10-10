import SavedAllocationComparison from './SavedAllocationComparison';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from './api';
import { savedAllocationInputs, type SavedAllocationTarget } from './savedAllocationTargets';
import type { Company, PortfolioMarks } from './types';

export default function SavedAllocationTargets({ marks, companies, targets, calculated, onLoad }: {
  marks: PortfolioMarks; companies: Company[]; targets: string[]; calculated: boolean; onLoad: (targets: string[]) => void;
}) {
  const [items, setItems] = useState<SavedAllocationTarget[]>([]);
  const [compared, setCompared] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const path = `/api/portfolios/${marks.portfolioId}/allocation-targets`;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setItems([]); setCompared([]);
    request<SavedAllocationTarget[]>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); pending.current?.abort(); };
  }, [path, attempt]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || loading || !calculated) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(''); setNotice('');
    const assets = ['Cash', ...marks.holdings.map(holding => holding.ticker)];
    try {
      const saved = await request<SavedAllocationTarget>(path, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, targets: Object.fromEntries(assets.map((asset, i) => [asset, Number(targets[i])])) }) });
      if (!controller.signal.aborted) { setItems(current => [saved, ...current]); setName(''); setNotice(`Saved targets: ${saved.name}. No trades were changed.`); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(id: string) {
    if (busy) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${path}/${id}`, { method: 'DELETE', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('Could not delete these saved targets.');
      if (!controller.signal.aborted) { setItems(current => current.filter(item => item.id !== id)); setCompared(current => current.filter(value => value !== id)); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section aria-labelledby="saved-allocation-heading">
    <h4 id="saved-allocation-heading">Saved allocation targets</h4>
    <p className="muted small">Save a named percentage mix after calculating. Loading replaces the inputs and clears calculated results; calculate again against the current stored valuation. Saves contain percentages only, without prices, share-basis checks, or shock assumptions. A changed holding set blocks loading. This shared workspace has no accounts, so anyone with access can view or delete saved targets.</p>
    <form className="scenario-save" onSubmit={save}><label>Allocation target name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="My cash reserve mix" /></label><button className="secondary" disabled={busy || loading || !calculated || !name.trim()}>Save allocation targets</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <button className="text-button" disabled={busy || loading} onClick={() => setAttempt(value => value + 1)}>Refresh saved targets</button>
    {loading ? <p role="status">Loading saved allocation targets…</p> : !items.length ? <p className="muted small">No saved allocation targets for this portfolio.</p> : <ul className="scenario-list">{items.map(item => {
      let inputs: string[] | null = null, reason = '';
      try { inputs = savedAllocationInputs(marks, item); } catch (e) { reason = (e as Error).message; }
      return <li key={item.id}><label className="scenario-pick"><input type="checkbox" checked={compared.includes(item.id)} disabled={busy || !inputs || (!compared.includes(item.id) && compared.length >= 4)} onChange={event => setCompared(current => event.target.checked ? [...current, item.id].slice(0, 4) : current.filter(id => id !== item.id))} />Compare targets {item.name}</label><div><strong>{item.name}</strong><span className="muted small">Saved {new Date(item.createdAt).toLocaleString()} · {Object.entries(item.targets).map(([asset, value]) => `${asset} ${value}%`).join(' · ')}</span>{reason && <span className="muted small">{reason}</span>}</div>
        <button className="secondary" disabled={busy || !inputs} onClick={() => { if (inputs) { onLoad(inputs); setNotice(`Loaded targets: ${item.name}. Review the inputs, then calculate again.`); setError(''); } }}>Load targets from {item.name}</button>
        <button className="secondary" disabled={busy} onClick={() => remove(item.id)}>Delete targets {item.name}</button></li>;
    })}</ul>}
    {!loading && <SavedAllocationComparison marks={marks} companies={companies} selected={compared.map(id => items.find(item => item.id === id)).filter((item): item is SavedAllocationTarget => !!item)} />}
  </section>;
}
