import { companyFundamentals, comparisonRatio } from './companyFundamentals';
import { money } from './api';

type Row = ReturnType<typeof companyFundamentals>;
const finite = (value: number) => Number.isFinite(value) ? value : undefined;
const difference = (last: number | undefined, first: number | undefined) => last === undefined || first === undefined ? undefined : finite(last - first);
const percent = (value: number | undefined) => value === undefined ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
function signed(value: number | undefined, unit: '%' | 'pp') {
  if (value === undefined) return 'Unavailable';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}${unit === '%' ? '%' : ' pp'}`;
}
export default function AnnualWindowSummary({ rows }: { rows: Row[] }) {
  const ordered = [...rows].sort((left, right) => left.revenue!.periodEnd.localeCompare(right.revenue!.periodEnd));
  if (ordered.length < 2) return <p className="muted small">Choose two or more performance periods to compare endpoint changes.</p>;
  const first = ordered[0], last = ordered[ordered.length - 1];
  const revenueChange = comparisonRatio(last.revenue!.value - first.revenue!.value, first.revenue!.value);
  const firstMargin = comparisonRatio(first.income?.value, first.revenue?.value);
  const lastMargin = comparisonRatio(last.income?.value, last.revenue?.value);
  const firstOperating = comparisonRatio(first.operating?.value, first.revenue?.value);
  const lastOperating = comparisonRatio(last.operating?.value, last.revenue?.value);
  const marginChange = difference(lastMargin, firstMargin);
  const operatingChange = difference(lastOperating, firstOperating);
  const cashChange = difference(last.afterCapex, first.afterCapex);
  const cards = [
    { label: 'Revenue change', value: signed(revenueChange === undefined ? undefined : finite(revenueChange * 100), '%'), evidence: `${money(first.revenue!.value)} → ${money(last.revenue!.value)}` },
    { label: 'Net margin change', value: signed(marginChange === undefined ? undefined : finite(marginChange * 100), 'pp'), evidence: `${percent(firstMargin)} → ${percent(lastMargin)}` },
    { label: 'Operating cash flow margin change', value: signed(operatingChange === undefined ? undefined : finite(operatingChange * 100), 'pp'), evidence: `${percent(firstOperating)} → ${percent(lastOperating)}` },
    { label: 'Cash after capex change', value: cashChange === undefined ? 'Unavailable' : `${cashChange > 0 ? '+' : ''}${money(cashChange)}`, evidence: `${first.afterCapex === undefined ? 'Unavailable' : money(first.afterCapex)} → ${last.afterCapex === undefined ? 'Unavailable' : money(last.afterCapex)}` }
  ];
  return <section className="annual-window-summary" aria-labelledby="window-summary-heading">
    <h3 id="window-summary-heading">Change across selected periods</h3>
    <p className="muted small">First and last reported periods: {first.revenue!.periodEnd} → {last.revenue!.periodEnd}. Percentage-point changes are labeled pp.</p>
    <dl className="window-change-grid">{cards.map(card => <div key={card.label}><dt>{card.label}</dt><dd>{card.value}<small>{card.evidence}</small></dd></div>)}</dl>
    <p className="muted small">These endpoint changes are not annualized and do not describe stock returns. Unavailable endpoints stay unavailable; changes between the endpoints remain in the chart and table below.</p>
  </section>;
}
