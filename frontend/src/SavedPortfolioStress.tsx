import StressScenarioComparison from './StressScenarioComparison';
import { useEffect, useMemo, useRef, useState } from 'react';
import { money, request } from './api';
import PortfolioStressResult from './PortfolioStressResult';
import type { StressResult } from './PortfolioStressResult';

export type SavedStress = { id: string; portfolioId: string; name: string; createdAt: string; modelVersion: string; result: StressResult };
export default function SavedPortfolioStress({ portfolioId, result, onLoad }: {
  portfolioId: string; result: StressResult | null; onLoad: (assumptions: StressResult['assumptions']) => void;
}) {
  const [compared, setCompared] = useState<string[]>([]);
  const [items, setItems] = useState<SavedStress[]>([]);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('newest');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const path = `/api/portfolios/${portfolioId}/stress-scenarios`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setReady(false); setError('');
    request<SavedStress[]>(path, { signal: controller.signal })
      .then(data => {
        if (data.some(item => item.portfolioId !== portfolioId || item.result.baseline.portfolioId !== portfolioId))
          throw new Error('The saved stress scenarios do not match this portfolio. Reload to try again.');
        if (!controller.signal.aborted) {
          setItems(data); setReady(true);
          setCompared(current => current.filter(id => data.some(item => item.id === id)));
          setSelected(current => data.some(item => item.id === current) ? current : null);
        }
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); mutation.current?.abort(); };
  }, [path, portfolioId, attempt]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!result || busy || loading || !ready) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError('');
    try {
      const saved = await request<SavedStress>(path, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, assumptions: result.assumptions }) });
      if (saved.portfolioId !== portfolioId || saved.result.baseline.portfolioId !== portfolioId)
        throw new Error('The saved stress scenario does not match this portfolio. Reload to check the saved list.');
      if (!controller.signal.aborted) { setItems(current => [saved, ...current]); setName(''); setSelected(saved.id); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(id: string) {
    if (busy || loading || !ready) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError('');
    try {
      const response = await fetch(`${path}/${id}`, { method: 'DELETE', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('Could not delete this stress scenario.');
      if (!controller.signal.aborted) { setItems(current => current.filter(item => item.id !== id)); setSelected(current => current === id ? null : current); setCompared(current => current.filter(value => value !== id)); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function toggleComparison(id: string, checked: boolean) {
    setCompared(current => {
      if (!checked) return current.filter(value => value !== id);
      return current.length < 4 && !current.includes(id) ? [...current, id] : current;
    });
  }
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    // I sort a copy so reviewing the list never changes saved snapshot evidence.
    return items.filter(item => (!selectedOnly || compared.includes(item.id)) &&
      `${item.name} ${item.id} ${item.modelVersion} ${item.result.holdings.map(row => `${row.baseline.ticker} ${row.sector}`).join(' ')}`.toLowerCase().includes(search))
      .sort((left, right) => {
        if (order === 'name') return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
        const time = (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0);
        return (order === 'oldest' ? time : -time) || left.id.localeCompare(right.id);
      });
  }, [items, compared, query, order, selectedOnly]);
  const snapshot = ready && !loading ? items.find(item => item.id === selected && item.portfolioId === portfolioId) : undefined;
  return <section className="saved-stress" aria-label="Saved portfolio stress scenarios">
    <div className="panel-title"><h3>Saved stress scenarios</h3><button type="button" className="secondary" disabled={busy || loading} onClick={() => setAttempt(value => value + 1)}>Reload saved stress scenarios</button></div>
    <p className="muted small">Download a saved scenario as CSV to inspect its assumptions, portfolio totals, holding-level changes, and original price evidence. Decimal rates use fractions (−0.20 means −20%); missing values stay blank. The export uses the saved snapshot, not current holdings.</p>
    <p className="muted small">Each save creates a separate database snapshot. Saving recalculates the last run's assumptions against the current ledger and stored closes; its baseline may differ from the preview. This shared workspace has no accounts, so anyone with access can view or delete saved scenarios.</p>
    <form className="scenario-save" onSubmit={save}><label>Stress scenario name<input value={name} maxLength={80} required onChange={e => setName(e.target.value)} placeholder="My technology downside" /></label><button className="primary" type="submit" disabled={busy || loading || !ready || !result || !name.trim()}>Save stress scenario</button></form>
    <p className="muted small">Reloading reads saved scenarios without changing the current stress preview, price assumptions, or scenario-name draft. Removed cases leave the comparison and snapshot after a successful reload.</p>
    {!result && <p className="muted small">Run a stress test before saving. Editing price assumptions clears the preview.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {ready && !loading && items.length > 0 && <div className="saved-stress-review">
      <div className="comparison-controls"><label>Search saved stress scenarios<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, ID, model, ticker, or sector" /></label>
        <label>Sort saved stress scenarios<select value={order} onChange={event => setOrder(event.target.value)}><option value="newest">Newest saved first</option><option value="oldest">Oldest saved first</option><option value="name">Scenario name</option></select></label>
        <label className="scenario-pick"><input type="checkbox" checked={selectedOnly} onChange={event => setSelectedOnly(event.target.checked)} />Show selected stress scenarios only</label>
        {(query || selectedOnly || order !== 'newest') && <button type="button" className="secondary" onClick={() => { setQuery(''); setOrder('newest'); setSelectedOnly(false); }}>Reset stress list filters</button>}
        {compared.length > 0 && <button type="button" className="secondary" disabled={busy} onClick={() => setCompared([])}>Clear stress comparison</button>}
      </div>
      <p className="muted small" aria-live="polite">{visible.length} of {items.length} saved stress scenarios shown · {compared.length} selected for comparison</p>
      <p className="muted small">Filters affect this list only. Selected comparisons and the open saved snapshot remain below, including cases hidden from this list. Each CSV keeps its complete original snapshot.</p>
      {!visible.length && <p>No saved stress scenarios match these filters.</p>}
    </div>}
    {loading ? <p role="status">Loading saved stress scenarios…</p> : !ready ? <p className="notice warning">The saved stress list is unavailable. Reload saved stress scenarios to try again. Saving is paused until the list loads.</p> : !items.length ? <p className="muted">No saved stress scenarios for this portfolio.</p> : <ul className="scenario-list">{visible.map(item => <li key={item.id}><label className="scenario-pick"><input type="checkbox" checked={compared.includes(item.id)} disabled={busy || (!compared.includes(item.id) && compared.length >= 4)} onChange={event => toggleComparison(item.id, event.target.checked)} />Compare {item.name}</label><div><strong>{item.name}</strong><span className="muted small">{new Date(item.createdAt).toLocaleString()} · {item.modelVersion} · {item.result.stressedTotalValue === null ? 'Full value unavailable' : money(item.result.stressedTotalValue, false)}</span></div><button className="secondary" type="button" onClick={() => setSelected(item.id)}>Review {item.name}</button><a className="secondary" href={`${path}/${item.id}/export.csv`} download="portfolio-stress-scenario.csv" aria-label={`Download CSV for ${item.name}`}>Download CSV</a><button className="secondary" type="button" disabled={busy || item.modelVersion !== 'price-shock-v1'} onClick={() => onLoad(item.result.assumptions)}>Load assumptions from {item.name}</button><button className="secondary" type="button" disabled={busy} onClick={() => remove(item.id)}>Delete {item.name}</button></li>)}</ul>}
    {ready && !loading && <StressScenarioComparison selected={compared.map(id => items.find(item => item.id === id)).filter((item): item is SavedStress => !!item && item.portfolioId === portfolioId)} />}
    {snapshot && <section className="saved-stress-snapshot" aria-label={`Saved snapshot ${snapshot.name}`}><div className="panel-title"><h4>{snapshot.name} · saved snapshot</h4><button className="secondary" type="button" onClick={() => setSelected(null)}>Close saved snapshot</button></div>
      <p className="muted small">Saved {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.modelVersion}. Default price change: {(snapshot.result.assumptions.defaultShock * 100).toFixed(2)}%. Sector overrides: {Object.entries(snapshot.result.assumptions.sectorShocks).map(([sector, shock]) => `${sector} ${(shock * 100).toFixed(2)}%`).join('; ') || 'None'}. Loading assumptions does not replay old holdings or change trades; run them again to evaluate the current portfolio.</p>
      <PortfolioStressResult result={snapshot.result} historical />
    </section>}
  </section>;
}
