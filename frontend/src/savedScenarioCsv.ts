import type { Scenario } from './types';

function text(value: string) {
  // I protect case names and other text without changing negative numeric values.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function savedScenarioCsv(items: Scenario[], exportedAt: string) {
  const header = ['ticker', 'scenario_id', 'scenario_name', 'saved_at', 'model_version', 'exported_at',
    'base_free_cash_flow_usd', 'annual_growth_rate_decimal', 'discount_rate_decimal', 'terminal_growth_rate_decimal',
    'forecast_years', 'net_debt_usd', 'shares_outstanding', 'terminal_value_usd', 'present_value_of_terminal_value_usd',
    'enterprise_value_usd', 'equity_value_usd', 'value_per_share_usd', 'terminal_value_share_decimal'];
  const rows = items.map(item => {
    const a = item.assumptions, r = item.result;
    return [...[item.ticker, item.id, item.name, item.createdAt, item.modelVersion, exportedAt].map(text),
      ...[a.baseFreeCashFlow, a.growthRate, a.discountRate, a.terminalGrowthRate, a.years, a.netDebt, a.sharesOutstanding,
        r.terminalValue, r.presentValueOfTerminalValue, r.enterpriseValue, r.equityValue, r.valuePerShare, r.terminalValueShare]
        .map(value => Number.isFinite(value) ? String(value) : '')].join(',');
  });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}
