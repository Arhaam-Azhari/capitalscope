import EvidenceTable from './EvidenceTable';
import { useEffect, useState } from 'react';
import { money, request } from './api';
import type { Assumptions, Company } from './types';
import { sensitivityCsv, sensitivityReview, type SensitivityGrid } from './sensitivityReview';

const rate = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function SensitivityTable({ assumptions, company, onUseRates }: { assumptions: Assumptions; company: Company; onUseRates: (discountRate: number, terminalGrowthRate: number) => void }) {
  const [loaded, setLoaded] = useState<{ payload: string; grid: SensitivityGrid; evaluatedAt: string } | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const payload = JSON.stringify(assumptions);
  const snapshot = loaded?.payload === payload ? loaded : null;
  const grid = snapshot?.grid;
  const review = grid ? sensitivityReview(grid) : null;
  useEffect(() => {
    const controller = new AbortController(); setLoaded(null); setError(''); setExportError('');
    request<SensitivityGrid>('/api/valuations/dcf/sensitivity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: payload, signal: controller.signal }).then(data => { if (!controller.signal.aborted) setLoaded({ payload, grid: data, evaluatedAt: new Date().toISOString() }); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [payload, attempt]);
  function download() {
    if (!snapshot) return;
    setExportError('');
    try {
      const csv = sensitivityCsv(company, assumptions, snapshot.grid, snapshot.evaluatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${company.ticker}-valuation-sensitivity.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('The sensitivity CSV could not be prepared. Please try again.'); }
  }
  return <section className="sensitivity-section" aria-labelledby="sensitivity-heading">
    <h3 id="sensitivity-heading">How much do the assumptions matter?</h3>
    <p className="muted small">Per-share estimates in USD. Rows vary WACC by one percentage point; columns vary terminal growth by half a percentage point. Starting cash flow, forecast growth, horizon, net debt, and shares stay fixed.</p>
    <p className="muted small">Choose a valid modeled value to load its WACC and terminal growth into the editor. Recalculate to review or save that case. Other inputs stay fixed.</p>
    {review && <>
      <p className="muted small">FCFF sensitivity calculated from the current inputs · {new Date(snapshot!.evaluatedAt).toLocaleString()}. Loading a saved case calculates a fresh grid; this is not its historical sensitivity result.</p>
      <p className="muted small">{review.valid} of {review.cells.length} cells available · {review.unavailable} unavailable. This is the range of valid cells in this grid, not a confidence interval. When values tie, the first cell in grid order is shown below.</p>
      {review.low && review.high ? <dl className="sensitivity-range">{([['Lowest modeled value', review.low], ['Highest modeled value', review.high]] as const).map(([label, cell]) => <div key={label}><dt>{label}</dt><dd>{money(cell.valuePerShare!, false)}<small>WACC {rate(cell.discountRate)} · terminal growth {rate(cell.terminalGrowthRate)}</small></dd></div>)}</dl> : <p className="notice warning">No valid modeled range is available for this grid.</p>}
      <div className="export-actions"><button className="secondary" type="button" disabled={!review.cells.length} onClick={download}>Download sensitivity CSV</button><span className="muted small">All grid cells, fixed inputs, decimal rates, and unavailable reasons. Uses the calculated grid without another request.</span></div>
      {exportError && <p className="notice error" role="alert">{exportError}</p>}
    </>}
    {error ? <div className="notice error" role="alert">{error}<button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry sensitivity</button></div> : !grid ? <p role="status">Calculating sensitivity…</p> :
      <EvidenceTable label="Valuation sensitivity"><table className="sensitivity-table"><caption>Discount rate versus terminal growth: estimated value per share</caption><thead><tr><th>WACC / terminal growth</th>{grid.terminalGrowthRates.map((value, i) => <th key={i}>{rate(value)}</th>)}</tr></thead><tbody>
        {grid.rows.map((row, i) => <tr key={i}><th scope="row">{rate(row.discountRate)}</th>{row.cells.map((cell, j) => <td key={j} className={cell.baseCase ? 'base-case' : ''}>
          {cell.valuePerShare === null || cell.error || !Number.isFinite(cell.valuePerShare) || !Number.isFinite(row.discountRate) || !Number.isFinite(cell.terminalGrowthRate) ? <span title={cell.error || 'Invalid inputs'}>Unavailable<small className="comparison-evidence">{cell.error}</small></span> : <button type="button" className="text-button sensitivity-cell" aria-label={`Use WACC ${rate(row.discountRate)} and terminal growth ${rate(cell.terminalGrowthRate)}`} onClick={() => onUseRates(row.discountRate, cell.terminalGrowthRate)}>{money(cell.valuePerShare, false)}</button>}
          {cell.baseCase && <small className="comparison-evidence">Base case</small>}
        </td>)}</tr>)}
      </tbody></table></EvidenceTable>}
    <p className="muted small">Unavailable cells fail the model’s input or numeric-range checks. Terminal growth must remain below WACC. This table shows model uncertainty, not probabilities or price targets.</p>
  </section>;
}
