import type { FinancialReport, Point } from './types';

function points(report: FinancialReport, name: string) {
  return report.metrics.find(metric => metric.name === name && metric.unit === 'USD')?.annualValues || [];
}
function aligned(report: FinancialReport, name: string, revenue: Point | undefined) {
  return revenue && points(report, name).find(point => point.periodStart === revenue.periodStart && point.periodEnd === revenue.periodEnd);
}
export function comparisonRatio(numerator: number | undefined, denominator: number | undefined) {
  if (numerator === undefined || denominator === undefined || denominator <= 0) return undefined;
  const value = numerator / denominator;
  return Number.isFinite(value) && Number.isFinite(value * 100) ? value : undefined;
}
export function companyFundamentals(report: FinancialReport) {
  const revenue = points(report, 'Revenue')[0];
  const income = aligned(report, 'Net income', revenue);
  const operating = aligned(report, 'Operating cash flow', revenue);
  const capex = aligned(report, 'Capital expenditure', revenue);
  const prior = revenue && points(report, 'Revenue').find(point => {
    const days = (Date.parse(revenue.periodEnd) - Date.parse(point.periodEnd)) / 86400000;
    return days >= 300 && days <= 400;
  });
  const difference = operating && capex ? operating.value - capex.value : undefined;
  const afterCapex = difference !== undefined && Number.isFinite(difference) ? difference : undefined;
  return { report, revenue, income, operating, capex, prior, afterCapex };
}
function text(value: string) {
  // I protect spreadsheet text while keeping negative numeric values numeric.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function fundamentalMeasures(report: FinancialReport) {
  const { revenue, income, operating, capex, prior, afterCapex } = companyFundamentals(report);
  const measures: { name: string; value: number | undefined; unit: string; calculation: string; inputs: (Point | undefined)[] }[] = [
      { name: 'Revenue', value: revenue?.value, unit: 'USD', calculation: 'input_1', inputs: [revenue] },
      { name: 'Annual revenue growth', value: comparisonRatio(revenue && prior ? revenue.value - prior.value : undefined, prior?.value), unit: 'decimal fraction', calculation: '(input_1 - input_2) / input_2', inputs: [revenue, prior] },
      { name: 'Net income margin', value: comparisonRatio(income?.value, revenue?.value), unit: 'decimal fraction', calculation: 'input_1 / input_2', inputs: [income, revenue] },
      { name: 'Operating cash flow margin', value: comparisonRatio(operating?.value, revenue?.value), unit: 'decimal fraction', calculation: 'input_1 / input_2', inputs: [operating, revenue] },
      { name: 'Cash after capex', value: afterCapex, unit: 'USD', calculation: 'input_1 - input_2', inputs: [operating, capex] },
      { name: 'Cash after capex / revenue', value: comparisonRatio(afterCapex, revenue?.value), unit: 'decimal fraction', calculation: '(input_1 - input_2) / input_3', inputs: [operating, capex, revenue] }
    ];
  function missingInput(name: string) {
    return points(report, name).length ? `${name} does not match the annual revenue period.` : `No supported USD annual ${name.toLowerCase()} input.`;
  }
  function reason(name: string) {
    if (!revenue) return 'No supported USD annual revenue input.';
    if (name === 'Annual revenue growth') {
      if (!prior) return 'No prior revenue period ends 300–400 days earlier.';
      if (prior.value <= 0) return 'Prior revenue must be positive for growth.';
    }
    if (name === 'Net income margin' && !income) return missingInput('Net income');
    if (['Operating cash flow margin', 'Cash after capex', 'Cash after capex / revenue'].includes(name) && !operating) return missingInput('Operating cash flow');
    if (['Cash after capex', 'Cash after capex / revenue'].includes(name) && !capex) return missingInput('Capital expenditure');
    if (['Net income margin', 'Operating cash flow margin', 'Cash after capex / revenue'].includes(name) && revenue.value <= 0) return 'Annual revenue must be positive for this ratio.';
    return 'The result is outside the supported numeric range.';
  }
  return measures.map(measure => {
    const value = measure.value !== undefined && Number.isFinite(measure.value) ? measure.value : undefined;
    return { ...measure, value, unavailableReason: value === undefined ? reason(measure.name) : '' };
  });
}

export function companyComparisonCsv(reports: FinancialReport[], failures: string[], exportedAt: string) {
  const inputFields = ['value_usd', 'period_start', 'period_end', 'filed', 'tag', 'source_url'];
  const header = ['ticker', 'company_name', 'sector', 'data_mode', 'report_source', 'retrieved_at', 'exported_at', 'load_failures', 'measure', 'value', 'unit', 'calculation', ...[1, 2, 3].flatMap(index => inputFields.map(field => `input_${index}_${field}`)), 'availability', 'unavailable_reason'];
  const rows = reports.flatMap(report => {
    const measures = fundamentalMeasures(report);
    return measures.map(measure => [
      ...[report.company.ticker, report.company.name, report.company.sector, report.dataMode, report.source, report.retrievedAt || '', exportedAt, failures.join('\n'), measure.name].map(text),
      measure.value === undefined ? '' : String(measure.value), text(measure.unit), text(measure.calculation),
      ...[0, 1, 2].flatMap(index => {
        const point = measure.inputs[index];
        return [point ? String(point.value) : '', ...[point?.periodStart || '', point?.periodEnd || '', point?.filed || '', point?.tag || '', point?.sourceUrl || ''].map(text)];
      }), text(measure.value === undefined ? 'unavailable' : 'available'), text(measure.unavailableReason)
    ].join(','));
  });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export function annualFundamentals(report: FinancialReport) {
  const revenue = points(report, 'Revenue');
  return revenue.map((_, index) => companyFundamentals({ ...report,
    metrics: report.metrics.map(metric => metric.name === 'Revenue' && metric.unit === 'USD'
      ? { ...metric, annualValues: revenue.slice(index) } : metric)
  }));
}
