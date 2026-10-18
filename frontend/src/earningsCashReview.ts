import { annualFundamentals, comparisonRatio } from './companyFundamentals';
import { csvCell } from './csvCell';
import type { FinancialReport } from './types';

type AnnualRow = ReturnType<typeof annualFundamentals>[number];
export function earningsCashReview(rows: AnnualRow[]) {
  return rows.map(row => {
    const income = row.income?.value; const operating = row.operating?.value;
    const matched = Boolean(row.revenue?.periodStart) && income !== undefined && operating !== undefined && Number.isFinite(income) && Number.isFinite(operating);
    const rawGap = matched ? operating - income : undefined;
    const gap = rawGap !== undefined && Number.isFinite(rawGap) ? rawGap : undefined;
    const ratio = matched ? comparisonRatio(operating, income) : undefined;
    const inputReason = !row.revenue?.periodStart ? 'The revenue period start is unavailable; matching cannot be established.' : !row.income ? 'No net income input matches the revenue period.' : !row.operating ? 'No operating cash flow input matches the revenue period.' : !matched ? 'An input is outside the supported numeric range.' : '';
    return { ...row, gap, ratio,
      gapReason: inputReason || (gap === undefined ? 'The difference is outside the supported numeric range.' : ''),
      ratioReason: inputReason || (income !== undefined && income <= 0 ? 'Net income must be positive for the cash-to-earnings ratio.' : ratio === undefined ? 'The ratio is outside the supported numeric range.' : '') };
  });
}
export function earningsCashReviewCsv(rows: AnnualRow[], exportedAt: string) {
  const inputFields = ['value_usd', 'period_start', 'period_end', 'filed', 'tag', 'source_url'];
  const header = ['ticker', 'company_name', 'data_mode', 'report_source', 'retrieved_at', 'period_start', 'period_end', 'ocf_minus_net_income_usd', 'ocf_to_positive_net_income_decimal', 'difference_issue', 'ratio_issue', ...['net_income', 'operating_cash_flow'].flatMap(name => inputFields.map(field => `${name}_${field}`)), 'exported_at', 'scope'];
  const scope = 'Shown revenue-anchored annual periods only. Income and operating cash flow require matching start/end dates. Difference = operating cash flow minus net income. Ratio = operating cash flow / positive net income. Neither is a quality score, free cash flow, or a working-capital reconciliation; sector and accounting differences matter.';
  return [header, ...earningsCashReview(rows).map(row => [row.report.company.ticker, row.report.company.name, row.report.dataMode, row.report.source, row.report.retrievedAt, row.revenue?.periodStart, row.revenue?.periodEnd, row.gap, row.ratio, row.gapReason, row.ratioReason, ...[row.income, row.operating].flatMap(point => [point?.value, point?.periodStart, point?.periodEnd, point?.filed, point?.tag, point?.sourceUrl]), exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
