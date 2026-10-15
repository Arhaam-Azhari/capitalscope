import { useState } from 'react';
import { comparisonRatio, type annualFundamentals } from './companyFundamentals';

type AnnualRow = ReturnType<typeof annualFundamentals>[number];
const series = [
  { key: 'income', label: 'Net income margin', value: (row: AnnualRow) => comparisonRatio(row.income?.value, row.revenue?.value) },
  { key: 'growth', label: 'Revenue growth', value: (row: AnnualRow) => comparisonRatio(row.revenue && row.prior ? row.revenue.value - row.prior.value : undefined, row.prior?.value) },
  { key: 'operating', label: 'Operating cash flow margin', value: (row: AnnualRow) => comparisonRatio(row.operating?.value, row.revenue?.value) }
];
export default function AnnualRatioTrend({ rows }: { rows: AnnualRow[] }) {
  const [selected, setSelected] = useState('income');
  const measure = series.find(item => item.key === selected)!;
  const data = [...rows].reverse().map(row => ({ date: row.revenue!.periodEnd, value: measure.value(row) }));
  const available = data.flatMap(point => point.value === undefined ? [] : [point.value * 100]);
  const low = Math.min(0, ...available), high = Math.max(0, ...available);
  const range = high - low || 1;
  const x = (index: number) => data.length === 1 ? 355 : 75 + index / (data.length - 1) * 560;
  const y = (value: number) => 205 - (value * 100 - low) / range * 165;
  return <div className="annual-ratio-trend">
    <label>Annual trend measure<select value={selected} onChange={event => setSelected(event.target.value)}>{series.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    <p className="muted small">{available.length} of {data.length} periods available. Missing values leave gaps. Periods are evenly spaced; exact fiscal dates and inputs appear below.</p>
    {!available.length ? <p>No matched annual inputs are available to chart this measure.</p> : <svg viewBox="0 0 680 255" role="img" aria-label={`${measure.label} annual history; missing values leave gaps`}>
      {[0, 1, 2, 3].map(index => {
        const value = low + range * index / 3;
        const level = 205 - (value - low) / range * 165;
        return <g key={index}><line x1="75" x2="635" y1={level} y2={level} className="gridline" /><text x="64" y={level + 4} textAnchor="end">{value.toFixed(1)}%</text></g>;
      })}
      <line x1="75" x2="635" y1={y(0)} y2={y(0)} className="zero-line" />
      {data.map((point, index) => {
        const previous = data[index - 1];
        return <g key={point.date}>
          {point.value !== undefined && <>
            {previous?.value !== undefined && <line className="ratio-trend-segment" x1={x(index - 1)} y1={y(previous.value)} x2={x(index)} y2={y(point.value)} stroke="var(--accent)" strokeWidth="3" />}
            <circle className="ratio-trend-point" cx={x(index)} cy={y(point.value)} r="4" fill="var(--accent)"><title>{point.date}: {(point.value * 100).toFixed(2)}%</title></circle>
          </>}
          <text x={x(index)} y="232" textAnchor="middle">{point.date.slice(0, 4)}</text>
        </g>;
      })}
      <text x="355" y="252" textAnchor="middle">Annual period ended</text>
    </svg>}
  </div>;
}
