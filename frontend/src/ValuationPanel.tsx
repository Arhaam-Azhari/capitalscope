import { sessionValuationInputs, type ValuationInputs } from './valuationInputs';
import ValuationForecast from './ValuationForecast';
import EvidenceTable from './EvidenceTable';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import SensitivityTable from './SensitivityTable';
import SavedScenarios from './SavedScenarios';
import { money, request } from './api';
import type { Assumptions, Company, Scenario, Valuation } from './types';

type FormValues = ValuationInputs;
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
  const defaults = company.ticker === 'DEMO' ? example : empty;
  const [values, setValues] = useState<FormValues>(() => sessionValuationInputs.get(company.ticker) || defaults);
  const [inputMessage, setInputMessage] = useState(() => sessionValuationInputs.has(company.ticker) ? 'Session inputs restored. Recalculate to review or save a result.' : '');
  const [result, setResult] = useState<Valuation | null>(null);
  const [snapshot, setSnapshot] = useState<{ assumptions: Assumptions; modelVersion: string; calculatedAt: string | null; savedCase: { id: string; name: string; savedAt: string } | null } | null>(null);
  const [exportError, setExportError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const editor = useRef<HTMLFormElement | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function edit(key: keyof Assumptions, value: string) {
    active.current?.abort();
    setBusy(false); setResult(null); setSnapshot(null); setExportError(''); setError('');
    const next = { ...values, [key]: value };
    sessionValuationInputs.set(company.ticker, next); setValues(next); setInputMessage('Inputs kept for this app session.');
  }

  const assumptions = Object.fromEntries(fields.map(({ key }) => [key,
    Number(values[key]) / (rateKeys.has(key) ? 100 : 1)
  ])) as Assumptions;

  function load(scenario: Scenario) {
    active.current?.abort(); setBusy(false); setError('');
    const next = Object.fromEntries(fields.map(({ key }) => [key,
      String(scenario.assumptions[key] * (rateKeys.has(key) ? 100 : 1))
    ])) as FormValues;
    setValues(next); sessionValuationInputs.set(company.ticker, next); setInputMessage('Saved case inputs loaded and kept for this app session.');
    setResult(scenario.result); setExportError('');
    setSnapshot({ assumptions: scenario.assumptions, modelVersion: scenario.modelVersion, calculatedAt: null, savedCase: { id: scenario.id, name: scenario.name, savedAt: scenario.createdAt } });
  }

  function resetInputs() {
    active.current?.abort(); setBusy(false); setResult(null); setSnapshot(null); setError(''); setExportError('');
    sessionValuationInputs.delete(company.ticker); setValues(defaults);
    setInputMessage(company.ticker === 'DEMO' ? 'Fictional example inputs restored.' : 'Valuation inputs cleared for this company.');
  }

  function useSensitivityRates(discountRate: number, terminalGrowthRate: number) {
    active.current?.abort(); setBusy(false); setResult(null); setSnapshot(null); setError(''); setExportError('');
    // I replace both rates together so a cell selection keeps every other input intact.
    const next = { ...values, discountRate: String(discountRate * 100), terminalGrowthRate: String(terminalGrowthRate * 100) };
    sessionValuationInputs.set(company.ticker, next); setValues(next);
    setInputMessage('Sensitivity rates loaded as editable inputs. Recalculate to review or save this case.');
    editor.current?.querySelector<HTMLInputElement>('input[name="discountRate"]')?.focus();
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (assumptions.terminalGrowthRate >= assumptions.discountRate) {
      setError('Terminal growth must be below the discount rate.'); return;
    }
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setResult(null); setSnapshot(null); setExportError('');
    try {
      const valuation = await request<Valuation>('/api/valuations/dcf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assumptions), signal: controller.signal
      });
      if (!controller.signal.aborted) {
        setResult(valuation);
        setSnapshot({ assumptions, modelVersion: 'fcff-v1', calculatedAt: new Date().toISOString(), savedCase: null });
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not calculate this model.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  function download() {
    if (!result || !snapshot) return;
    setExportError('');
    try {
      // I retain the original case inputs, rather than reconstructing them from displayed fields.
      const content = { schemaVersion: 'capitalscope-valuation-v1', company, exportedAt: new Date().toISOString(),
        source: snapshot.savedCase ? 'saved_case' : 'session_calculation', ...snapshot, result,
        units: { cashFlowAndValue: 'USD', sharesOutstanding: 'shares', rates: 'decimal fractions' },
        scope: 'User-assumed model estimate; not a market quote or verified financial evidence.' };
      const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${company.ticker}-valuation-snapshot.json`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('The valuation snapshot could not be prepared. Please try again.'); }
  }

  return <section className="panel valuation-panel" aria-labelledby="valuation-heading">
    <div className="panel-title"><div><span className="eyebrow">VALUATION WORKSPACE</span><h2 id="valuation-heading">Build your assumptions</h2></div><span className="pill">FCFF model</span></div>
    <p className="muted">Estimate enterprise and equity value with a discounted cash flow model. Inputs are yours; reported cash flow is not automatically treated as unlevered cash flow.</p>
    {specialized.has(company.ticker) ? <div className="notice warning" role="note">{company.name} needs a sector-specific valuation approach. This general FCFF calculator is unavailable for this company.</div> : <>
      {company.ticker === 'DEMO' && <div className="notice example">These starting assumptions are invented examples. Change them to explore the model.</div>}
      <p className="muted small">Inputs stay available for each company while this app is open. Refreshing or closing can lose them. Save a scenario to keep a model across sessions.</p>
      {inputMessage && <p role="status" className="save-status">{inputMessage}</p>}
      <form ref={editor} onSubmit={calculate}>
        <div className="model-fields">{fields.map(field => <label key={field.key}>
          <span>{field.label}</span><input type="number" name={field.key} required value={values[field.key]} onChange={e => edit(field.key, e.target.value)} min={field.min} max={field.max} step={field.step} />
          <small>{field.hint}</small>
        </label>)}</div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="model-actions"><button className="primary" type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Calculate valuation'}<span aria-hidden="true"> ↗</span></button><button type="button" className="secondary" onClick={resetInputs}>Reset valuation inputs</button><span className="muted small">Constant growth · Gordon-growth terminal value</span></div>
      </form>
      {result && <div className="valuation-result" aria-live="polite">
        <div className="export-actions"><button type="button" className="secondary" onClick={download}>Download valuation snapshot</button><span className="muted small">JSON · assumptions, forecast, result, and case provenance</span></div>
        {exportError && <p role="alert" className="notice error">{exportError}</p>}
        <div className="result-heading"><span className="eyebrow">MODEL ESTIMATE</span><strong>{money(result.valuePerShare, false)}</strong><span>per share, based on your assumptions</span></div>
        <div className="result-summary"><div><span>Enterprise value</span><strong>{money(result.enterpriseValue)}</strong></div><div><span>Equity value</span><strong>{money(result.equityValue)}</strong></div><div><span>Terminal contribution</span><strong>{(result.terminalValueShare * 100).toFixed(1)}%</strong></div></div>
        {result.terminalValueShare > .75 && <p className="notice warning">More than 75% of this estimate comes from terminal value. Small changes in long-term assumptions can materially change the result.</p>}
        <section className="valuation-bridge" aria-labelledby="value-bridge-heading">
          <h3 id="value-bridge-heading">From cash flow to value per share</h3>
          <p className="muted small">Discounted forecast cash flows plus discounted terminal value give enterprise value. Subtract net debt to reach equity value, then divide by the modeled shares. Negative net debt adds net cash.</p>
          <EvidenceTable label="Valuation value breakdown"><table><caption>Value breakdown for the current model case</caption><thead><tr><th>Step</th><th>Amount</th></tr></thead><tbody>
            <tr><th scope="row">Present value of forecast cash flows</th><td>{money(result.projections.reduce((total, projection) => total + projection.presentValue, 0), false)}</td></tr>
            <tr><th scope="row">Present value of terminal cash flows</th><td>{money(result.presentValueOfTerminalValue, false)}</td></tr>
            <tr className="bridge-total"><th scope="row">Enterprise value</th><td>{money(result.enterpriseValue, false)}</td></tr>
            <tr><th scope="row">Net debt to subtract</th><td>{money(assumptions.netDebt, false)}</td></tr>
            <tr className="bridge-total"><th scope="row">Equity value</th><td>{money(result.equityValue, false)}</td></tr>
            <tr><th scope="row">Shares to divide by</th><td>{assumptions.sharesOutstanding.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>
            <tr className="bridge-total"><th scope="row">Modeled value per share</th><td>{money(result.valuePerShare, false)}</td></tr>
          </tbody></table></EvidenceTable>
        </section>
        <ValuationForecast result={result} />
        <EvidenceTable label="Valuation forecast evidence"><table><caption>Forecast cash flow and present value</caption><thead><tr><th>Year</th><th>Unlevered cash flow</th><th>Present value</th></tr></thead><tbody>{result.projections.map(p => <tr key={p.year}><th scope="row">{p.year}</th><td>{money(p.freeCashFlow)}</td><td>{money(p.presentValue)}</td></tr>)}</tbody></table></EvidenceTable>
        <SensitivityTable assumptions={assumptions} company={company} onUseRates={useSensitivityRates} />
        <p className="muted small">A model estimate is not a market quote. This version does not adjust for dilution, excess assets, or all non-debt claims.</p>
      </div>}
      <SavedScenarios ticker={company.ticker} assumptions={result ? assumptions : null} onLoad={load} />
    </>}
  </section>;
}
