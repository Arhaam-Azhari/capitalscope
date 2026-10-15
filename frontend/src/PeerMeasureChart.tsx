import { peerMeasures, type PeerMeasure } from './peerMeasures';
import { companyFundamentals, fundamentalMeasures } from './companyFundamentals';
import { money } from './api';
import type { FinancialReport } from './types';

export default function PeerMeasureChart({ reports, measure, onChange }: { reports: FinancialReport[]; measure: PeerMeasure; onChange: (measure: PeerMeasure) => void }) {
  const selected = peerMeasures[measure];
  const rows = reports.map(report => ({ report, revenue: companyFundamentals(report).revenue,
    measure: fundamentalMeasures(report).find(item => item.name === selected)! }));
  const values = rows.flatMap(row => row.measure.value === undefined ? [] : [row.measure.value]);
  // I normalize before setting the shared scale so signed extremes cannot overflow its span.
  const scale = Math.max(1, ...values.map(Math.abs));
  const low = Math.min(0, ...values.map(value => value / scale));
  const high = Math.max(0, ...values.map(value => value / scale));
  const range = high - low || 1;
  const position = (value: number) => (value / scale - low) / range * 100;
  const zero = position(0);
  const unit = rows[0]?.measure.unit || 'USD';
  const format = (value: number) => unit === 'USD' ? money(value) : `${(value * 100).toFixed(1)}%`;
  return <section className="peer-measure-chart" aria-labelledby="peer-chart-heading">
    <h3 id="peer-chart-heading">One measure across peers</h3>
    <label>Peer chart measure<select value={measure} onChange={event => onChange(event.target.value as PeerMeasure)}>{Object.entries(peerMeasures).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <p className="muted small">Shared zero baseline · {unit === 'USD' ? 'USD' : 'percent'}. Companies stay in selection order. Fiscal periods may differ; exact inputs and filing sources remain in the table below.</p>
    {values.length > 0 && <div className="peer-scale" aria-hidden="true"><span>{format(low * scale)}</span><span>{format(high * scale)}</span></div>}
    <ul className="peer-measure-list">{rows.map(({ report, revenue, measure }) => <li key={report.company.ticker}>
      <div className="peer-measure-heading"><div><strong>{report.company.ticker}</strong><span>{report.company.name}</span></div><strong>{measure.value === undefined ? 'Unavailable' : format(measure.value)}</strong></div>
      <p className="muted small">{revenue ? `Annual period: ${revenue.periodStart || 'start unavailable'} to ${revenue.periodEnd}` : 'Annual revenue period unavailable'}</p>
      {measure.value === undefined ? <p className="muted small">{measure.unavailableReason}</p> : <div className="peer-measure-track" role="img" aria-label={`${report.company.ticker} ${selected}: ${format(measure.value)}`}>
        <span className="peer-zero" style={{ left: `${zero}%` }} />
        <span className="peer-value-bar" style={{ left: `${Math.min(zero, position(measure.value))}%`, width: `${Math.abs(position(measure.value) - zero)}%` }} />
      </div>}
    </li>)}</ul>
  </section>;
}
