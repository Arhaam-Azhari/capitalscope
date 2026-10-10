import { useState, type FormEvent } from 'react';
import { compareSavedAllocationShocks, savedAllocationShockCsv } from './savedAllocationShocks';
import { allocationSectorPlan } from './portfolioRebalance';
import { savedAllocationInputs, type SavedAllocationTarget } from './savedAllocationTargets';
import { money } from './api';
import type { Company, PortfolioMarks } from './types';

export default function SavedAllocationShockComparison({ marks, companies, selected }: { marks: PortfolioMarks; companies: Company[]; selected: SavedAllocationTarget[] }) {
  const [shock, setShock] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [cases, setCases] = useState<ReturnType<typeof compareSavedAllocationShocks> | null>(null);
  const [calculatedAt, setCalculatedAt] = useState('');
  const [error, setError] = useState('');
  const sectors = allocationSectorPlan(marks, savedAllocationInputs(marks, selected[0]), companies).filter(row => row.kind === 'sector');
  function clear() { setCases(null); setError(''); }
  function calculate(event: FormEvent) {
    event.preventDefault(); clear();
    try { setCases(compareSavedAllocationShocks(marks, companies, selected, shock, overrides)); setCalculatedAt(new Date().toISOString()); }
    catch (e) { setError((e as Error).message); }
  }
  function download() {
    if (!cases) return;
    try {
      const csv = savedAllocationShockCsv(cases, marks, calculatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'saved-allocation-shocks.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError('The saved mix shock CSV could not be prepared. Please try again.'); }
  }
  const baseline = cases?.[0].result;
  return <section aria-labelledby="saved-mix-shock-heading">
    <h4 id="saved-mix-shock-heading">Shared shocks for saved mixes</h4>
    <p className="muted small">Apply one set of price changes to the current mix and every selected proposal at this stored valuation. Blank sector overrides inherit the default; zero overrides apply zero. Each mix keeps its own cash fixed. Targets assume immediate allocation without costs, followed by one shock with no further rebalancing. No fees, taxes, share rounding, correlations, probabilities, or forecasts are modeled. This does not choose a preferred mix or execute trades.</p>
    <form onSubmit={calculate}><div className="stress-inputs">
      <label>Saved mixes default price change (%)<input type="number" required min="-100" max="100" step="0.01" value={shock} onChange={event => { clear(); setShock(event.target.value); }} /></label>
      {sectors.map(row => <label key={row.label}>Saved mixes {row.label} override (%)<input type="number" min="-100" max="100" step="0.01" placeholder="Use default" value={overrides[row.label] || ''} onChange={event => { clear(); setOverrides(current => ({ ...current, [row.label]: event.target.value })); }} /></label>)}
    </div><button className="secondary" type="submit">Compare saved mix shocks</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {cases && baseline && <>
      <p className="muted small">Shared baseline: {money(baseline.baselineTotal, false)}. Applied shocks: {baseline.rows.map(row => `${row.label} ${row.shockPercent.toFixed(2)}%`).join('; ')}.</p>
      <div className="table-scroll"><table><caption>Saved mixes under shared shocks</caption><thead><tr><th>Mix</th><th>Shocked total</th><th>Value change</th><th>Change / baseline</th><th>Gap vs current shocked mix</th><th>Fixed cash</th></tr></thead><tbody>
        <tr><th scope="row">Current mix</th><td>{money(baseline.currentTotal, false)}</td><td>{money(baseline.currentChange, false)}</td><td>{baseline.currentChangePercent.toFixed(2)}%</td><td>{money(0, false)}</td><td>{money(marks.cash, false)}</td></tr>
        {cases.map(({ preset, result }) => <tr key={preset.id}><th scope="row">{preset.name}</th><td>{money(result.targetTotal, false)}</td><td>{money(result.targetChange, false)}</td><td>{result.targetChangePercent.toFixed(2)}%</td><td>{money(result.targetMinusCurrent, false)}</td><td>{money(result.rows.find(row => row.kind === 'cash')!.targetValue, false)}</td></tr>)}
      </tbody></table></div>
      <div className="export-actions"><button className="secondary" onClick={download}>Download saved mix shock CSV</button><p className="muted small">Exports each proposal with raw targets, common holding and price evidence, applied bucket shocks, unrounded results, and calculation dates.</p></div>
    </>}
  </section>;
}
