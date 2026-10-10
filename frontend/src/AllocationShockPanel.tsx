import { useState, type FormEvent } from 'react';
import { allocationShock } from './allocationShock';
import { allocationShockCsv } from './allocationShockCsv';
import { allocationSectorPlan } from './portfolioRebalance';
import { money } from './api';
import type { Company, PortfolioMarks } from './types';

export default function AllocationShockPanel({ marks, targets, companies, planCalculatedAt }: { marks: PortfolioMarks; targets: string[]; companies: Company[]; planCalculatedAt: string }) {
  const [shock, setShock] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof allocationShock> | null>(null);
  const [calculatedAt, setCalculatedAt] = useState('');
  const [error, setError] = useState('');
  const sectors = allocationSectorPlan(marks, targets, companies).filter(group => group.kind === 'sector');
  function clear() { setResult(null); setError(''); }
  function calculate(event: FormEvent) {
    event.preventDefault(); clear();
    try { setResult(allocationShock(marks, targets, companies, shock, overrides)); setCalculatedAt(new Date().toISOString()); }
    catch (e) { setError(e instanceof Error ? e.message : 'The shock comparison could not be calculated.'); }
  }
  function download() {
    if (!result) return;
    try {
      const csv = allocationShockCsv(result, marks, planCalculatedAt, calculatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'allocation-shock-comparison.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError('The shock CSV could not be prepared. Please try again.'); }
  }
  return <section aria-labelledby="allocation-shock-heading">
    <h4 id="allocation-shock-heading">Current vs target shock comparison</h4>
    <p className="muted small">Enter your own price changes for both mixes at this same stored baseline. Sector overrides replace the default; blank overrides inherit it. Each mix keeps its own cash reserve fixed. The target mix assumes immediate allocation at baseline values without costs, then applies shocks once with no further rebalancing. These are hypothetical dollar allocations, not executed share trades or forecasts.</p>
    <form onSubmit={calculate}><div className="stress-inputs">
      <label>Plan default price change (%)<input type="number" min="-100" max="100" step="0.01" required value={shock} onChange={event => { clear(); setShock(event.target.value); }} /></label>
      {sectors.map(group => <label key={group.label}>Plan {group.label} override (%)<input type="number" min="-100" max="100" step="0.01" placeholder="Use default" value={overrides[group.label] || ''} onChange={event => { clear(); setOverrides(current => ({ ...current, [group.label]: event.target.value })); }} /></label>)}
    </div><button className="secondary" type="submit">Compare allocation shocks</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {result && <>
      <div className="table-scroll"><table><caption>Current and target shocked totals</caption><thead><tr><th>Mix</th><th>Baseline total</th><th>Shocked total</th><th>Value change</th><th>Change / baseline</th></tr></thead>
        <tbody><tr><th scope="row">Current mix</th><td>{money(result.baselineTotal, false)}</td><td>{money(result.currentTotal, false)}</td><td>{money(result.currentChange, false)}</td><td>{result.currentChangePercent.toFixed(2)}%</td></tr>
          <tr><th scope="row">Target mix</th><td>{money(result.baselineTotal, false)}</td><td>{money(result.targetTotal, false)}</td><td>{money(result.targetChange, false)}</td><td>{result.targetChangePercent.toFixed(2)}%</td></tr></tbody></table></div>
      <p className="muted small">Target minus current shocked value: {money(result.targetMinusCurrent, false)}. A positive value means the target mix retains more value under these assumptions; it is not a recommendation. No fees, taxes, share rounding, correlations, or forecast probabilities are modeled.</p>
      <div className="table-scroll"><table><caption>Allocation shock bucket details</caption><thead><tr><th>Bucket</th><th>Applied shock</th><th>Current shocked value</th><th>Target shocked value</th></tr></thead><tbody>{result.rows.map(row => <tr key={`${row.kind}:${row.label}`}><th scope="row">{row.label}</th><td>{row.shockPercent.toFixed(2)}%</td><td>{money(row.currentStressedValue, false)}</td><td>{money(row.targetStressedValue, false)}</td></tr>)}</tbody></table></div>
      <div className="export-actions"><button className="secondary" onClick={download}>Download allocation shock CSV</button><p className="muted small">Includes applied shocks, unrounded bucket and total values, baseline and calculation dates, and limits. Nothing is saved or traded.</p></div>
    </>}
  </section>;
}
