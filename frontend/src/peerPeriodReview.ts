import { companyFundamentals } from './companyFundamentals';
import { csvCell } from './csvCell';
import type { FinancialReport } from './types';

function day(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : undefined;
}
export function peerPeriodReview(reports: FinancialReport[]) {
  const rows = reports.map(report => {
    const revenue = companyFundamentals(report).revenue;
    const start = day(revenue?.periodStart); const end = day(revenue?.periodEnd);
    const days = start !== undefined && end !== undefined && end >= start ? end - start + 1 : undefined;
    const reason = !revenue ? 'No supported annual revenue input.' : end === undefined ? 'The revenue period end is missing or invalid.' : start === undefined ? 'The revenue period start is missing or invalid.' : days === undefined ? 'The revenue period ends before it starts.' : '';
    return { report, revenue, start, end, days, reason };
  });
  const ends = rows.flatMap(row => row.end === undefined ? [] : [row.end]);
  const newest = ends.length ? Math.max(...ends) : undefined;
  const dated = rows.filter(row => row.days !== undefined);
  return {
    rows: rows.map(row => ({ ...row, endLagDays: row.end !== undefined && newest !== undefined ? newest - row.end : undefined })),
    endSpreadDays: ends.length >= 2 ? Math.max(...ends) - Math.min(...ends) : undefined,
    completePeriods: dated.length,
    sameWindow: rows.length >= 2 && dated.length === rows.length && dated.every(row => row.start === dated[0].start && row.end === dated[0].end),
    sectors: [...new Set(reports.map(report => report.company.sector))]
  };
}
export function peerPeriodReviewCsv(reports: FinancialReport[], failures: string[], exportedAt: string) {
  const header = ['ticker', 'company_name', 'sector', 'data_mode', 'report_source', 'retrieved_at', 'period_start', 'period_end', 'inclusive_period_days', 'end_lag_days_vs_newest_loaded_peer', 'period_issue', 'filed', 'tag', 'source_url', 'exported_at', 'load_failures', 'scope'];
  const scope = 'Loaded reports only. Latest supported USD annual revenue periods; inclusive calendar days. End-date lag is relative to the newest valid loaded peer end, not today or the filing date. No calendarization, annualization, currency conversion, or assurance of accounting/business comparability.';
  return [header, ...peerPeriodReview(reports).rows.map(row => [row.report.company.ticker, row.report.company.name, row.report.company.sector, row.report.dataMode, row.report.source, row.report.retrievedAt, row.revenue?.periodStart, row.revenue?.periodEnd, row.days, row.endLagDays, row.reason, row.revenue?.filed, row.revenue?.tag, row.revenue?.sourceUrl, exportedAt, failures.join(' | '), scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
