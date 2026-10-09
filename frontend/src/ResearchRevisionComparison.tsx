import { useState } from 'react';
import { researchChecks } from './researchChecklist';
import type { ResearchRevision } from './types';

export const revisionAction = (item: ResearchRevision) => item.action === 'removed' ? 'Removed from watchlist' : item.action === 'baseline' ? 'Legacy baseline captured' : 'Saved revision';
export default function ResearchRevisionComparison({ revisions }: { revisions: ResearchRevision[] }) {
  const [changesOnly, setChangesOnly] = useState(false);
  const [earlier, later] = [...revisions].sort((a, b) => a.id - b.id);
  if (!earlier || !later) return null;
  const fields = [
    { label: 'Research status', before: earlier.entry.status, after: later.entry.status },
    { label: 'Investment thesis', before: earlier.entry.thesis, after: later.entry.thesis },
    { label: 'Risks and evidence to check', before: earlier.entry.risks, after: later.entry.risks },
    { label: 'Next review date', before: earlier.entry.reviewDate || '', after: later.entry.reviewDate || '' },
    ...researchChecks.map(check => ({ label: check.label, before: earlier.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed', after: later.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed' }))
  ];
  const changed = fields.filter(field => field.before !== field.after);
  return <section className="revision-comparison" aria-labelledby="revision-comparison-heading">
    <h4 id="revision-comparison-heading">Changes between saved research records</h4>
    <p className="muted small">{changed.length} of {fields.length} research fields changed. I compare exact saved text and manual marks; this does not assess research quality, explain why a change happened, or restore an old draft. Records are ordered by their recorded sequence, including removals and recreated entries.</p>
    {earlier.entry.entryId !== later.entry.entryId && <p className="notice warning">These records belong to different entry IDs. The watchlist entry was recreated; version numbers are separate sequences.</p>}
    <div className="revision-comparison-records">{([['Earlier record', earlier], ['Later record', later]] as const).map(([label, item]) => <div key={item.id}><strong>{label} · Record {item.id}</strong><p className="muted small">{revisionAction(item)} · Version {item.entry.version}<br />Recorded {new Date(item.recordedAt).toLocaleString()}<br />Entry ID: {item.entry.entryId}<br />Last saved {new Date(item.entry.updatedAt).toLocaleString()}</p></div>)}</div>
    <label className="revision-selection"><input type="checkbox" checked={changesOnly} onChange={event => setChangesOnly(event.target.checked)} />Only show changed research fields</label>
    {!changed.length && <p className="muted">No research fields changed between these snapshots. Their recorded events, versions, or entry IDs can still differ.</p>}
    {(!changesOnly || changed.length > 0) && <div className="table-scroll"><table className="comparison-table"><caption>Exact saved values in the two selected records</caption><thead><tr><th>Research field</th><th>Earlier record</th><th>Later record</th></tr></thead><tbody>{(changesOnly ? changed : fields).map(field => <tr key={field.label} className={field.before !== field.after ? 'revision-field-changed' : ''}><th scope="row">{field.label}{field.before !== field.after && <small className="comparison-evidence">Changed</small>}</th><td className="research-comparison-text">{field.before || 'Not recorded'}</td><td className="research-comparison-text">{field.after || 'Not recorded'}</td></tr>)}</tbody></table></div>}
  </section>;
}
