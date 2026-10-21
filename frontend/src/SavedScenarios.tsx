import { savedScenarioCsv } from './savedScenarioCsv';
import ValuationPriceContext from './ValuationPriceContext';
import ScenarioComparison from './ScenarioComparison';
import { useEffect, useMemo, useState } from 'react';
import { money, request } from './api';
import type { Assumptions, Scenario } from './types';

export default function SavedScenarios({ ticker, assumptions, onLoad }: {
  ticker: string; assumptions: Assumptions | null; onLoad: (scenario: Scenario) => void;
}) {
  const [compared, setCompared] = useState<string[]>([]);
  const [items, setItems] = useState<Scenario[]>([]);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('newest');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [name, setName] = useState('');
  const [exportError, setExportError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const path = `/api/companies/${ticker}/scenarios`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setReady(false); setError(''); setExportError('');
    request<Scenario[]>(path, { signal: controller.signal }).then(data => {
      if (data.some(item => item.ticker !== ticker)) throw new Error('The saved cases do not match this company. Reload to try again.');
      if (!controller.signal.aborted) {
        setItems(data); setReady(true);
        setCompared(current => current.filter(id => data.some(item => item.id === id)));
      }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, ticker, attempt]);

  function toggleComparison(id: string, checked: boolean) {
    setCompared(current => {
      if (!checked) return current.filter(value => value !== id);
      return current.length < 4 && !current.includes(id) ? [...current, id] : current;
    });
  }

  const ordered = useMemo(() => [...items].sort((left, right) => {
    if (order === 'name') return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    const time = (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0);
    return (order === 'oldest' ? time : -time) || left.id.localeCompare(right.id);
  }), [items, order]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return ordered.filter(item => (!selectedOnly || compared.includes(item.id)) &&
      `${item.name} ${item.id} ${item.modelVersion}`.toLowerCase().includes(search));
  }, [ordered, compared, query, selectedOnly]);

  function download(shownOnly: boolean) {
    if (!ready || loading || busy) return;
    setExportError('');
    try {
      const url = URL.createObjectURL(new Blob([savedScenarioCsv(shownOnly ? visible : ordered, new Date().toISOString())], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${ticker}-${shownOnly ? 'shown' : 'all'}-saved-valuation-cases.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('The saved-case CSV could not be prepared. Please try again.'); }
  }

  async function save() {
    if (!assumptions || !ready || loading || busy) return;
    setBusy(true); setError('');
    try {
      const saved = await request<Scenario>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, assumptions }) });
      setItems(current => [saved, ...current]); setName('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this scenario.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!ready || loading || busy) return;
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
    <div className="panel-title"><h3>Saved scenarios</h3><button type="button" className="secondary" disabled={busy || loading} onClick={() => setAttempt(value => value + 1)}>Reload saved scenarios</button></div>
    <p className="muted small">Saved in this app’s database. Each save keeps a separate version. {ticker === 'DEMO' ? 'These scenarios belong to the fictional example company.' : 'Inputs are your assumptions.'}</p>
    <p className="muted small">This is a shared workspace without accounts; anyone with access to this app can view or delete saved scenarios.</p>
    <div className="scenario-save"><label>Scenario name<input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="My base case" /></label>
      <button type="button" className="primary" disabled={busy || loading || !ready || !assumptions || !name.trim()} onClick={save}>Save scenario</button></div>
    <p className="muted small">Reloading reads the latest saved cases without changing your open model, scenario-name draft, or list filters. Cases removed from the workspace leave the comparison selection after a successful reload.</p>
    {!assumptions && <p className="muted small">Calculate a valuation before saving.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {ready && !loading && items.length > 0 && <div className="saved-case-review">
      <div className="comparison-controls"><label>Search saved valuation cases<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Case name, ID, or model version" /></label>
        <label>Sort saved valuation cases<select value={order} onChange={event => setOrder(event.target.value)}><option value="newest">Newest saved first</option><option value="oldest">Oldest saved first</option><option value="name">Case name</option></select></label>
        <label className="scenario-pick"><input type="checkbox" checked={selectedOnly} onChange={event => setSelectedOnly(event.target.checked)} />Show selected cases only</label>
        {(query || selectedOnly || order !== 'newest') && <button type="button" className="secondary" onClick={() => { setQuery(''); setOrder('newest'); setSelectedOnly(false); }}>Reset case filters</button>}
      </div>
      <p className="muted small" aria-live="polite">{visible.length} of {items.length} saved cases shown · {compared.length} selected for comparison</p>
      <p className="muted small">Filtering changes this list only. Selected comparisons and price evidence remain available below.</p>
      <div className="export-actions"><button type="button" className="secondary" disabled={busy || !ordered.length} onClick={() => download(false)}>Download all saved cases CSV</button><button type="button" className="secondary" disabled={busy || !visible.length} onClick={() => download(true)}>Download shown cases CSV</button></div>
      <p className="muted small">Both CSVs follow the current sort order and contain saved inputs and estimates. Rates are decimal fractions; currency columns are USD. Exporting does not save or change the open model.</p>
      {!visible.length && <p>No saved cases match these filters.</p>}
    </div>}
    {exportError && <p role="alert" className="notice error">{exportError}</p>}
    {loading ? <p role="status">Loading saved scenarios…</p> : !ready ? <p className="notice warning">The saved-case list is unavailable. Reload saved scenarios to try again. Saving is paused until the list loads.</p> : !items.length ? <p className="muted">No saved scenarios for this company.</p> :
      <ul className="scenario-list">{visible.map(item => <li key={item.id}><label className="scenario-pick"><input type="checkbox" checked={compared.includes(item.id)} disabled={busy || (!compared.includes(item.id) && compared.length >= 4)} onChange={event => toggleComparison(item.id, event.target.checked)} />Compare {item.name}</label><div><strong>{item.name}</strong><span className="muted small">{new Date(item.createdAt).toLocaleString()} · {item.modelVersion} · {money(item.result.valuePerShare, false)} / share</span></div>
        <button type="button" disabled={busy} onClick={() => onLoad(item)}>Load {item.name}</button>
        <button type="button" disabled={busy} onClick={() => remove(item.id)}>Delete {item.name}</button></li>)}</ul>}
    {ready && !loading && items.length > 0 && <ValuationPriceContext key={ticker} ticker={ticker} scenarios={items} />}
    {ready && !loading && <ScenarioComparison selected={compared.map(id => items.find(item => item.id === id)).filter((item): item is Scenario => !!item && item.ticker === ticker)} />}
  </section>;
}
