import { useState } from 'react';
import EvidenceTable from './EvidenceTable';
import { compareResearchRevisions, researchRevisionChangesCsv } from './researchRevisionComparison';
import type { ResearchRevision } from './types';

export const revisionAction = (item: ResearchRevision) => item.action === 'removed' ? 'Removed from watchlist' : item.action === 'baseline' ? 'Legacy baseline captured' : 'Saved revision';
export default function ResearchRevisionComparison({ revisions }: { revisions: ResearchRevision[] }) {
  const [changesOnly, setChangesOnly] = useState(false);
  const [exportError, setExportError] = useState('');
  let comparison: ReturnType<typeof compareResearchRevisions>;
  try { comparison = compareResearchRevisions(revisions); }
  catch { return <p className="notice warning" role="alert">Choose two different research records for the same company.</p>; }
  const { earlier, later, fields, changed } = comparison;
  function download() {
    setExportError('');
    try {
      const csv = researchRevisionChangesCsv(revisions, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${earlier.entry.ticker}-research-changes-${earlier.id}-${later.id}.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setExportError('The research changes CSV could not be prepared. Please try again.'); }
  }
  return <section className="revision-comparison" aria-labelledby="revision-comparison-heading">
    <h4 id="revision-comparison-heading">Changes between saved research records</h4>
    <p className="muted small">{changed.length} of {fields.length} research fields changed. I compare exact saved text and manual marks; this does not assess research quality, explain why a change happened, or restore an old draft. Records are ordered by their recorded sequence, including removals and recreated entries.</p>
    {earlier.entry.entryId !== later.entry.entryId && <p className="notice warning">These records belong to different entry IDs. The watchlist entry was recreated; version numbers are separate sequences.</p>}
    <div className="revision-comparison-records">{([['Earlier record', earlier], ['Later record', later]] as const).map(([label, item]) => <div key={item.id}><strong>{label} · Record {item.id}</strong><p className="muted small">{revisionAction(item)} · Version {item.entry.version}<br />Recorded {new Date(item.recordedAt).toLocaleString()}<br />Entry ID: {item.entry.entryId}<br />Last saved {new Date(item.entry.updatedAt).toLocaleString()}</p></div>)}</div>
    <label className="revision-selection"><input type="checkbox" checked={changesOnly} onChange={event => setChangesOnly(event.target.checked)} />Only show changed research fields</label>
    <div className="export-actions"><button className="secondary" type="button" onClick={download}>Download research changes CSV</button><span className="muted small">Both selected records · all nine fields, including unchanged values · record IDs, events, and saved dates. Review research text before sharing.</span></div>
    {exportError && <p className="notice error" role="alert">{exportError}</p>}
    {!changed.length && <p className="muted">No research fields changed between these snapshots. Their recorded events, versions, or entry IDs can still differ.</p>}
    {(!changesOnly || changed.length > 0) && <EvidenceTable label="Research revision changes"><table className="comparison-table"><caption>Exact saved values in the two selected records</caption><thead><tr><th scope="col">Research field</th><th scope="col">Earlier record</th><th scope="col">Later record</th></tr></thead><tbody>{(changesOnly ? changed : fields).map(field => <tr key={field.label} className={field.before !== field.after ? 'revision-field-changed' : ''}><th scope="row">{field.label}{field.before !== field.after && <small className="comparison-evidence">Changed</small>}</th><td className="research-comparison-text">{field.before || 'Not recorded'}</td><td className="research-comparison-text">{field.after || 'Not recorded'}</td></tr>)}</tbody></table></EvidenceTable>}
  </section>;
}
