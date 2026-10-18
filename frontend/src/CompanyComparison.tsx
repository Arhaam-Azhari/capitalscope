import PeerPeriodReview from './PeerPeriodReview';
import SavedFundamentalsSetups from './SavedFundamentalsSetups';
import type { PeerMeasure } from './peerMeasures';
import PeerMeasureChart from './PeerMeasureChart';
import FundamentalCoverage from './FundamentalCoverage';
import { companyFundamentals, companyComparisonCsv, comparisonRatio } from './companyFundamentals';
import EvidenceTable from './EvidenceTable';
import { comparisonLink } from './researchNavigation';
import SavedResearchComparison from './SavedResearchComparison';
import { useEffect, useRef, useState } from 'react';
import { money, request } from './api';
import type { Company, FinancialReport, Point } from './types';

function percent(numerator: number | undefined, denominator: number | undefined) {
  const value = comparisonRatio(numerator, denominator);
  return value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}
function Evidence({ point, example }: { point: Point | undefined; example: boolean }) {
  if (!point) return null;
  return <small className="comparison-evidence">{point.periodStart} to {point.periodEnd}
    {example ? <span>Invented example</span> : <><span>Filed {point.filed || '—'}</span>{point.sourceUrl && <a href={point.sourceUrl} target="_blank" rel="noreferrer">SEC filing ↗</a>}</>}
  </small>;
}

