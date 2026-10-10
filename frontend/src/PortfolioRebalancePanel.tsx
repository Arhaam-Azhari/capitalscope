import { useState, type FormEvent } from 'react';
import { allocationPlanCsv } from './allocationPlanCsv';
import { money } from './api';
import { allocationPlanSummary, allocationShareEstimate, currentAllocationTargets, rebalanceAvailable, rebalancePlan } from './portfolioRebalance';
import type { PortfolioMarks } from './types';

export default function PortfolioRebalancePanel({ marks }: { marks: PortfolioMarks }) {
  const assets = ['Cash', ...marks.holdings.map(holding => holding.ticker)];
  const [targets, setTargets] = useState<string[]>(assets.map(() => ''));
  const [result, setResult] = useState<ReturnType<typeof rebalancePlan> | null>(null);
  const [calculatedAt, setCalculatedAt] = useState('');
  const [basisChecked, setBasisChecked] = useState(false);
  const [error, setError] = useState('');
  const available = rebalanceAvailable(marks);
  const movement = result ? allocationPlanSummary(marks, targets) : null;
  function calculate(event: FormEvent) {
    event.preventDefault(); setResult(null); setError('');
    try { setResult(rebalancePlan(marks, targets)); setCalculatedAt(new Date().toISOString()); }
    catch (e) { setError(e instanceof Error ? e.message : 'The plan could not be calculated.'); }
  }
  function useCurrentWeights() {
    setResult(null); setError('');
    try { setTargets(currentAllocationTargets(marks)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Current weights are unavailable.'); }
  }
  function download() {
    if (!result) return;
    setError('');
    try {
      const csv = allocationPlanCsv(marks, targets, calculatedAt, new Date().toISOString(), basisChecked);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'target-allocation-plan.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError('The allocation CSV could not be prepared. Please try again.'); }
  }
  return <section className="portfolio-actions" aria-labelledby="rebalance-heading">
    <div className="panel-title"><h3 id="rebalance-heading">Target allocation planner</h3><span className="pill">Dollar changes · simulation</span></div>
    <p className="muted small">Enter your own target percentages for cash and current holdings. Targets must total exactly 100%, with up to two decimal places. The plan holds this snapshot's total value fixed and shows target minus current value. It does not choose allocations, send orders, or record simulated fills.</p>
    <p className="muted small">Uses the dated prices above, which may differ across holdings. No fees, taxes, slippage, deposits, withdrawals, or share rounding are modeled. Dollar changes are rounded for display and may have a small rounding residual. Targets and results stay in this view only and reset when stored valuation is refreshed or the portfolio changes.</p>
    {!available ? <p className="notice warning">Planning is unavailable until every holding is priced and total value is positive. A priced subtotal is not enough.</p> : <>
      <div className="export-actions"><button className="secondary" onClick={useCurrentWeights}>Use current weights</button><p className="muted small">Replaces entered targets with this snapshot's mix, rounded to two decimal places while keeping the total at 100%. Small dollar changes can result from rounding. Review or edit the targets, then calculate; nothing is saved or traded.</p></div>
      <form onSubmit={calculate}><div className="model-fields">{assets.map((ticker, i) => <label key={ticker}>Target {ticker} allocation (%)<input type="number" min="0" max="100" step="0.01" required value={targets[i]} onChange={event => { setTargets(current => current.map((value, index) => index === i ? event.target.value : value)); setResult(null); setError(''); }} /></label>)}</div>
        <div className="comparison-controls"><button className="secondary" type="submit">Calculate allocation changes</button><button className="text-button" type="button" onClick={() => { setTargets(assets.map(() => '')); setResult(null); setError(''); }}>Clear allocation targets</button></div></form>
      <div className="export-actions"><button className="secondary" disabled={!result} onClick={download}>Download allocation plan CSV</button><p className="muted small">Exports the calculated plan with unrounded dollar values, entered target percentages, baseline dates, and each holding's price evidence. Cash has no price evidence. Calculate again after changing targets.</p></div>
      <label><input type="checkbox" checked={basisChecked} onChange={event => setBasisChecked(event.target.checked)} /> I checked the recorded-share and stored-price basis</label>
      <p className="muted small">Optional fractional-share estimates divide target value by each stored raw close, then subtract recorded shares. This manual check does not verify split history or current prices. Estimates use up to six decimals for display, with no whole-share rounding, fees, taxes, or slippage; they are not orders or recorded fills. The CSV includes unrounded estimates and this acknowledgment. Cash has no share estimate.</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      {movement && <section aria-labelledby="allocation-movement-heading">
        <h4 id="allocation-movement-heading">Allocation movement summary</h4>
        <dl className="allocation-plan-summary">
          <div><dt>Holding increases</dt><dd>{money(movement.holdingIncreases, false)}</dd></div>
          <div><dt>Holding reductions</dt><dd>{money(movement.holdingReductions, false)}</dd></div>
          <div><dt>Gross holding changes / baseline</dt><dd>{movement.grossHoldingChangePercent.toFixed(2)}%</dd></div>
          <div><dt>Target cash reserve</dt><dd>{money(movement.targetCash, false)}</dd></div>
          <div><dt>Cash reserve change</dt><dd>{money(movement.cashChange, false)}</dd></div>
        </dl>
        <p className="muted small">Gross holding changes count increases plus reductions, divided by the baseline total; cash is excluded. This measures this plan's dollar movement, not annual fund turnover. Holding reductions minus increases fund the cash reserve change. Balance residual (six decimals): {movement.balanceResidual.toFixed(6)} USD. Display rounding can leave small differences. No fees, taxes, execution sequence, or trading activity are modeled.</p>
      </section>}
      {result && <><p className="muted small">Baseline total: {money(marks.totalValue!, false)} · Evaluated {new Date(marks.evaluatedAt).toLocaleString()}. Positive changes increase a holding or cash; negative changes decrease it. Cash is the balancing reserve, not a trade.</p>
        <div className="table-scroll"><table><caption>Target allocation dollar changes</caption><thead><tr><th>Asset</th><th>Current value</th><th>Current weight</th><th>Target weight</th><th>Target value</th><th>Dollar change</th><th>Estimated target shares</th><th>Estimated share change</th></tr></thead><tbody>{result.map((row, i) => { const estimate = allocationShareEstimate(i === 0 ? undefined : marks.holdings[i - 1], row.targetValue, basisChecked); return <tr key={row.ticker}><th scope="row">{row.ticker}</th><td>{money(row.value, false)}</td><td>{(row.currentWeight * 100).toFixed(2)}%</td><td>{(row.targetWeight * 100).toFixed(2)}%</td><td>{money(row.targetValue, false)}</td><td>{money(row.change, false)}</td><td title={estimate.reason || undefined}>{estimate.targetShares === null ? '—' : estimate.targetShares.toLocaleString(undefined, { maximumFractionDigits: 6 })}{basisChecked && estimate.reason && <small> {estimate.reason}</small>}</td><td title={estimate.reason || undefined}>{estimate.shareChange === null ? '—' : estimate.shareChange.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>; })}</tbody></table></div></>}
    </>}
  </section>;
}
