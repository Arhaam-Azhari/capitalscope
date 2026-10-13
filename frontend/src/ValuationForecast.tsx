import { useId } from 'react';
import { money } from './api';
import type { Valuation } from './types';

export default function ValuationForecast({ result }: { result: Valuation }) {
  const description = useId();
  const data = result.projections;
  if (!data.length) return null;
  const low = Math.min(0, ...data.flatMap(point => [point.freeCashFlow, point.presentValue]));
  const high = Math.max(0, ...data.flatMap(point => [point.freeCashFlow, point.presentValue]));
  const range = high - low || 1;
  const x = (index: number) => data.length === 1 ? 395 : 85 + index / (data.length - 1) * 620;
  const y = (value: number) => 240 - (value - low) / range * 200;
  const line = (key: 'freeCashFlow' | 'presentValue') => data.map((point, index) => `${x(index)},${y(point[key])}`).join(' ');
  const labelInterval = Math.max(1, Math.ceil(data.length / 6));
  const terminal = result.terminalValueShare * 100;
  return <section className="valuation-forecast" aria-labelledby="forecast-chart-heading">
    <h3 id="forecast-chart-heading">Future cash flow, in today’s dollars</h3>
    <p id={description} className="muted small">Projected unlevered cash flow and its discounted present value for each forecast year. Both use the same USD scale with a zero baseline. Terminal value is separate; exact annual amounts appear in the table below.</p>
    <div className="forecast-legend"><span><i className="forecast-key" />Projected cash flow · solid copper</span><span><i className="discounted-key" />Present value · dashed slate</span></div>
    <svg viewBox="0 0 740 290" role="img" aria-label="Projected cash flow versus discounted present value" aria-describedby={description}>
      {[0, 1, 2, 3, 4].map(index => {
        const value = low + range * index / 4;
        return <g key={index}><line x1="85" x2="705" y1={y(value)} y2={y(value)} className="gridline" /><text x="75" y={y(value) + 4} textAnchor="end">{money(value)}</text></g>;
      })}
      <line x1="85" x2="705" y1={y(0)} y2={y(0)} className="zero-line" />
      <polyline points={line('freeCashFlow')} fill="none" stroke="var(--accent)" strokeWidth="3" />
      <polyline points={line('presentValue')} fill="none" stroke="var(--reference)" strokeWidth="3" strokeDasharray="7 5" />
      {data.map((point, index) => <g key={point.year}>
        <circle cx={x(index)} cy={y(point.freeCashFlow)} r="4" fill="var(--accent)"><title>Year {point.year}: projected {money(point.freeCashFlow, false)}</title></circle>
        <circle cx={x(index)} cy={y(point.presentValue)} r="4" fill="var(--reference)"><title>Year {point.year}: present value {money(point.presentValue, false)}</title></circle>
        {(index % labelInterval === 0 || index === data.length - 1) && <text x={x(index)} y="266" textAnchor="middle">{point.year}</text>}
      </g>)}
      <text x="395" y="287" textAnchor="middle">Forecast year</text>
    </svg>
    {Number.isFinite(terminal) && terminal >= 0 && terminal <= 100 && <div className="value-composition">
      <h4>Where enterprise value comes from</h4>
      <div className="value-composition-bar" role="img" aria-label={`Forecast cash flows: ${(100 - terminal).toFixed(1)}%; terminal value: ${terminal.toFixed(1)}% of enterprise value`}><span style={{ width: `${100 - terminal}%` }} /><span style={{ width: `${terminal}%` }} /></div>
      <div className="value-composition-labels"><span>Forecast cash flows <strong>{(100 - terminal).toFixed(1)}%</strong></span><span>Terminal value <strong>{terminal.toFixed(1)}%</strong></span></div>
      <p className="muted small">Shares of discounted enterprise value, before net debt. These are model contributions, not probabilities.</p>
    </div>}
  </section>;
}