export default function CompanyComparison({ companies, peers, measure, onChange, contextTicker, onOpen }: { measure: PeerMeasure; companies: Company[]; peers: string[] | null; onChange: (peers: string[] | null, measure?: PeerMeasure) => void; contextTicker: string; onOpen: (ticker: string) => void }) {
  const mode = peers ? 'sec' : 'example';
  const selected = peers || ['AAPL', 'MSFT'];
  const [copyMessage, setCopyMessage] = useState('');
  const link = comparisonLink(contextTicker, selected, undefined, measure);
  useEffect(() => setCopyMessage(''), [peers, measure]);
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); active.current = controller;
    setReports([]); setFailures([]); setBusy(true); setExportError('');
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
  }, [mode, peers, attempt]);
  function change(index: number, ticker: string) {
    active.current?.abort(); setReports([]); setFailures([]);
    setCopyMessage(''); onChange(selected.map((value, i) => i === index ? ticker : value));
  }
  const rows = reports.map(companyFundamentals);
  const [exportError, setExportError] = useState('');
  function download() {
    setExportError('');
    try {
      const url = URL.createObjectURL(new Blob([companyComparisonCsv(reports, failures, new Date().toISOString())], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'company-fundamentals-comparison.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('The company comparison CSV could not be prepared. Please try again.'); }
  }
  return <section className="panel" aria-labelledby="comparison-heading">
    <div className="panel-title"><div><span className="eyebrow">PEER RESEARCH</span><h2 id="comparison-heading">Compare company fundamentals</h2></div></div>
    <div className="comparison-controls"><label>Comparison data<select disabled={companies.length < 2} value={mode} onChange={e => { active.current?.abort(); setReports([]); setCopyMessage(''); onChange(e.target.value === 'sec' ? companies.filter(c => ['AAPL', 'MSFT'].includes(c.ticker)).map(c => c.ticker) : null); }}><option value="example">Fictional example peers</option><option value="sec">Real SEC companies</option></select></label>
      {mode === 'sec' && selected.map((ticker, i) => <label key={i}>Company {i + 1}<select value={ticker} onChange={e => change(i, e.target.value)}>{companies.filter(c => c.ticker === ticker || !selected.includes(c.ticker)).map(c => <option key={c.ticker} value={c.ticker}>{c.name} ({c.ticker})</option>)}</select></label>)}
      {mode === 'sec' && selected.length < 4 && <button type="button" className="secondary" onClick={() => { const next = companies.find(c => !selected.includes(c.ticker)); if (next) onChange([...selected, next.ticker]); }}>Add company</button>}
      {mode === 'sec' && selected.length > 2 && <button type="button" className="secondary" onClick={() => onChange(selected.slice(0, -1))}>Remove last company</button>}
    </div>
    {mode === 'sec' && <div className="summary-share"><button className="secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(link); setCopyMessage('Comparison link copied.'); }
      catch { setCopyMessage('Copy is unavailable. Select and copy the link below.'); }
    }}>Copy company comparison link</button><label>Company comparison link<input readOnly value={link} onFocus={event => event.target.select()} /></label><p className="muted small">Opens these companies in the same app instance with the latest available evidence, not a frozen report. The link contains company selections and the chart measure only and does not grant access. Localhost links remain local.</p>{copyMessage && <p role="status" className="save-status">{copyMessage}</p>}</div>}
    <p className={`notice ${mode === 'example' ? 'example' : 'warning'}`}>{mode === 'example' ? 'All three companies and their figures are invented. They are separate from the real catalog.' : 'Latest annual periods may end on different dates. Compare businesses with similar economics; this table does not rank investments.'}</p>
    <p className="muted small">Margins use matching start and end dates within each company. Growth uses the preceding annual revenue period, 300–400 days earlier. Missing or mismatched inputs stay blank. Cash after capex is reported operating cash flow minus capex; it is not the unlevered cash flow used by the valuation model.</p>
    {busy && <p role="status">Loading comparison…</p>}
    {failures.length > 0 && <div className="notice error" role="alert">{failures.map(f => <p key={f}>{f}</p>)}<button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry comparison</button></div>}
    {!busy && reports.length > 0 && <PeerMeasureChart reports={reports} measure={measure} onChange={value => onChange(peers, value)} />}
    {!busy && rows.length > 0 && <div className="export-actions"><button className="secondary" onClick={download}>Download fundamentals comparison CSV</button><span className="muted small">Loaded companies only · decimal ratios · dated inputs and filing sources · load failures included</span></div>}
    {exportError && <p role="alert" className="notice error">{exportError}</p>}
    {!busy && rows.length > 0 && <EvidenceTable label="Company fundamentals" pinFirstColumn><table className="comparison-table"><caption>Latest annual fundamentals and matched-period ratios</caption><thead><tr><th scope="col">Measure</th>{rows.map(({ report }) => <th scope="col" key={report.company.ticker}>{report.company.name}<small className="comparison-evidence">{report.company.ticker} · {report.company.sector}{report.retrievedAt && <span>Retrieved {new Date(report.retrievedAt).toLocaleString()}</span>}</small></th>)}</tr></thead><tbody>
      <tr><th scope="row">Revenue</th>{rows.map(({ report, revenue }) => <td key={report.company.ticker}>{revenue ? money(revenue.value) : '—'}<Evidence point={revenue} example={mode === 'example'} /></td>)}</tr>
      <tr><th scope="row">Annual revenue growth</th>{rows.map(({ report, revenue, prior }) => <td key={report.company.ticker}>{percent(revenue && prior ? revenue.value - prior.value : undefined, prior?.value)}<Evidence point={prior} example={mode === 'example'} /></td>)}</tr>
      <tr><th scope="row">Net income margin</th>{rows.map(({ report, revenue, income }) => <td key={report.company.ticker}>{percent(income?.value, revenue?.value)}<Evidence point={income} example={mode === 'example'} /></td>)}</tr>
      <tr><th scope="row">Operating cash flow margin</th>{rows.map(({ report, revenue, operating }) => <td key={report.company.ticker}>{percent(operating?.value, revenue?.value)}<Evidence point={operating} example={mode === 'example'} /></td>)}</tr>
      <tr><th scope="row">Cash after capex</th>{rows.map(({ report, operating, capex, afterCapex }) => <td key={report.company.ticker}>{afterCapex !== undefined ? money(afterCapex) : '—'}<Evidence point={operating} example={mode === 'example'} /><Evidence point={capex} example={mode === 'example'} /></td>)}</tr>
      <tr><th scope="row">Cash after capex / revenue</th>{rows.map(({ report, revenue, afterCapex }) => <td key={report.company.ticker}>{percent(afterCapex, revenue?.value)}</td>)}</tr>
    </tbody></table></EvidenceTable>}
    {!busy && reports.length > 0 && <PeerPeriodReview reports={reports} failures={failures} />}
    {!busy && reports.length > 0 && <FundamentalCoverage reports={reports} />}
    {!busy && !rows.length && <p>No company figures are available for this comparison.</p>}
    <SavedFundamentalsSetups companies={companies} tickers={peers} measure={measure} onLoad={onChange} />
    {mode === 'sec' && <SavedResearchComparison companies={companies} tickers={selected} onOpen={onOpen} />}
  </section>;
}
