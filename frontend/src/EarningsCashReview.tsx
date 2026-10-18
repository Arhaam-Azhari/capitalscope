import { useState } from 'react';
import { annualFundamentals } from './companyFundamentals';
import { earningsCashReview, earningsCashReviewCsv } from './earningsCashReview';
import { money } from './api';
import EvidenceTable from './EvidenceTable';

type AnnualRow = ReturnType<typeof annualFundamentals>[number];
export default function EarningsCashReview({ rows }: { rows: AnnualRow[] }) {
  const reviewed = earningsCashReview(rows);
  const [error, setError] = useState('');
  function download() {
    if (!rows.length) return;
    try {
      const url = URL.createObjectURL(new Blob([earningsCashReviewCsv(rows, new Date().toISOString())], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${rows[0].report.company.ticker}-earnings-cash-review.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError('');
    } catch { setError('The earnings and cash flow CSV could not be prepared. Please try again.'); }
  }
  return <details className="fundamental-coverage">
    <summary>Review earnings and operating cash flow</summary>
    <p className="muted small">Shown performance periods only. Operating cash flow / net income shows cash flow per dollar of positive reported earnings. Zero or negative net income leaves the ratio unavailable; the dollar difference can still be shown. Negative operating cash flow is preserved.</p>
    <p className="muted small">Operating cash flow minus net income is a simple difference, not a reconciliation of accruals or working capital. Taxes, noncash items, sector economics, and accounting policies can affect it. These measures are not a quality score or free cash flow.</p>
    <div className="export-actions"><button type="button" className="secondary" disabled={!rows.length} onClick={download}>Download earnings and cash flow CSV</button></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    <EvidenceTable label="Earnings and operating cash flow"><table><caption>Matched-period earnings and cash flow review</caption><thead><tr><th scope="col">Revenue period</th><th scope="col">Net income</th><th scope="col">Operating cash flow</th><th scope="col">Cash flow minus earnings</th><th scope="col">Cash flow / positive earnings</th><th scope="col">Availability</th></tr></thead><tbody>{reviewed.map(row => <tr key={row.revenue!.periodEnd}>
      <th scope="row">{row.revenue!.periodEnd}<small className="comparison-evidence">From {row.revenue!.periodStart || 'start unavailable'}</small></th>
      <td>{row.income ? money(row.income.value) : 'Unavailable'}</td><td>{row.operating ? money(row.operating.value) : 'Unavailable'}</td>
      <td>{row.gap === undefined ? 'Unavailable' : money(row.gap)}</td><td>{row.ratio === undefined ? 'Unavailable' : `${row.ratio.toFixed(2)}×`}</td>
      <td>{row.gapReason || row.ratioReason || 'Matched inputs available.'}</td>
    </tr>)}</tbody></table></EvidenceTable>
    <p className="muted small">Expand the annual table's input evidence for filing links. The CSV retains both inputs, exact dates, accounting tags, filing sources, and unavailable-value reasons.</p>
  </details>;
}
