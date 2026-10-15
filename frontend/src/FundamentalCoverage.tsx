import { useState } from 'react';
import { fundamentalMeasures } from './companyFundamentals';
import EvidenceTable from './EvidenceTable';
import type { FinancialReport } from './types';

export default function FundamentalCoverage({ reports }: { reports: FinancialReport[] }) {
  const [unavailableOnly, setUnavailableOnly] = useState(false);
  const rows = reports.flatMap(report => fundamentalMeasures(report).map(measure => ({ company: report.company, measure })));
  const missing = rows.filter(row => row.measure.value === undefined);
  const shown = unavailableOnly ? missing : rows;
  return <details className="fundamental-coverage">
    <summary>Check measure availability ({missing.length} unavailable)</summary>
    <p className="muted small">These checks describe supported inputs for the loaded reports, not investment quality. Missing facts, unmatched periods, and nonpositive denominators are different reasons for an unavailable value. Negative income or cash flow can still be available.</p>
    <label className="coverage-filter"><input type="checkbox" checked={unavailableOnly} onChange={event => setUnavailableOnly(event.target.checked)} />Show unavailable measures only</label>
    {!shown.length ? <p>All measures have supported inputs in the loaded reports.</p> : <EvidenceTable label="Fundamentals availability"><table><caption>Measure availability and missing-input reasons</caption><thead><tr><th>Company</th><th>Measure</th><th>Availability</th><th>Explanation</th></tr></thead><tbody>
      {shown.map(({ company, measure }) => <tr key={`${company.ticker}-${measure.name}`}><th scope="row">{company.ticker}</th><td>{measure.name}</td><td>{measure.value === undefined ? 'Unavailable' : 'Available'}</td><td>{measure.unavailableReason || 'Supported inputs are available.'}</td></tr>)}
    </tbody></table></EvidenceTable>}
  </details>;
}
