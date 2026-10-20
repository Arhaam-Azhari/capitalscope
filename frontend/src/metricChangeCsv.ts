import { csvCell } from './csvCell';
import { metricChange } from './metricChange';
import type { FinancialReport, Point } from './types';

export function metricChangeCsv(report: FinancialReport, exportedAt: string) {
  const inputFields = ['reported_value', 'period_start', 'period_end', 'filed', 'accession', 'tag', 'source_url'];
  const header = ['schema_version', 'ticker', 'company_name', 'sector', 'data_mode', 'report_source', 'retrieved_at', 'served_at', 'exported_at', 'metric', 'reported_unit', 'comparison_kind', 'dollar_change_usd', 'percentage_change_percent', 'dollar_change_availability', 'percentage_change_availability', 'dollar_change_issue', 'percentage_change_issue',
    ...['latest', 'prior'].flatMap(name => inputFields.map(field => `${name}_${field}`)), 'dollar_change_formula', 'percentage_change_formula', 'scope'];
  const scope = 'All loaded metrics, one latest-year comparison per metric. USD only; a unique prior end 300–400 days earlier is required. Annual flows need known starts, 300–400 days per window, and at most a 7-day duration difference. Cash compares dated balances. Percentages require a positive prior value and use percentage units, not decimal ratios. Unavailable results are blank, not zero. No annualization or adjustments for acquisitions, inflation, calendar or accounting changes; no stock return or performance rating. Input metadata is preserved as loaded, not verified authorship or point-in-time evidence.';
  const input = (point?: Point) => [point && Number.isFinite(point.value) ? point.value : undefined, point?.periodStart, point?.periodEnd, point?.filed, point?.accession, point?.tag, point?.sourceUrl];
  // I use the same comparison rules as the screen and keep unavailable results separate from zero.
  const rows = report.metrics.map(metric => {
    const change = metricChange(metric);
    return ['reported-metric-changes-v1', report.company.ticker, report.company.name, report.company.sector, report.dataMode, report.source, report.retrievedAt, report.servedAt, exportedAt,
      metric.name, metric.unit, change.balance ? 'dated_balance' : 'annual_flow', change.amount, change.percentage,
      change.amount === undefined ? 'unavailable' : 'available', change.percentage === undefined ? 'unavailable' : 'available', change.reason, change.reason || change.percentageReason,
      ...input(change.latest), ...input(change.prior), 'latest - prior', '(latest - prior) / positive prior * 100', scope];
  });
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
