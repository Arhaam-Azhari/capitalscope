import { useEffect, useRef, useState } from 'react';
import { money, request } from './api';
import type { PortfolioMarks } from './types';

type StressResult = { baseline: PortfolioMarks; assumptions: { defaultShock: number; sectorShocks: Record<string, number> };
  holdings: { baseline: PortfolioMarks['holdings'][number]; sector: string; shock: number; stressedValue: number | null; change: number | null }[];
  stressedPricedHoldingsValue: number; stressedTotalValue: number | null; change: number | null; relativeChange: number | null };
const dollars = (value: number | null) => value === null ? 'Unavailable' : money(value, false);
export default function PortfolioStressPanel({ marks }: { marks: PortfolioMarks }) {
  const [shock, setShock] = useState('-20');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<StressResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  function clear() { pending.current?.abort(); setBusy(false); setResult(null); setError(''); }
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
    {result && <div aria-live="polite">
      <p className="notice warning">{result.baseline.dataMode === 'example' ? 'Invented example closes.' : 'Stored market closes.'} {result.baseline.pricedPositions} of {result.baseline.totalPositions} holdings priced. Baseline evaluated {new Date(result.baseline.evaluatedAt).toLocaleString()}. No trades or cash entries were changed.</p>
      {!result.baseline.complete && <p className="notice warning">Full portfolio totals and changes are unavailable. Subtotals exclude unpriced holdings.</p>}
      <div className="result-summary"><div><span>Baseline · cash + holdings</span><strong>{dollars(result.baseline.totalValue)}</strong></div><div><span>Stressed · cash + holdings</span><strong data-testid="stress-total">{dollars(result.stressedTotalValue)}</strong></div><div><span>Hypothetical value change</span><strong data-testid="stress-change">{dollars(result.change)}</strong></div><div><span>Change / baseline value</span><strong>{result.relativeChange === null ? 'Unavailable' : `${(result.relativeChange * 100).toFixed(2)}%`}</strong></div></div>
      <p className="muted small">Cash held fixed: {money(result.baseline.cash, false)}. Priced holdings subtotal: {money(result.baseline.pricedHoldingsValue, false)} → {money(result.stressedPricedHoldingsValue, false)}.</p>
      <div className="table-scroll"><table><caption>Hypothetical holding values and baseline evidence</caption><thead><tr><th>Holding / sector</th><th>Price change</th><th>Baseline value</th><th>Stressed value</th><th>Value change</th><th>Baseline evidence</th></tr></thead><tbody>{result.holdings.map(row => <tr key={row.baseline.ticker}><th scope="row">{row.baseline.ticker}<small className="comparison-evidence">{row.sector}</small></th><td>{(row.shock * 100).toFixed(2)}%</td><td>{dollars(row.baseline.value)}</td><td>{dollars(row.stressedValue)}</td><td>{dollars(row.change)}</td><td className="mark-evidence">{row.baseline.error || <>{row.baseline.priceDate} · {row.baseline.priceAgeDays} calendar days old<small className="comparison-evidence">{row.baseline.sourceUrl ? <a href={row.baseline.sourceUrl} target="_blank" rel="noreferrer">{row.baseline.source} ↗</a> : row.baseline.source}</small><small className="comparison-evidence">{row.baseline.retrievedAt ? `Imported ${new Date(row.baseline.retrievedAt).toLocaleString()}` : 'Fictional data · no market import'}</small></>}</td></tr>)}{!result.holdings.length && <tr><td colSpan={6}>Cash only. Price changes have no effect.</td></tr>}</tbody></table></div>
      <p className="muted small">I apply each shock once to the holding value, without changing share counts. This calculation excludes trading costs, taxes, liquidity, correlations, and currency changes. Each run reloads the current ledger and stored snapshots; it may use a newer baseline than the valuation above.</p>
    </div>}
  </section>;
}
