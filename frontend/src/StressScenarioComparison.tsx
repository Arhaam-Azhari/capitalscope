import { useEffect, useState } from 'react';
import { money } from './api';
import type { SavedStress } from './SavedPortfolioStress';

const dollars = (value: number | null) => value === null || !Number.isFinite(value) ? 'Unavailable' : money(value, false);
const percent = (value: number | null) => value === null || !Number.isFinite(value) ? 'Unavailable' : `${(value * 100).toFixed(2)}%`;
function baselineKey(item: SavedStress) {
  const baseline = item.result.baseline;
  // I compare the saved holdings and quote evidence, without treating evaluation time or display order as a price change.
  return JSON.stringify({ portfolioId: item.portfolioId, mode: baseline.dataMode, cash: baseline.cash,
    complete: baseline.complete, priced: baseline.pricedPositions, total: baseline.totalPositions,
    totalValue: baseline.totalValue, subtotal: baseline.pricedHoldingsValue,
    holdings: [...item.result.holdings].sort((a, b) => a.baseline.ticker.localeCompare(b.baseline.ticker)).map(({ baseline: mark, sector }) => ({
      ticker: mark.ticker, sector, quantity: mark.quantity, costBasis: mark.costBasis, close: mark.close,
      priceDate: mark.priceDate, source: mark.source, sourceUrl: mark.sourceUrl, retrievedAt: mark.retrievedAt, value: mark.value, error: mark.error
    })) });
}
function matching(item: SavedStress, reference: SavedStress) {
  return item.modelVersion === 'price-shock-v1' && reference.modelVersion === 'price-shock-v1'
    && item.result.baseline.complete && reference.result.baseline.complete && baselineKey(item) === baselineKey(reference);
}
export default function StressScenarioComparison({ selected }: { selected: SavedStress[] }) {
  const [referenceId, setReferenceId] = useState('');
  useEffect(() => { if (!selected.some(item => item.id === referenceId)) setReferenceId(selected[0]?.id || ''); }, [selected, referenceId]);
  if (selected.length < 2) return <p className="muted small">Select two to four saved stress scenarios to compare.</p>;
  const reference = selected.find(item => item.id === referenceId) || selected[0];
  const tickers = [...new Set(selected.flatMap(item => item.result.holdings.map(holding => holding.baseline.ticker)))].sort();
  const sectors = [...new Set(selected.flatMap(item => Object.keys(item.result.assumptions.sectorShocks)))].sort();
  function delta(item: SavedStress) {
    const value = item.result.stressedTotalValue, base = reference.result.stressedTotalValue;
    if (!matching(item, reference) || value === null || base === null) return null;
    const change = value - base;
    return Number.isFinite(change) ? change : null;
  }
  function row(label: string, cell: (item: SavedStress) => React.ReactNode) {
    return <tr key={label}><th scope="row">{label}</th>{selected.map(item => <td key={item.id}>{cell(item)}</td>)}</tr>;
  }
  return <section className="stress-comparison" aria-label="Saved stress scenario comparison">
    <div className="panel-title"><div><span className="eyebrow">SAVED CASES / COMPARISON</span><h3>Compare stress scenarios</h3></div><label>Reference stress scenario<select value={reference.id} onChange={event => setReferenceId(event.target.value)}>{selected.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
    <p className="muted small">Each column keeps its saved baseline. A value difference versus the reference is available only when both cases have complete prices, the same cash, shares, cost basis, sectors, price dates and source evidence, and the supported model version. Different evaluation times alone do not change that baseline.</p>
    {selected.some(item => !matching(item, reference)) && <p className="notice warning" role="status">Some cases have different or incomplete baselines, or an unsupported model version. Their reference differences are unavailable; the original saved values remain visible.</p>}
    <div className="table-scroll"><table><caption>Saved stress assumptions, baselines, and results</caption><thead><tr><th scope="col">Metric / evidence</th>{selected.map(item => <th scope="col" key={item.id}>{item.name}<small className="comparison-evidence">{item.id === reference.id ? 'Reference case' : 'Saved case'}</small></th>)}</tr></thead><tbody>
      {row('Saved at', item => new Date(item.createdAt).toLocaleString())}
      {row('Baseline evaluated at', item => new Date(item.result.baseline.evaluatedAt).toLocaleString())}
      {row('Model / data mode', item => `${item.modelVersion} · ${item.result.baseline.dataMode === 'example' ? 'Invented example closes' : 'Stored market closes'}`)}
      {row('Price coverage', item => `${item.result.baseline.pricedPositions} / ${item.result.baseline.totalPositions} holdings · ${item.result.baseline.complete ? 'Complete' : 'Incomplete'}`)}
      {row('Default price change', item => percent(item.result.assumptions.defaultShock))}
      {sectors.map(sector => row(`${sector} override`, item => Object.hasOwn(item.result.assumptions.sectorShocks, sector) ? percent(item.result.assumptions.sectorShocks[sector]) : 'Inherit default'))}
      {row('Cash held fixed', item => dollars(item.result.baseline.cash))}
      {row('Original baseline total', item => dollars(item.result.baseline.totalValue))}
      {row('Stressed total value', item => dollars(item.result.stressedTotalValue))}
      {row('Change vs own baseline', item => dollars(item.result.change))}
      {row('Change / own baseline value', item => percent(item.result.relativeChange))}
      {row('Reference comparability', item => matching(item, reference) ? 'Matching complete baseline' : 'Unavailable · baseline or model differs')}
      {row('Stressed value difference vs reference', item => dollars(delta(item)))}
      {tickers.map(ticker => row(`${ticker} · saved holding`, item => {
        const holding = item.result.holdings.find(value => value.baseline.ticker === ticker);
        if (!holding) return 'Not held';
        const mark = holding.baseline;
        return <>{mark.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} shares · {holding.sector}<small className="comparison-evidence">Baseline {dollars(mark.value)} → stressed {dollars(holding.stressedValue)} · {percent(holding.shock)}</small><small className="comparison-evidence">Raw close {dollars(mark.close)} · {mark.priceDate || 'No price date'}</small><small className="comparison-evidence">{mark.error || (mark.sourceUrl ? <a href={mark.sourceUrl} target="_blank" rel="noreferrer">{mark.source} ↗</a> : mark.source)}</small><small className="comparison-evidence">{mark.retrievedAt ? `Imported ${new Date(mark.retrievedAt).toLocaleString()}` : 'No market import'}</small></>;
      }))}
    </tbody></table></div>
    <p className="muted small">These are hypothetical price assumptions, not forecast probabilities or performance returns. Comparing saved cases does not recalculate holdings, import quotes, or write trades. Download each case's CSV from its saved-scenario row for original decimal values and complete evidence.</p>
  </section>;
}
