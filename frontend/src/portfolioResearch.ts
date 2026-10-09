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
    return { position, company, supported, entry, archived, missingNotes, openChecks, due, bucket,
      needsReview: !supported || !entry || archived || missingNotes || openChecks || due };
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
    'review_bucket', 'research_needs_review', 'missing_active_notes', 'open_active_manual_checks', 'active_review_due', 'manual_checks_reviewed',
    ...researchChecks.map(check => `user_reviewed_${check.id}`), 'entry_created_at', 'entry_updated_at', 'local_review_day', 'browser_time_zone',
    'saved_research_loaded_at', 'exported_at', 'export_scope', 'notes_origin'];
  const records = rows.map(row => {
    const entry = row.entry;
    return [summary.portfolio.id, summary.portfolio.name, summary.portfolio.mode, row.position.ticker,
      row.position.ticker === 'DEMO' ? 'Fictional company' : row.company?.name, row.company?.sector, row.position.quantity,
      row.supported, Boolean(entry), entry?.entryId, entry?.version, entry?.status, entry?.thesis, entry?.risks, entry?.reviewDate,
      row.bucket, row.needsReview, row.missingNotes, row.openChecks, row.due, entry ? reviewedCount(entry.checks) : null,
      ...researchChecks.map(check => entry ? Boolean(entry.checks?.includes(check.id)) : null), entry?.createdAt, entry?.updatedAt,
      today, Intl.DateTimeFormat().resolvedOptions().timeZone, loadedAt, exportedAt,
      'All current simulated holdings; last loaded saved research; current catalog metadata; not an atomic database snapshot; excludes cash, closed positions, drafts and browser-only notes',
      'Shared user-entered notes; self-reported manual checks; no verified editor identity or research quality score'];
  });
  return [header, ...records].map(record => record.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
