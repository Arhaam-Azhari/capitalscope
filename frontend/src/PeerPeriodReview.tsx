import { useState } from 'react';
import EvidenceTable from './EvidenceTable';
import { peerPeriodReview, peerPeriodReviewCsv } from './peerPeriodReview';
import type { FinancialReport } from './types';

export default function PeerPeriodReview({ reports, failures }: { reports: FinancialReport[]; failures: string[] }) {
  const review = peerPeriodReview(reports);
  const [error, setError] = useState('');
  function download() {
    try {
      const csv = peerPeriodReviewCsv(reports, failures, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'peer-fiscal-period-review.csv';
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError('');
    } catch { setError('The fiscal-period review CSV could not be prepared. Please try again.'); }
  }
  return <details className="fundamental-coverage">
    <summary>Review fiscal-period comparability</summary>
    <p className="notice warning">{review.sameWindow ? 'Loaded companies use the same revenue reporting window.' : 'Loaded companies do not all have the same complete revenue reporting window.'} Matching dates alone do not establish comparable businesses or accounting policies.</p>
    <p className="muted small">{review.completePeriods} of {reports.length} loaded companies have complete period dates. {review.endSpreadDays === undefined ? 'At least two valid period ends are needed to measure the end-date spread.' : `Period-end spread: ${review.endSpreadDays} calendar days.`} {review.sectors.length > 1 ? `Peers span ${review.sectors.length} catalog sectors; review their business mix.` : 'Peers share a catalog sector; their business mix may still differ.'}</p>
    <p className="muted small">Days include both start and end dates. End-date lag is measured against the newest valid period end among loaded peers, not today or the filing date. Figures remain as reported; this review does not calendarize or annualize them. Failed reports are excluded from these counts.</p>
    <div className="export-actions"><button type="button" className="secondary" onClick={download}>Download fiscal-period review CSV</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <EvidenceTable label="Peer fiscal periods"><table><caption>Latest annual revenue periods across loaded peers</caption><thead><tr><th scope="col">Company / sector</th><th scope="col">Revenue period</th><th scope="col">Inclusive days</th><th scope="col">End-date lag</th><th scope="col">Evidence / issue</th></tr></thead><tbody>{review.rows.map(row => <tr key={row.report.company.ticker}>
      <th scope="row">{row.report.company.ticker}<small className="comparison-evidence">{row.report.company.name} · {row.report.company.sector}</small></th>
      <td>{row.revenue ? `${row.revenue.periodStart || 'Start unavailable'} to ${row.revenue.periodEnd}` : 'Unavailable'}</td><td>{row.days ?? 'Unavailable'}</td><td>{row.endLagDays === undefined ? 'Unavailable' : `${row.endLagDays} days`}</td>
      <td>{row.reason && <p>{row.reason}</p>}{row.report.dataMode === 'example' ? 'Invented example' : <>Filed {row.revenue?.filed || 'unavailable'}{row.revenue?.sourceUrl && <small className="comparison-evidence"><a href={row.revenue.sourceUrl} target="_blank" rel="noreferrer">SEC revenue filing ↗</a></small>}</>}</td>
    </tr>)}</tbody></table></EvidenceTable>
  </details>;
}
