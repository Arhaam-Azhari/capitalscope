import { useEffect, useRef, useState, type FormEvent } from 'react';
import { money, request } from './api';
import type { Assumptions, Company, Valuation } from './types';

type FormValues = Record<keyof Assumptions, string>;
const fields: { key: keyof Assumptions; label: string; hint: string; min?: number; max?: number; step: string }[] = [
  { key: 'baseFreeCashFlow', label: 'Starting unlevered cash flow', hint: 'USD, full amount', min: 0.01, step: 'any' },
  { key: 'growthRate', label: 'Annual growth', hint: 'Percent per year', min: -99.99, max: 100, step: 'any' },
  { key: 'discountRate', label: 'Discount rate / WACC', hint: 'Percent per year', min: 0.001, max: 100, step: 'any' },
  { key: 'terminalGrowthRate', label: 'Terminal growth', hint: 'Percent per year', min: -99.99, step: 'any' },
  { key: 'years', label: 'Forecast horizon', hint: 'Years', min: 1, max: 20, step: '1' },
  { key: 'netDebt', label: 'Net debt', hint: 'USD; negative means net cash', step: 'any' },
  { key: 'sharesOutstanding', label: 'Shares outstanding', hint: 'Actual shares, not millions', min: 1, step: 'any' }
];
const rateKeys = new Set(['growthRate', 'discountRate', 'terminalGrowthRate']);
const empty: FormValues = { baseFreeCashFlow: '', growthRate: '', discountRate: '', terminalGrowthRate: '', years: '5', netDebt: '', sharesOutstanding: '' };
const example: FormValues = { baseFreeCashFlow: '100000000', growthRate: '5', discountRate: '10', terminalGrowthRate: '2', years: '5', netDebt: '200000000', sharesOutstanding: '50000000' };
const specialized = new Set(['BRK-B', 'JPM', 'BAC', 'MS', 'GS', 'WFC', 'UNH']);

export default function ValuationPanel({ company }: { company: Company }) {
  const [values, setValues] = useState<FormValues>(company.ticker === 'DEMO' ? example : empty);
  const [result, setResult] = useState<Valuation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function edit(key: keyof Assumptions, value: string) {
    active.current?.abort();
    setBusy(false); setResult(null); setError('');
    setValues(current => ({ ...current, [key]: value }));
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    const assumptions = Object.fromEntries(fields.map(({ key }) => [key,
      Number(values[key]) / (rateKeys.has(key) ? 100 : 1)
    ])) as Assumptions;
    if (assumptions.terminalGrowthRate >= assumptions.discountRate) {
      setError('Terminal growth must be below the discount rate.'); return;
    }
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setResult(null);
    try {
      const valuation = await request<Valuation>('/api/valuations/dcf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assumptions), signal: controller.signal
      });
      if (!controller.signal.aborted) setResult(valuation);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not calculate this model.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <section className="panel valuation-panel" aria-labelledby="valuation-heading">
    <div className="panel-title"><div><span className="eyebrow">VALUATION WORKSPACE</span><h2 id="valuation-heading">Build your assumptions</h2></div><span className="pill">FCFF model</span></div>
    <p className="muted">Estimate enterprise and equity value with a discounted cash flow model. Inputs are yours; reported cash flow is not automatically treated as unlevered cash flow.</p>
    {specialized.has(company.ticker) ? <div className="notice warning" role="note">{company.name} needs a sector-specific valuation approach. This general FCFF calculator is unavailable for this company.</div> : <>
      {company.ticker === 'DEMO' && <div className="notice example">These starting assumptions are invented examples. Change them to explore the model.</div>}
      <form onSubmit={calculate}>
        <div className="model-fields">{fields.map(field => <label key={field.key}>
          <span>{field.label}</span><input type="number" required value={values[field.key]} onChange={e => edit(field.key, e.target.value)} min={field.min} max={field.max} step={field.step} />
          <small>{field.hint}</small>
        </label>)}</div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="model-actions"><button className="primary" type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Calculate valuation'}<span aria-hidden="true"> ↗</span></button><span className="muted small">Constant growth · Gordon-growth terminal value</span></div>
      </form>
      {result && <div className="valuation-result" aria-live="polite">
        <div className="result-heading"><span className="eyebrow">MODEL ESTIMATE</span><strong>{money(result.valuePerShare, false)}</strong><span>per share, based on your assumptions</span></div>
        <div className="result-summary"><div><span>Enterprise value</span><strong>{money(result.enterpriseValue)}</strong></div><div><span>Equity value</span><strong>{money(result.equityValue)}</strong></div><div><span>Terminal contribution</span><strong>{(result.terminalValueShare * 100).toFixed(1)}%</strong></div></div>
        {result.terminalValueShare > .75 && <p className="notice warning">More than 75% of this estimate comes from terminal value. Small changes in long-term assumptions can materially change the result.</p>}
        <div className="table-scroll"><table><caption>Forecast cash flow and present value</caption><thead><tr><th>Year</th><th>Unlevered cash flow</th><th>Present value</th></tr></thead><tbody>{result.projections.map(p => <tr key={p.year}><th scope="row">{p.year}</th><td>{money(p.freeCashFlow)}</td><td>{money(p.presentValue)}</td></tr>)}</tbody></table></div>
        <p className="muted small">A model estimate is not a market quote. This version does not adjust for dilution, excess assets, or all non-debt claims.</p>
      </div>}
    </>}
  </section>;
}
