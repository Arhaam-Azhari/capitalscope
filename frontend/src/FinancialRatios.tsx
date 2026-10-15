import { useState } from 'react';
import AnnualRatioTrend from './AnnualRatioTrend';
import { annualFundamentals, comparisonRatio, companyComparisonCsv } from './companyFundamentals';
import { money } from './api';
import EvidenceTable from './EvidenceTable';
import type { FinancialReport } from './types';

const percent = (value: number | undefined) => value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;

export default function FinancialRatios({ report }: { report: FinancialReport }) {
  const allRows = annualFundamentals(report);
  const periods = allRows.map(row => row.revenue!.periodEnd).sort();
  const [start, setStart] = useState(() => periods[0] || '');
  const [end, setEnd] = useState(() => periods[periods.length - 1] || '');
  const invalidWindow = start > end;
  // I calculate against the full loaded history before filtering the visible window.
  const rows = invalidWindow ? [] : allRows.filter(row => row.revenue!.periodEnd >= start && row.revenue!.periodEnd <= end);
  const narrowed = start !== periods[0] || end !== periods[periods.length - 1];
  const [exportError, setExportError] = useState('');
  function download() {
    if (invalidWindow || !rows.length) return;
    setExportError('');
    try {
      const csv = companyComparisonCsv(rows.map(row => row.report), [], new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${report.company.ticker}-annual-performance${narrowed ? `-${start}-${end}` : ''}.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('The annual performance CSV could not be prepared. Please try again.'); }
  }
  return <section className="panel financial-ratios" aria-labelledby="ratio-history-heading">
    <div className="panel-title"><div><span className="eyebrow">ANNUAL PERFORMANCE</span><h2 id="ratio-history-heading">Growth, margins & cash flow</h2></div><span className="pill">Matched periods</span></div>
    <p className="muted small">Margins use the same start and end dates as each annual revenue period. Growth compares revenue with a period ending 300–400 days earlier and requires positive prior revenue. Missing or mismatched inputs stay unavailable. Cash after capex is operating cash flow minus capex, not the unlevered cash flow used by the valuation model.</p>
    {allRows.length > 0 && <>
      <div className="comparison-controls"><label>First performance period<select value={start} onChange={event => { setStart(event.target.value); setExportError(''); }}>{periods.map(period => <option key={period}>{period}</option>)}</select></label>
        <label>Last performance period<select value={end} onChange={event => { setEnd(event.target.value); setExportError(''); }}>{periods.map(period => <option key={period}>{period}</option>)}</select></label>
        {narrowed && <button type="button" className="secondary" onClick={() => { setStart(periods[0]); setEnd(periods[periods.length - 1]); setExportError(''); }}>Show all performance periods</button>}
      </div>
      {invalidWindow ? <p className="notice error" role="alert">The first performance period must be no later than the last period.</p> : <><p className="muted small">{rows.length} of {allRows.length} periods shown · {start} to {end}. Growth can use a preceding period outside this window.</p><AnnualRatioTrend rows={rows} /></>}
      <div className="export-actions"><button type="button" className="secondary" disabled={invalidWindow || !rows.length} onClick={download}>Download annual performance CSV</button><span className="muted small">Shown periods only · six measures per period · USD and decimal ratios · dated source inputs</span></div>
    </>}
    {exportError && <p role="alert" className="notice error">{exportError}</p>}
    {!allRows.length ? <p>No supported annual revenue periods are available for ratio history.</p> : invalidWindow ? null : <EvidenceTable label="Annual performance history"><table><caption>Annual ratios and matched-period input evidence</caption><thead><tr><th>Period ended</th><th>Revenue growth</th><th>Net income margin</th><th>Operating cash flow margin</th><th>Cash after capex</th><th>Inputs</th></tr></thead><tbody>
      {rows.map(({ revenue, income, operating, capex, prior, afterCapex }) => <tr key={revenue!.periodEnd}>
        <th scope="row">{revenue!.periodEnd}</th>
        <td>{percent(comparisonRatio(revenue && prior ? revenue.value - prior.value : undefined, prior?.value))}</td>
        <td>{percent(comparisonRatio(income?.value, revenue?.value))}</td>
        <td>{percent(comparisonRatio(operating?.value, revenue?.value))}</td>
        <td>{afterCapex === undefined ? '—' : money(afterCapex)}</td>
        <td><details><summary>Evidence for {revenue!.periodEnd}</summary><ul className="ratio-inputs">
          {([['Revenue', revenue], ['Prior revenue', prior], ['Net income', income], ['Operating cash flow', operating], ['Capital expenditure', capex]] as const).map(([name, point]) => <li key={name}><strong>{name}</strong>{point ? <><span>{money(point.value, false)} · USD</span><span>{point.periodStart || 'Start unavailable'} to {point.periodEnd}</span><span>Filed {point.filed || 'unavailable'} · {point.tag}</span>{report.dataMode === 'example' ? <span>Invented example</span> : point.sourceUrl ? <a href={point.sourceUrl} target="_blank" rel="noreferrer">{name} filing ↗</a> : <span>Filing link unavailable</span>}</> : <span>No matching annual input</span>}</li>)}
        </ul></details></td>
      </tr>)}
    </tbody></table></EvidenceTable>}
    <p className="muted small">Different fiscal periods and accounting changes can affect year-to-year comparisons. A missing ratio is not zero.</p>
  </section>;
}
