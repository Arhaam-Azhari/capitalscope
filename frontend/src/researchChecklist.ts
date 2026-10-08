export const researchChecks = [
  { id: 'filings', label: 'I reviewed the latest filing', detail: 'Check the reporting period, filing date, and accounting notes.' },
  { id: 'cash_flow', label: 'I checked cash flow quality', detail: 'Revisit cash conversion, capital spending, and unusual items.' },
  { id: 'leverage', label: 'I reviewed debt and liquidity', detail: 'Check debt obligations, cash, and refinancing risks.' },
  { id: 'share_basis', label: 'I checked my valuation share basis', detail: 'Review modeled shares, dilution, and any split differences.' },
  { id: 'risks', label: 'I revisited risks to my thesis', detail: 'Look for evidence that could invalidate the investment thesis.' }
] as const;
export const reviewedCount = (checks: string[] = []) => researchChecks.filter(check => checks.includes(check.id)).length;
