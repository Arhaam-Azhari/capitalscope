import PortfolioStressResult from './PortfolioStressResult';
import type { StressResult } from './PortfolioStressResult';
import SavedPortfolioStress from './SavedPortfolioStress';
import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import type { PortfolioMarks } from './types';

export default function PortfolioStressPanel({ marks }: { marks: PortfolioMarks }) {
  const [loadNotice, setLoadNotice] = useState('');
  const [shock, setShock] = useState('-20');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<StressResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  function clear() { setLoadNotice(''); pending.current?.abort(); setBusy(false); setResult(null); setError(''); }
  async function run(event: React.FormEvent) {
    event.preventDefault(); clear();
    const controller = new AbortController(); pending.current = controller; setBusy(true);
    const sectorShocks = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value.trim() !== '').map(([sector, value]) => [sector, (Number(value) / 100).toFixed(4)]));
    try {
      const data = await request<StressResult>(`/api/portfolios/${marks.portfolioId}/stress`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ defaultShock: (Number(shock) / 100).toFixed(4), sectorShocks }) });
      if (!controller.signal.aborted) setResult(data);
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="portfolio-stress" aria-labelledby="stress-heading">
    <div className="panel-title"><div><span className="eyebrow">WHAT IF / PRICE CHANGES</span><h3 id="stress-heading">Portfolio stress test</h3></div><span className="pill">Hypothetical</span></div>
    <p className="muted small">Apply a price change to current holdings at stored daily closes. Cash stays fixed. Sector overrides replace the default; leave a sector blank to inherit it. These are your assumptions, with no forecast probability or historical scenario implied.</p>
    <form onSubmit={run}><div className="stress-inputs"><label>Default price change (%)<input type="number" min="-100" max="100" step="0.01" required value={shock} onChange={e => { clear(); setShock(e.target.value); }} /></label>
      {marks.allocation.sectors.map(sector => <label key={sector.label}>{sector.label} override (%)<input type="number" min="-100" max="100" step="0.01" placeholder="Use default" value={overrides[sector.label] || ''} onChange={e => { clear(); setOverrides(current => ({ ...current, [sector.label]: e.target.value })); }} /></label>)}</div>
      <button className="primary" type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Run stress test'}</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {result && <PortfolioStressResult result={result} />}
    {loadNotice && <p className="notice warning" role="status">{loadNotice}</p>}
    <SavedPortfolioStress portfolioId={marks.portfolioId} result={result} onLoad={assumptions => {
      clear(); setShock((assumptions.defaultShock * 100).toFixed(2));
      const held = new Set(marks.allocation.sectors.map(sector => sector.label));
      const omitted = Object.keys(assumptions.sectorShocks).filter(sector => !held.has(sector));
      setOverrides(Object.fromEntries(Object.entries(assumptions.sectorShocks).filter(([sector]) => held.has(sector)).map(([sector, value]) => [sector, (value * 100).toFixed(2)])));
      setLoadNotice(`Saved assumptions loaded. Run the test to use current holdings and stored prices.${omitted.length ? ` Overrides for sectors no longer held were omitted: ${omitted.join(', ')}.` : ''}`);
    }} />
  </section>;
}
