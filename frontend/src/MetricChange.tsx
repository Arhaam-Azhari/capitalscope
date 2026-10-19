import { metricChange } from './metricChange';
import { money } from './api';
import type { Metric } from './types';

export default function MetricChange({ metric }: { metric: Metric }) {
  const change = metricChange(metric);
  return <section className="metric-change" aria-label={`${metric.name} year-over-year comparison`}>
    <h3>Latest year-over-year change</h3>
    {change.latest && change.prior && <p className="muted small">{change.balance ? 'Balance dates' : 'Annual reporting windows'}: {change.balance ? change.prior.periodEnd : `${change.prior.periodStart || 'Unknown start'} to ${change.prior.periodEnd}`} → {change.balance ? change.latest.periodEnd : `${change.latest.periodStart || 'Unknown start'} to ${change.latest.periodEnd}`}. Source values and filing links are in the evidence table above.</p>}
    {change.reason ? <p className="notice warning">{change.reason}</p> : <>
      <dl className="metric-change-grid">
        <div><dt>Prior reported value</dt><dd>{money(change.prior!.value, false)}</dd></div>
        <div><dt>Reported dollar change</dt><dd data-testid="metric-dollar-change">{change.amount! > 0 ? '+' : ''}{money(change.amount!, false)}</dd></div>
        <div><dt>Percentage change</dt><dd data-testid="metric-percentage-change">{change.percentage === undefined ? 'Unavailable' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' }).format(change.percentage) + '%'}</dd></div>
      </dl>
      {change.percentageReason && <p className="muted small">{change.percentageReason}</p>}
    </>}
    <p className="muted small">{change.balance ? 'Compares cash balances at two dates, not cash generated during the year.' : 'Compares reported annual amounts without adjusting for calendar differences, acquisitions, inflation, or accounting changes.'} Dollar change = latest − prior; percentage change = (latest − prior) / prior × 100. An increase is not a rating of business performance or a stock return.</p>
  </section>;
}
