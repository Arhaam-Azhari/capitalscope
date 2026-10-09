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

export type PriceHistory = { ticker: string; currency: string; adjusted: boolean; dataMode: 'market' | 'example';
  source: string; sourceUrl: string | null; retrievedAt: string | null;
  days: { date: string; open: number; high: number; low: number; close: number; volume: number }[] };

export type Portfolio = { id: string; name: string; mode: 'example' | 'market'; initialCash: number; createdAt: string };
export type PortfolioSummary = { portfolio: Portfolio; cash: number; realizedPnl: number; dividendIncome: number;
  events: { requestId: string; kind: 'TRADE' | 'SPLIT' | 'DIVIDEND'; ticker: string; value: number | null; denominator: number | null; recordedAt: string }[];
  positions: { ticker: string; quantity: number; costBasis: number; averageCost: number }[];
  trades: { requestId: string; ticker: string; side: string; quantity: number; price: number; fee: number; recordedAt: string }[] };

export type PortfolioMarks = { portfolioId: string; dataMode: 'example' | 'market'; evaluatedAt: string; cash: number;
  pricedPositions: number; totalPositions: number; complete: boolean; pricedHoldingsValue: number;
  totalValue: number | null; unrealizedPnl: number | null; allocation: PortfolioAllocation; holdings: { ticker: string; quantity: number; costBasis: number;
    close: number | null; priceDate: string | null; priceAgeDays: number | null; source: string | null; sourceUrl: string | null;
    retrievedAt: string | null; value: number | null; unrealizedPnl: number | null; error: string | null }[] };

export type WatchlistEntry = { entryId: string; ticker: string; status: 'watching' | 'researching' | 'archived'; thesis: string; risks: string; reviewDate: string | null; version: number; createdAt: string; updatedAt: string; checks?: string[] };

export type Exposure = { label: string; value: number | null; weight: number | null };
export type PortfolioAllocation = { available: boolean; unavailableReason: string | null; cashWeight: number | null;
  largestHolding: Exposure | null; largestSector: Exposure | null; topThreeHoldingsWeight: number | null;
  companies: Exposure[]; sectors: Exposure[] };

export type ValuationPriceEvidence = { ticker: string; dataMode: string; evaluatedAt: string; shareBasisConfirmed: boolean;
  quote: { close: number; priceDate: string; priceAgeDays: number; source: string; sourceUrl: string | null; retrievedAt: string | null } | null;
  quoteError: string | null; scenarios: { id: string; name: string; createdAt: string; modelVersion: string; modeledShares: number | null;
    valuePerShare: number | null; valueMinusClose: number | null; relativeGap: number | null; unavailableReason: string | null }[] };

export type ResearchRevision = { id: number; action: 'saved' | 'removed' | 'baseline'; recordedAt: string; entry: WatchlistEntry };
export type ResearchHistory = { items: ResearchRevision[]; nextBefore: number | null };
