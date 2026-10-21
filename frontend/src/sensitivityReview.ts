import { csvCell } from './csvCell';
import type { Assumptions, Company } from './types';

export type SensitivityGrid = { terminalGrowthRates: number[]; rows: { discountRate: number; cells: {
  terminalGrowthRate: number; valuePerShare: number | null; error: string | null; baseCase: boolean;
}[] }[] };

export function sensitivityReview(grid: SensitivityGrid) {
  const cells = grid.rows.flatMap(row => row.cells.map(cell => {
    const available = !cell.error && cell.valuePerShare !== null && Number.isFinite(cell.valuePerShare)
      && Number.isFinite(row.discountRate) && Number.isFinite(cell.terminalGrowthRate);
    return { ...cell, discountRate: row.discountRate, available,
      issue: available ? '' : cell.error || 'The modeled value or rates are outside the supported numeric range.' };
  }));
  const valid = cells.filter(cell => cell.available);
  // I keep the first tied cell in grid order rather than suggesting one scenario is more likely.
  const low = valid.reduce<typeof valid[number] | undefined>((best, cell) => !best || cell.valuePerShare! < best.valuePerShare! ? cell : best, undefined);
  const high = valid.reduce<typeof valid[number] | undefined>((best, cell) => !best || cell.valuePerShare! > best.valuePerShare! ? cell : best, undefined);
  return { cells, valid: valid.length, unavailable: cells.length - valid.length, low, high };
}

export function sensitivityCsv(company: Company, assumptions: Assumptions, grid: SensitivityGrid, evaluatedAt: string, exportedAt: string) {
  const header = ['schema_version', 'ticker', 'company_name', 'input_mode', 'model_version', 'evaluated_at', 'exported_at', 'base_free_cash_flow_usd', 'forecast_growth_decimal', 'forecast_years', 'net_debt_usd', 'shares_outstanding', 'base_discount_rate_decimal', 'base_terminal_growth_decimal', 'cell_discount_rate_decimal', 'cell_terminal_growth_decimal', 'base_case', 'modeled_value_per_share_usd', 'availability', 'unavailable_reason', 'scope'];
  const scope = 'Fresh FCFF sensitivity of user-entered inputs, not a stored historical grid, source financial evidence, probability distribution, confidence interval, or market price target. Rates are decimal fractions. Starting cash flow, forecast growth, horizon, net debt and shares stay fixed; each cell varies only WACC and terminal growth. Unavailable estimates are blank, not zero. Fictional example inputs remain labeled.';
  return [header, ...sensitivityReview(grid).cells.map(cell => ['dcf-sensitivity-v1', company.ticker, company.name, company.ticker === 'DEMO' ? 'fictional_example' : 'user_assumptions', 'fcff-v1', evaluatedAt, exportedAt,
    assumptions.baseFreeCashFlow, assumptions.growthRate, assumptions.years, assumptions.netDebt, assumptions.sharesOutstanding, assumptions.discountRate, assumptions.terminalGrowthRate,
    Number.isFinite(cell.discountRate) ? cell.discountRate : undefined, Number.isFinite(cell.terminalGrowthRate) ? cell.terminalGrowthRate : undefined,
    cell.baseCase ? 'true' : 'false', cell.available ? cell.valuePerShare : undefined, cell.available ? 'available' : 'unavailable', cell.issue, scope])]
    .map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
