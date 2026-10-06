export type Company = { ticker: string; name: string; sector: string };
export type Point = {
  periodStart: string | null; periodEnd: string; value: number;
  filed: string | null; accession: string | null; sourceUrl: string | null; tag: string;
};
export type Metric = { name: string; unit: string; annualValues: Point[] };
export type FinancialReport = {
  company: Company; cik: string | null; retrievedAt: string | null; servedAt: string;
  source: string; dataMode: 'sec' | 'example'; metrics: Metric[]; notes: string[];
};
export type Assumptions = {
  baseFreeCashFlow: number; growthRate: number; discountRate: number;
  terminalGrowthRate: number; years: number; netDebt: number; sharesOutstanding: number;
};
export type Valuation = {
  projections: { year: number; freeCashFlow: number; presentValue: number }[];
  terminalValue: number; presentValueOfTerminalValue: number;
  enterpriseValue: number; equityValue: number; valuePerShare: number; terminalValueShare: number;
};

export type Scenario = { id: string; ticker: string; name: string; createdAt: string;
  assumptions: Assumptions; result: Valuation; modelVersion: string };
