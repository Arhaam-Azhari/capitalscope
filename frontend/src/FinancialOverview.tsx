import { useState } from 'react';
import { money } from './api';
import type { FinancialReport, Metric } from './types';

function Trend({ metric }: { metric: Metric }) {
  const data = [...metric.annualValues].reverse();
  if (!data.length) return <div className="empty">No annual data available for this metric.</div>;
  const low = Math.min(0, ...data.map(p => p.value));
  const high = Math.max(0, ...data.map(p => p.value));
  const range = high - low || 1;
  const y = (n: number) => 175 - (n - low) / range * 140;
  const x = (index: number) => data.length === 1 ? 260 : 35 + index / (data.length - 1) * 450;
  const points = data.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  return <div className="trend"><svg viewBox="0 0 520 215" role="img" aria-label={`${metric.name} annual trend; exact values are in the table below`}>
    {[0, 1, 2, 3].map(i => <line key={i} x1="35" x2="485" y1={35 + i * 140 / 3} y2={35 + i * 140 / 3} className="gridline" />)}
    <line x1="35" x2="485" y1={y(0)} y2={y(0)} className="zero-line" />
    <polyline fill="none" points={points} stroke="#287f66" strokeWidth="3" strokeLinejoin="round" />
    {data.map((p, i) => <g key={p.periodEnd}><circle cx={x(i)} cy={y(p.value)} r="4" fill="#287f66"><title>{p.periodEnd}: {money(p.value, false)}</title></circle><text x={x(i)} y="205" textAnchor="middle">{p.periodEnd.slice(0, 4)}</text></g>)}
  </svg><span className="small muted">Annual periods · USD · zero baseline shown</span></div>;
}

export default function FinancialOverview({ report }: { report: FinancialReport }) {
  const [metricName, setMetricName] = useState('Revenue');
  const metric = report.metrics.find(m => m.name === metricName) || report.metrics[0];
  return <>
    <div className="export-actions"><a className="secondary export-link" href={report.dataMode === 'example' ? '/api/examples/financials/export.csv' : `/api/companies/${report.company.ticker}/financials/export.csv`}>Download financial CSV</a><span className="muted small">Includes source links, dates, tags, and data mode.</span></div>
    <div className="metric-grid">{report.metrics.map(m => {
      const latest = m.annualValues[0];
      return <button key={m.name} className={`metric-card ${m.name === metricName ? 'active' : ''}`} onClick={() => setMetricName(m.name)} aria-pressed={m.name === metricName}>
        <span>{m.name}</span><strong>{latest ? money(latest.value) : '—'}</strong><small>{latest ? `Period ended ${latest.periodEnd}` : 'Not reported in supported tags'}</small>
      </button>;
    })}</div>
    {metric && <section className="panel" aria-labelledby="trend-heading"><div className="panel-title"><div><span className="eyebrow">ANNUAL FINANCIALS</span><h2 id="trend-heading">{metric.name}</h2></div><span className="pill">Up to 5 periods</span></div>
      <Trend metric={metric} />
      <div className="table-scroll"><table><caption>{metric.name}: values and filing sources</caption><thead><tr><th>Period ended</th><th>Reported value</th><th>Filed</th><th>Source</th></tr></thead><tbody>
        {metric.annualValues.map(p => <tr key={p.periodEnd}><th scope="row">{p.periodEnd}</th><td>{money(p.value, false)}</td><td>{p.filed || '—'}</td><td>{p.sourceUrl && report.dataMode === 'sec' ? <a href={p.sourceUrl} target="_blank" rel="noreferrer">SEC filing ↗</a> : 'Example only'}</td></tr>)}
        {!metric.annualValues.length && <tr><td colSpan={4}>No supported annual facts were found. Missing data is not zero.</td></tr>}
      </tbody></table></div>
      <details><summary>Accounting tags and data notes</summary><p className="small muted">{report.notes.join(' ')}</p><ul className="source-tags">{metric.annualValues.map(p => <li key={p.periodEnd}>{p.periodEnd}: <code>{p.tag}</code>{p.periodStart && ` · ${p.periodStart} to ${p.periodEnd}`}</li>)}</ul></details>
    </section>}
  </>;
}
