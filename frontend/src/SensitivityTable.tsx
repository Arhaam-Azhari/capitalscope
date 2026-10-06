import { useEffect, useState } from 'react';
import { money, request } from './api';
import type { Assumptions } from './types';

type Grid = { terminalGrowthRates: number[]; rows: { discountRate: number; cells: {
  terminalGrowthRate: number; valuePerShare: number | null; error: string | null; baseCase: boolean;
}[] }[] };
const rate = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function SensitivityTable({ assumptions }: { assumptions: Assumptions }) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const payload = JSON.stringify(assumptions);
  useEffect(() => {
    const controller = new AbortController(); setGrid(null); setError('');
    request<Grid>('/api/valuations/dcf/sensitivity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: payload, signal: controller.signal }).then(data => { if (!controller.signal.aborted) setGrid(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [payload, attempt]);
  return <section className="sensitivity-section" aria-labelledby="sensitivity-heading">
    <h3 id="sensitivity-heading">How much do the assumptions matter?</h3>
    <p className="muted small">Per-share estimates in USD. Rows vary WACC by one percentage point; columns vary terminal growth by half a percentage point. Starting cash flow, forecast growth, horizon, net debt, and shares stay fixed.</p>
    {error ? <div className="notice error" role="alert">{error}<button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry sensitivity</button></div> : !grid ? <p role="status">Calculating sensitivity…</p> :
      <div className="table-scroll"><table className="sensitivity-table"><caption>Discount rate versus terminal growth: estimated value per share</caption><thead><tr><th>WACC / terminal growth</th>{grid.terminalGrowthRates.map((value, i) => <th key={i}>{rate(value)}</th>)}</tr></thead><tbody>
        {grid.rows.map((row, i) => <tr key={i}><th scope="row">{rate(row.discountRate)}</th>{row.cells.map((cell, j) => <td key={j} className={cell.baseCase ? 'base-case' : ''}>
          {cell.valuePerShare === null ? <span title={cell.error || 'Invalid inputs'}>Unavailable<small className="comparison-evidence">{cell.error}</small></span> : money(cell.valuePerShare, false)}
          {cell.baseCase && <small className="comparison-evidence">Base case</small>}
        </td>)}</tr>)}
      </tbody></table></div>}
    <p className="muted small">Unavailable cells fail the model’s input or numeric-range checks. Terminal growth must remain below WACC. This table shows model uncertainty, not probabilities or price targets.</p>
  </section>;
}
