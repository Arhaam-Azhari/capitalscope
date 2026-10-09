import type { Company, PortfolioSummary, WatchlistEntry } from './types';
import { researchChecks, reviewedCount } from './researchChecklist';
import { reviewState } from './watchlistReview';

export function portfolioResearchRows(summary: PortfolioSummary, companies: Company[], entries: WatchlistEntry[], today: string) {
  return summary.positions.map(position => {
    const company = companies.find(item => item.ticker === position.ticker);
    const supported = summary.portfolio.mode === 'example' ? position.ticker === 'DEMO' : position.ticker !== 'DEMO' && Boolean(company);
    const entry = supported ? entries.find(item => item.ticker === position.ticker) : undefined;
    const archived = entry?.status === 'archived';
    const missingNotes = Boolean(entry && !archived && (!entry.thesis.trim() || !entry.risks.trim()));
    const openChecks = Boolean(entry && !archived && reviewedCount(entry.checks) < researchChecks.length);
    const bucket = entry ? reviewState(entry, today).bucket : null;
    const due = Boolean(entry && !archived && (bucket === 'overdue' || bucket === 'today'));
    const reasons = !supported ? ['Unsupported instrument'] : !entry ? ['No saved research'] : archived ? ['Archived research'] : [
      ...(bucket === 'overdue' ? ['Review overdue'] : bucket === 'today' ? ['Review due today'] : []),
      ...(!entry.thesis.trim() ? ['Missing thesis'] : []), ...(!entry.risks.trim() ? ['Missing risks'] : []),
      ...(openChecks ? ['Open manual checks'] : [])
    ];
    const queueGroup = !supported ? 'Unsupported instrument' : bucket === 'overdue' ? 'Overdue' : bucket === 'today' ? 'Due today'
      : !entry ? 'No saved research' : archived ? 'Archived research' : missingNotes ? 'Missing notes' : openChecks ? 'Open manual checks'
      : bucket === 'soon' ? 'Scheduled within seven days' : 'No current gaps flagged';
    return { position, company, supported, entry, archived, missingNotes, openChecks, due, bucket, reasons, queueGroup,
      needsReview: !supported || !entry || archived || missingNotes || openChecks || due };
  });
}

export function portfolioResearchQueue(rows: ReturnType<typeof portfolioResearchRows>) {
  const groups = ['Overdue', 'Due today', 'No saved research', 'Archived research', 'Missing notes', 'Open manual checks',
    'Scheduled within seven days', 'No current gaps flagged', 'Unsupported instrument'];
  // I sort a copy so changing the review order doesn't change the holding ledger or its CSV order.
  return [...rows].sort((a, b) => groups.indexOf(a.queueGroup) - groups.indexOf(b.queueGroup)
    || (a.entry?.reviewDate || '9999').localeCompare(b.entry?.reviewDate || '9999')
    || a.position.ticker.localeCompare(b.position.ticker));
}

export function filterPortfolioResearch(rows: ReturnType<typeof portfolioResearchRows>, filter: string, query: string) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(row => {
    const matches = filter === 'needs' ? row.needsReview : filter === 'due' ? row.due
      : filter === 'missing' ? row.supported && !row.entry : filter === 'notes' ? row.missingNotes
      : filter === 'checks' ? row.openChecks : filter === 'archived' ? row.archived
      : filter === 'unsupported' ? !row.supported : true;
    const description = [row.position.ticker, row.company?.name, row.company?.sector,
      row.position.ticker === 'DEMO' ? 'Fictional company' : ''].join(' ').toLocaleLowerCase();
    return matches && description.includes(search);
  });
}

function csvCell(value: string | number | boolean | null | undefined) {
  if (value == null) return '';
  if (typeof value !== 'string') return String(value);
  // I keep text from becoming a spreadsheet formula, while leaving numeric quantities as numbers.
  const safe = /^[=+@-]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function portfolioResearchCsv(summary: PortfolioSummary, rows: ReturnType<typeof portfolioResearchRows>, today: string, loadedAt: string, exportedAt: string) {
  const header = ['portfolio_id', 'portfolio_name', 'portfolio_mode', 'ticker', 'catalog_company', 'catalog_sector', 'simulated_shares',
    'supported_in_portfolio_mode', 'saved_entry_present', 'entry_id', 'entry_version', 'research_status', 'thesis', 'risks', 'review_date',
    'review_bucket', 'review_queue_group', 'review_reasons', 'research_needs_review', 'missing_active_notes', 'open_active_manual_checks', 'active_review_due', 'manual_checks_reviewed',
    ...researchChecks.map(check => `user_reviewed_${check.id}`), 'entry_created_at', 'entry_updated_at', 'local_review_day', 'browser_time_zone',
    'saved_research_loaded_at', 'exported_at', 'export_scope', 'notes_origin'];
  const records = rows.map(row => {
    const entry = row.entry;
    return [summary.portfolio.id, summary.portfolio.name, summary.portfolio.mode, row.position.ticker,
      row.position.ticker === 'DEMO' ? 'Fictional company' : row.company?.name, row.company?.sector, row.position.quantity,
      row.supported, Boolean(entry), entry?.entryId, entry?.version, entry?.status, entry?.thesis, entry?.risks, entry?.reviewDate,
      row.bucket, row.queueGroup, row.reasons.join('; '), row.needsReview, row.missingNotes, row.openChecks, row.due, entry ? reviewedCount(entry.checks) : null,
      ...researchChecks.map(check => entry ? Boolean(entry.checks?.includes(check.id)) : null), entry?.createdAt, entry?.updatedAt,
      today, Intl.DateTimeFormat().resolvedOptions().timeZone, loadedAt, exportedAt,
      'All current simulated holdings; last loaded saved research; current catalog metadata; not an atomic database snapshot; excludes cash, closed positions, drafts and browser-only notes',
      'Shared user-entered notes; self-reported manual checks; no verified editor identity or research quality score'];
  });
  return [header, ...records].map(record => record.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
