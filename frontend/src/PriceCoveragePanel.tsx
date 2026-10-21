import EvidenceTable from './EvidenceTable';
import { useState } from 'react';
import { priceCoverageCsv, type priceComparisonCoverage } from './priceComparison';
import { money } from './api';
import type { PriceHistory } from './types';

export default function PriceCoveragePanel({ current, reference, coverage, calculatedAt }: { current: PriceHistory; reference: PriceHistory; coverage: ReturnType<typeof priceComparisonCoverage>; calculatedAt: string }) {
  const [error, setError] = useState('');
  function download() {
    try {
      const csv = priceCoverageCsv(current, reference, coverage, calculatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${current.ticker}-${reference.ticker}-price-coverage.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError('');
    } catch { setError('The price coverage CSV could not be prepared. Please try again.'); }
  }
  return <section aria-labelledby="price-coverage-heading">
    <h4 id="price-coverage-heading">Price comparison coverage</h4>
    <p className="muted small">{coverage.shared} shared dates from {coverage.rows.length} distinct stored dates in this window. Shared coverage: {current.ticker} {coverage.currentSharedPercent.toFixed(2)}% of {coverage.currentWindow.rows.length} loaded observations; {reference.ticker} {coverage.referenceSharedPercent.toFixed(2)}% of {coverage.referenceWindow.rows.length}. This is overlap of loaded snapshots, not completeness against an exchange calendar. A dash means no close in that snapshot; it does not mean a zero price or prove that an exchange observation is missing.</p>
    <p className="muted small">Maximum raw-close decline on each company's own window dates: {current.ticker} {coverage.currentWindow.maximumDeclinePercent.toFixed(2)}%; {reference.ticker} {coverage.referenceWindow.maximumDeclinePercent.toFixed(2)}%. These are coverage diagnostics with different observation sets, separate from the shared-date comparison.</p>
    <details><summary>Inspect shared and excluded price dates</summary><EvidenceTable label="Price date coverage"><table><caption>Price date coverage, oldest first</caption><thead><tr><th scope="col">Date</th><th scope="col">{current.ticker} raw close</th><th scope="col">{reference.ticker} raw close</th><th scope="col">Alignment</th></tr></thead><tbody>{coverage.rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{row.currentClose === null ? '—' : money(row.currentClose, false)}</td><td>{row.referenceClose === null ? '—' : money(row.referenceClose, false)}</td><td>{row.included ? 'Shared date' : `No stored close for ${row.currentClose === null ? current.ticker : reference.ticker}`}</td></tr>)}</tbody></table></EvidenceTable></details>
    <div className="export-actions"><button className="secondary" onClick={download}>Download price coverage CSV</button><p className="muted small">Exports every stored date in the window union, blank unavailable closes, alignment reasons, coverage definitions, and each source snapshot.</p></div>
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
