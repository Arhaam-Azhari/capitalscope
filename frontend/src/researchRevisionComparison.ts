import { researchChecks } from './researchChecklist';
import { csvCell } from './csvCell';
import type { ResearchRevision } from './types';

export function compareResearchRevisions(revisions: ResearchRevision[]) {
  if (revisions.length !== 2 || revisions[0].id === revisions[1].id || revisions[0].entry.ticker !== revisions[1].entry.ticker)
    throw new Error('Choose two different research records for the same company.');
  const [earlier, later] = [...revisions].sort((a, b) => a.id - b.id);
  const fields = [
    { label: 'Research status', before: earlier.entry.status, after: later.entry.status },
    { label: 'Investment thesis', before: earlier.entry.thesis, after: later.entry.thesis },
    { label: 'Risks and evidence to check', before: earlier.entry.risks, after: later.entry.risks },
    { label: 'Next review date', before: earlier.entry.reviewDate || '', after: later.entry.reviewDate || '' },
    ...researchChecks.map(check => ({ label: check.label, before: earlier.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed', after: later.entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed' }))
  ];
  return { earlier, later, fields, changed: fields.filter(field => field.before !== field.after) };
}

export function researchRevisionChangesCsv(revisions: ResearchRevision[], exportedAt: string) {
  const { earlier, later, fields } = compareResearchRevisions(revisions);
  const recordFields = ['record_id', 'action', 'recorded_at', 'entry_id', 'version', 'entry_created_at', 'last_saved_at'];
  const header = ['schema_version', 'ticker', ...['earlier', 'later'].flatMap(side => recordFields.map(field => `${side}_${field}`)), 'research_field', 'earlier_value', 'later_value', 'changed', 'exported_at', 'scope'];
  const record = (item: ResearchRevision) => [item.id, item.action, item.recordedAt, item.entry.entryId, item.entry.version, item.entry.createdAt, item.entry.updatedAt];
  const scope = 'Two selected records ordered by recorded sequence. All research fields are included regardless of the screen filter. Values and checklist marks are saved user-entered research, not verified authorship, research quality, or historical financial evidence. Different entry IDs identify recreated entries with independent version sequences; removal events can retain unchanged values.';
  // I export the same exact field values as the comparison, including empty strings and unchanged marks.
  return [header, ...fields.map(field => ['research-revision-changes-v1', earlier.entry.ticker, ...record(earlier), ...record(later), field.label, field.before, field.after, field.before !== field.after ? 'true' : 'false', exportedAt, scope])]
    .map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
