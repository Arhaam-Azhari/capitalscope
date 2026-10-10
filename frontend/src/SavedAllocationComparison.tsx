import { useState, type ReactNode } from 'react';
import { compareSavedAllocations, savedAllocationComparisonCsv } from './savedAllocationComparison';
import type { SavedAllocationTarget } from './savedAllocationTargets';
import { money } from './api';
import type { Company, PortfolioMarks } from './types';

export default function SavedAllocationComparison({ marks, companies, selected }: { marks: PortfolioMarks; companies: Company[]; selected: SavedAllocationTarget[] }) {
  const [error, setError] = useState('');
  if (selected.length < 2) return <p className="muted small">Select two to four compatible saved mixes to compare at this valuation. Comparing does not replace entered targets.</p>;
  let cases: ReturnType<typeof compareSavedAllocations>;
  try { cases = compareSavedAllocations(marks, companies, selected); }
  catch (e) { return <p className="notice warning" role="status">Comparison unavailable: {(e as Error).message}</p>; }
  const baseline = cases[0].concentration;
  const exposure = (members: string[], weight: number) => `${members.join(', ') || 'None'} · ${weight.toFixed(2)}%`;
  function row(label: string, current: ReactNode, value: (item: typeof cases[number]) => ReactNode) {
    return <tr key={label}><th scope="row">{label}</th><td>{current}</td>{cases.map(item => <td key={item.preset.id}>{value(item)}</td>)}</tr>;
  }
  function download() {
    try {
      const csv = savedAllocationComparisonCsv(marks, companies, selected, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'saved-allocation-comparison.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError('');
    } catch { setError('The saved allocation comparison CSV could not be prepared. Please try again.'); }
  }
  return <section aria-labelledby="saved-allocation-comparison-heading">
    <h4 id="saved-allocation-comparison-heading">Saved allocation mix comparison</h4>
    <p className="muted small">Every proposal uses this same current stored valuation: {money(marks.totalValue!, false)}, evaluated {new Date(marks.evaluatedAt).toLocaleString()}. These are recalculated targets, not historical saved results. Prices can have different dates. Holdings and sector rankings exclude cash and zero weights, with the full total as denominator; gross changes count both holding increases and reductions. No fees, taxes, rounding to shares, or correlation estimates are included, and this does not choose a preferred mix.</p>
    <div className="table-scroll"><table><caption>Saved allocation mixes at one baseline</caption><thead><tr><th>Measure</th><th>Current mix</th>{cases.map(item => <th key={item.preset.id}>{item.preset.name}<small className="comparison-evidence">Saved {new Date(item.preset.createdAt).toLocaleString()}</small></th>)}</tr></thead><tbody>
      {row('Cash reserve', money(marks.cash, false), item => money(item.movement.targetCash, false))}
      {row('Cash weight', `${(marks.cash / marks.totalValue! * 100).toFixed(2)}%`, item => `${item.preset.targets.Cash.toFixed(2)}%`)}
      {row('Largest holding', exposure(baseline[0].currentMembers, baseline[0].currentWeightPercent), item => exposure(item.concentration[0].targetMembers, item.concentration[0].targetWeightPercent))}
      {row('Top three holdings', exposure(baseline[2].currentMembers, baseline[2].currentWeightPercent), item => exposure(item.concentration[2].targetMembers, item.concentration[2].targetWeightPercent))}
      {row('Largest sector bucket', exposure(baseline[1].currentMembers, baseline[1].currentWeightPercent), item => exposure(item.concentration[1].targetMembers, item.concentration[1].targetWeightPercent))}
      {row('Holding increases', money(0, false), item => money(item.movement.holdingIncreases, false))}
      {row('Holding reductions', money(0, false), item => money(item.movement.holdingReductions, false))}
      {row('Gross holding changes / baseline', '0.00%', item => `${item.movement.grossHoldingChangePercent.toFixed(2)}%`)}
    </tbody></table></div>
    <div className="export-actions"><button className="secondary" onClick={download}>Download saved mix comparison CSV</button><p className="muted small">Exports one row per proposal with unrounded metrics, target percentages, saved dates, and the common baseline's holding and price evidence as JSON fields.</p></div>
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
