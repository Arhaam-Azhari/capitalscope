import SavedResearchComparison from './SavedResearchComparison';
import { useEffect, useRef, useState } from 'react';
import { money, request } from './api';
import type { Company, FinancialReport, Point } from './types';

function points(report: FinancialReport, name: string) {
  return report.metrics.find(m => m.name === name && m.unit === 'USD')?.annualValues || [];
}
function aligned(report: FinancialReport, name: string, revenue: Point | undefined) {
  return revenue && points(report, name).find(p => p.periodStart === revenue.periodStart && p.periodEnd === revenue.periodEnd);
}
function percent(numerator: number | undefined, denominator: number | undefined) {
  return numerator !== undefined && denominator !== undefined && denominator > 0 ?
    `${(numerator / denominator * 100).toFixed(1)}%` : '—';
}
function Evidence({ point, example }: { point: Point | undefined; example: boolean }) {
  if (!point) return null;
  return <small className="comparison-evidence">{point.periodStart} to {point.periodEnd}
    {example ? <span>Invented example</span> : <><span>Filed {point.filed || '—'}</span>{point.sourceUrl && <a href={point.sourceUrl} target="_blank" rel="noreferrer">SEC filing ↗</a>}</>}
  </small>;
}

export default function CompanyComparison({ companies, onOpen }: { companies: Company[]; onOpen: (ticker: string) => void }) {
  const [mode, setMode] = useState<'example' | 'sec'>('example');
  const [selected, setSelected] = useState<string[]>(['AAPL', 'MSFT']);
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); active.current = controller;
    setReports([]); setFailures([]); setBusy(true);
    async function load() {
      if (mode === 'example') {
        try {
          const data = await request<FinancialReport[]>('/api/examples/comparisons', { signal: controller.signal });
          if (!controller.signal.aborted) setReports(data);
        } catch (e) { if (!controller.signal.aborted) setFailures([e instanceof Error ? e.message : 'Could not load examples.']); }
      } else {
        const results = await Promise.allSettled(selected.map(ticker =>
          request<FinancialReport>(`/api/companies/${ticker}/financials`, { signal: controller.signal })));
        if (!controller.signal.aborted) {
          setReports(results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []));
          setFailures(results.flatMap((r, i) => r.status === 'rejected' ? [`${selected[i]}: ${r.reason.message}`] : []));
        }
      }
      if (!controller.signal.aborted) setBusy(false);
    }
    void load(); return () => controller.abort();
  }, [mode, selected, attempt]);
  function change(index: number, ticker: string) {
    active.current?.abort(); setReports([]); setFailures([]);
    setSelected(current => current.map((value, i) => i === index ? ticker : value));
  }
  const rows = reports.map(report => {
    const revenue = points(report, 'Revenue')[0];
    const income = aligned(report, 'Net income', revenue);
    const operating = aligned(report, 'Operating cash flow', revenue);
    const capex = aligned(report, 'Capital expenditure', revenue);
    const prior = revenue && points(report, 'Revenue').find(p => {
      const days = (Date.parse(revenue.periodEnd) - Date.parse(p.periodEnd)) / 86400000;
      return days >= 300 && days <= 400;
    });
    const afterCapex = operating && capex ? operating.value - capex.value : undefined;
    return { report, revenue, income, operating, capex, prior, afterCapex };
  });
  return <section className="panel" aria-labelledby="comparison-heading">
    <div className="panel-title"><div><span className="eyebrow">PEER RESEARCH</span><h2 id="comparison-heading">Compare company fundamentals</h2></div></div>
    <div className="comparison-controls"><label>Comparison data<select value={mode} onChange={e => { active.current?.abort(); setReports([]); setMode(e.target.value as 'example' | 'sec'); }}><option value="example">Fictional example peers</option><option value="sec">Real SEC companies</option></select></label>
      {mode === 'sec' && selected.map((ticker, i) => <label key={i}>Company {i + 1}<select value={ticker} onChange={e => change(i, e.target.value)}>{companies.filter(c => c.ticker === ticker || !selected.includes(c.ticker)).map(c => <option key={c.ticker} value={c.ticker}>{c.name} ({c.ticker})</option>)}</select></label>)}
      {mode === 'sec' && selected.length < 4 && <button type="button" className="secondary" onClick={() => { const next = companies.find(c => !selected.includes(c.ticker)); if (next) setSelected([...selected, next.ticker]); }}>Add company</button>}
      {mode === 'sec' && selected.length > 2 && <button type="button" className="secondary" onClick={() => setSelected(selected.slice(0, -1))}>Remove last company</button>}
    </div>
    <p className={`notice ${mode === 'example' ? 'example' : 'warning'}`}>{mode === 'example' ? 'All three companies and their figures are invented. They are separate from the real catalog.' : 'Latest annual periods may end on different dates. Compare businesses with similar economics; this table does not rank investments.'}</p>
    <p className="muted small">Margins use matching start and end dates within each company. Growth uses the preceding annual revenue period, 300–400 days earlier. Missing or mismatched inputs stay blank. Cash after capex is reported operating cash flow minus capex; it is not the unlevered cash flow used by the valuation model.</p>
    {busy && <p role="status">Loading comparison…</p>}
    {failures.length > 0 && <div className="notice error" role="alert">{failures.map(f => <p key={f}>{f}</p>)}<button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry comparison</button></div>}
    {!busy && rows.length > 0 && <div className="table-scroll"><table className="comparison-table"><caption>Latest annual fundamentals and matched-period ratios</caption><thead><tr><th>Measure</th>{rows.map(({ report }) => <th key={report.company.ticker}>{report.company.name}<small className="comparison-evidence">{report.company.ticker} · {report.company.sector}{report.retrievedAt && <span>Retrieved {new Date(report.retrievedAt).toLocaleString()}</span>}</small></th>)}</tr></thead><tbody>
      <tr><th>Revenue</th>{rows.map(({ report, revenue }) => <td key={report.company.ticker}>{revenue ? money(revenue.value) : '—'}<Evidence point={revenue} example={mode === 'example'} /></td>)}</tr>
      <tr><th>Annual revenue growth</th>{rows.map(({ report, revenue, prior }) => <td key={report.company.ticker}>{percent(revenue && prior ? revenue.value - prior.value : undefined, prior?.value)}<Evidence point={prior} example={mode === 'example'} /></td>)}</tr>
      <tr><th>Net income margin</th>{rows.map(({ report, revenue, income }) => <td key={report.company.ticker}>{percent(income?.value, revenue?.value)}<Evidence point={income} example={mode === 'example'} /></td>)}</tr>
      <tr><th>Operating cash flow margin</th>{rows.map(({ report, revenue, operating }) => <td key={report.company.ticker}>{percent(operating?.value, revenue?.value)}<Evidence point={operating} example={mode === 'example'} /></td>)}</tr>
      <tr><th>Cash after capex</th>{rows.map(({ report, operating, capex, afterCapex }) => <td key={report.company.ticker}>{afterCapex !== undefined ? money(afterCapex) : '—'}<Evidence point={operating} example={mode === 'example'} /><Evidence point={capex} example={mode === 'example'} /></td>)}</tr>
      <tr><th>Cash after capex / revenue</th>{rows.map(({ report, revenue, afterCapex }) => <td key={report.company.ticker}>{percent(afterCapex, revenue?.value)}</td>)}</tr>
    </tbody></table></div>}
    {!busy && !rows.length && <p>No company figures are available for this comparison.</p>}
    {mode === 'sec' && <SavedResearchComparison companies={companies} tickers={selected} onOpen={onOpen} />}
  </section>;
}
