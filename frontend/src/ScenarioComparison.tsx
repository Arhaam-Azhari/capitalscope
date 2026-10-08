import { useEffect, useState } from 'react';
import { money } from './api';
import type { Scenario } from './types';

const numeric = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 10 });
const rate = (value: number) => `${numeric(value * 100)}%`;
const resultRate = (value: number) => `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
const assumptions = [
  ['baseFreeCashFlow', 'Starting unlevered cash flow', (value: number) => money(value, false)],
  ['growthRate', 'Annual growth', rate], ['discountRate', 'Discount rate / WACC', rate],
  ['terminalGrowthRate', 'Terminal growth', rate], ['years', 'Forecast horizon', (value: number) => `${numeric(value)} years`],
  ['netDebt', 'Net debt', (value: number) => money(value, false)], ['sharesOutstanding', 'Shares outstanding', numeric]
] as const;

function difference(item: Scenario, baseline: Scenario) {
  const delta = item.result.valuePerShare - baseline.result.valuePerShare;
  const absolute = item.modelVersion === baseline.modelVersion && Number.isFinite(delta) ? delta : null;
  const ratio = absolute !== null && baseline.result.valuePerShare > 0 ? absolute / baseline.result.valuePerShare : NaN;
  return { absolute, relative: Number.isFinite(ratio) && Number.isFinite(ratio * 100) ? ratio : null };
}

function csvText(value: string) {
  // I protect text fields that spreadsheet apps could interpret as formulas.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function comparisonCsv(selected: Scenario[], baseline: Scenario) {
  const headers = ['ticker', 'scenario_id', 'scenario_name', 'saved_at', 'model_version', 'baseline_id',
    'base_free_cash_flow_usd', 'annual_growth_rate', 'discount_rate', 'terminal_growth_rate', 'forecast_years',
    'net_debt_usd', 'shares_outstanding', 'enterprise_value_usd', 'equity_value_usd', 'value_per_share_usd',
    'terminal_value_share', 'delta_per_share_usd', 'relative_delta'];
  const rows = selected.map(item => {
    const a = item.assumptions, r = item.result, delta = difference(item, baseline);
    return [item.ticker, item.id, item.name, item.createdAt, item.modelVersion, baseline.id].map(csvText).concat([
      a.baseFreeCashFlow, a.growthRate, a.discountRate, a.terminalGrowthRate, a.years, a.netDebt, a.sharesOutstanding,
      r.enterpriseValue, r.equityValue, r.valuePerShare, r.terminalValueShare
    ].map(String), [delta.absolute === null ? '' : String(delta.absolute), delta.relative === null ? '' : String(delta.relative)]).join(',');
  });
  return [headers.join(','), ...rows].join('\r\n') + '\r\n';
}

export default function ScenarioComparison({ selected }: { selected: Scenario[] }) {
  const [baselineId, setBaselineId] = useState('');
  const baseline = selected.find(item => item.id === baselineId) || selected[0];
  useEffect(() => { if (!selected.some(item => item.id === baselineId)) setBaselineId(selected[0]?.id || ''); }, [selected, baselineId]);
  if (selected.length < 2) return <p className="muted small">Select two to four saved cases to compare their assumptions and estimates.</p>;
  const modelsDiffer = selected.some(item => item.modelVersion !== baseline.modelVersion);
  function download() {
    const url = URL.createObjectURL(new Blob([comparisonCsv(selected, baseline)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'valuation-comparison.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="scenario-comparison" aria-labelledby="scenario-comparison-heading">
    <div className="panel-title"><div><span className="eyebrow">SAVED CASES / ASSUMPTIONS</span><h3 id="scenario-comparison-heading">Compare my valuation cases</h3></div><button type="button" className="secondary" onClick={download}>Download comparison CSV</button></div>
    <label className="comparison-baseline">Comparison baseline<select value={baseline.id} onChange={event => setBaselineId(event.target.value)}>{selected.map(item => <option key={item.id} value={item.id}>{item.name} · {new Date(item.createdAt).toLocaleString()}</option>)}</select></label>
    <p className="muted small">These are saved assumptions for one company, not probabilities or market forecasts. Highlighted inputs differ from the selected baseline. Comparing cases does not change the open model.</p>
    {modelsDiffer && <p className="notice warning">These cases use different model versions. Deltas are unavailable for cases that differ from the baseline's model.</p>}
    <div className="table-scroll"><table className="scenario-comparison-table"><caption>Saved assumptions and valuation estimates</caption><thead><tr><th>Assumption / estimate</th>{selected.map(item => <th key={item.id}>{item.name}<span className="comparison-evidence">{item.id === baseline.id ? 'Baseline · ' : ''}{item.modelVersion}<br />Saved {new Date(item.createdAt).toLocaleString()}</span></th>)}</tr></thead><tbody>
      {assumptions.map(([key, label, format]) => <tr key={key}><th scope="row">{label}</th>{selected.map(item => {
        const changed = item.assumptions[key] !== baseline.assumptions[key];
        return <td key={item.id} className={changed ? 'assumption-changed' : ''}>{format(item.assumptions[key])}{changed && <span className="comparison-evidence">Changed from baseline</span>}</td>;
      })}</tr>)}
      {(['enterpriseValue', 'equityValue', 'valuePerShare'] as const).map((key, index) => <tr key={key}><th scope="row">{['Enterprise value', 'Equity value', 'Estimated value / share'][index]}</th>{selected.map(item => <td key={item.id}>{money(item.result[key], false)}</td>)}</tr>)}
      <tr><th scope="row">Terminal contribution</th>{selected.map(item => <td key={item.id}>{resultRate(item.result.terminalValueShare)}</td>)}</tr>
      <tr><th scope="row">Difference / share vs baseline</th>{selected.map(item => <td key={item.id}>{item.modelVersion === baseline.modelVersion ? difference(item, baseline).absolute === null ? 'Unavailable · numeric range' : money(difference(item, baseline).absolute!, false) : 'Unavailable · different model'}</td>)}</tr>
      <tr><th scope="row">Relative difference vs baseline</th>{selected.map(item => <td key={item.id}>{item.modelVersion !== baseline.modelVersion ? 'Unavailable · different model' : baseline.result.valuePerShare <= 0 ? 'Unavailable · baseline is not positive' : difference(item, baseline).relative === null ? 'Unavailable · numeric range' : resultRate(difference(item, baseline).relative!)}</td>)}</tr>
    </tbody></table></div>
    <p className="muted small">Percentage differences need a positive baseline estimate. Absolute differences remain available for zero or negative baselines under the same model. Saved dates identify when the case was recorded; the inputs are not verified point-in-time market data. CSV rates are decimal fractions.</p>
  </section>;
}
