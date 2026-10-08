import ValuationPriceContext from './ValuationPriceContext';
import ScenarioComparison from './ScenarioComparison';
import { useEffect, useState } from 'react';
import { money, request } from './api';
import type { Assumptions, Scenario } from './types';

export default function SavedScenarios({ ticker, assumptions, onLoad }: {
  ticker: string; assumptions: Assumptions | null; onLoad: (scenario: Scenario) => void;
}) {
  const [compared, setCompared] = useState<string[]>([]);
  const [items, setItems] = useState<Scenario[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const path = `/api/companies/${ticker}/scenarios`;
  useEffect(() => {
    const controller = new AbortController();
    request<Scenario[]>(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setItems(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path]);

  function toggleComparison(id: string, checked: boolean) {
    setCompared(current => {
      if (!checked) return current.filter(value => value !== id);
      return current.length < 4 && !current.includes(id) ? [...current, id] : current;
    });
  }

  async function save() {
    if (!assumptions) return;
    setBusy(true); setError('');
    try {
      const saved = await request<Scenario>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, assumptions }) });
      setItems(current => [saved, ...current]); setName('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this scenario.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${path}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete this scenario.');
      setItems(current => current.filter(item => item.id !== id));
      setCompared(current => current.filter(value => value !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete this scenario.'); }
    finally { setBusy(false); }
  }
  return <section className="saved-scenarios" aria-label="Saved valuation scenarios">
    <h3>Saved scenarios</h3>
    <p className="muted small">Saved in this app’s database. Each save keeps a separate version. {ticker === 'DEMO' ? 'These scenarios belong to the fictional example company.' : 'Inputs are your assumptions.'}</p>
    <p className="muted small">This is a shared workspace without accounts; anyone with access to this app can view or delete saved scenarios.</p>
    <div className="scenario-save"><label>Scenario name<input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="My base case" /></label>
      <button type="button" className="primary" disabled={busy || !assumptions || !name.trim()} onClick={save}>Save scenario</button></div>
    {!assumptions && <p className="muted small">Calculate a valuation before saving.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {loading ? <p>Loading saved scenarios…</p> : !items.length ? <p className="muted">No saved scenarios for this company.</p> :
      <ul className="scenario-list">{items.map(item => <li key={item.id}><label className="scenario-pick"><input type="checkbox" checked={compared.includes(item.id)} disabled={busy || (!compared.includes(item.id) && compared.length >= 4)} onChange={event => toggleComparison(item.id, event.target.checked)} />Compare {item.name}</label><div><strong>{item.name}</strong><span className="muted small">{new Date(item.createdAt).toLocaleString()} · {item.modelVersion} · {money(item.result.valuePerShare, false)} / share</span></div>
        <button type="button" disabled={busy} onClick={() => onLoad(item)}>Load {item.name}</button>
        <button type="button" disabled={busy} onClick={() => remove(item.id)}>Delete {item.name}</button></li>)}</ul>}
    {!loading && items.length > 0 && <ValuationPriceContext key={ticker} ticker={ticker} scenarios={items} />}
    {!loading && <ScenarioComparison selected={compared.map(id => items.find(item => item.id === id)).filter((item): item is Scenario => !!item && item.ticker === ticker)} />}
  </section>;
}
