import StressScenarioComparison from './StressScenarioComparison';
import { useEffect, useRef, useState } from 'react';
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
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const path = `/api/portfolios/${portfolioId}/stress-scenarios`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCompared([]); setItems([]); setSelected(null); setError('');
    request<SavedStress[]>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); mutation.current?.abort(); };
  }, [path]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!result || busy || loading) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError('');
    try {
      const saved = await request<SavedStress>(path, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, assumptions: result.assumptions }) });
      if (!controller.signal.aborted) { setItems(current => [saved, ...current]); setName(''); setSelected(saved.id); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(id: string) {
    if (busy) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError('');
    try {
      const response = await fetch(`${path}/${id}`, { method: 'DELETE', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('Could not delete this stress scenario.');
      if (!controller.signal.aborted) { setItems(current => current.filter(item => item.id !== id)); setSelected(current => current === id ? null : current); setCompared(current => current.filter(value => value !== id)); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const snapshot = items.find(item => item.id === selected);
  return <section className="saved-stress" aria-label="Saved portfolio stress scenarios">
    <h3>Saved stress scenarios</h3>
    <p className="muted small">Download a saved scenario as CSV to inspect its assumptions, portfolio totals, holding-level changes, and original price evidence. Decimal rates use fractions (−0.20 means −20%); missing values stay blank. The export uses the saved snapshot, not current holdings.</p>
    <p className="muted small">Each save creates a separate database snapshot. Saving recalculates the last run's assumptions against the current ledger and stored closes; its baseline may differ from the preview. This shared workspace has no accounts, so anyone with access can view or delete saved scenarios.</p>
    <form className="scenario-save" onSubmit={save}><label>Stress scenario name<input value={name} maxLength={80} required onChange={e => setName(e.target.value)} placeholder="My technology downside" /></label><button className="primary" type="submit" disabled={busy || loading || !result || !name.trim()}>Save stress scenario</button></form>
    {!result && <p className="muted small">Run a stress test before saving. Editing price assumptions clears the preview.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading saved stress scenarios…</p> : !items.length ? <p className="muted">No saved stress scenarios for this portfolio.</p> : <ul className="scenario-list">{items.map(item => <li key={item.id}><label className="scenario-pick"><input type="checkbox" checked={compared.includes(item.id)} disabled={!compared.includes(item.id) && compared.length >= 4} onChange={event => setCompared(current => event.target.checked ? [...current, item.id].slice(0, 4) : current.filter(id => id !== item.id))} />Compare {item.name}</label><div><strong>{item.name}</strong><span className="muted small">{new Date(item.createdAt).toLocaleString()} · {item.modelVersion} · {item.result.stressedTotalValue === null ? 'Full value unavailable' : money(item.result.stressedTotalValue, false)}</span></div><button className="secondary" type="button" onClick={() => setSelected(item.id)}>Review {item.name}</button><a className="secondary" href={`${path}/${item.id}/export.csv`} download="portfolio-stress-scenario.csv" aria-label={`Download CSV for ${item.name}`}>Download CSV</a><button className="secondary" type="button" disabled={busy || item.modelVersion !== 'price-shock-v1'} onClick={() => onLoad(item.result.assumptions)}>Load assumptions from {item.name}</button><button className="secondary" type="button" disabled={busy} onClick={() => remove(item.id)}>Delete {item.name}</button></li>)}</ul>}
    {!loading && <StressScenarioComparison selected={compared.map(id => items.find(item => item.id === id)).filter((item): item is SavedStress => !!item && item.portfolioId === portfolioId)} />}
    {snapshot && <section className="saved-stress-snapshot" aria-label={`Saved snapshot ${snapshot.name}`}><div className="panel-title"><h4>{snapshot.name} · saved snapshot</h4><button className="secondary" type="button" onClick={() => setSelected(null)}>Close saved snapshot</button></div>
      <p className="muted small">Saved {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.modelVersion}. Default price change: {(snapshot.result.assumptions.defaultShock * 100).toFixed(2)}%. Sector overrides: {Object.entries(snapshot.result.assumptions.sectorShocks).map(([sector, shock]) => `${sector} ${(shock * 100).toFixed(2)}%`).join('; ') || 'None'}. Loading assumptions does not replay old holdings or change trades; run them again to evaluate the current portfolio.</p>
      <PortfolioStressResult result={snapshot.result} historical />
    </section>}
  </section>;
}
