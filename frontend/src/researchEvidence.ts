import type { Company, FinancialReport, ValuationPriceEvidence, WatchlistEntry } from './types';

type EvidenceInput = { company: Company; report: FinancialReport | null; financialError: string; entry: WatchlistEntry | null; notesError: string; context: ValuationPriceEvidence | null; contextError: string; exportedAt: string };
export function researchEvidence(input: EvidenceInput) {
  const { company, exportedAt } = input;
  const example = company.ticker === 'DEMO';
  const report = input.report?.company.ticker === company.ticker && input.report.dataMode === (example ? 'example' : 'sec') ? input.report : null;
  const entry = input.entry?.ticker === company.ticker ? input.entry : null;
  const context = input.context?.ticker === company.ticker && input.context.dataMode === (example ? 'example' : 'market') ? input.context : null;
  const financialReason = input.financialError || (!report ? 'Matching financial facts are unavailable.' : '');
  const notesReason = input.notesError || (input.entry && !entry ? 'Saved research does not match this company.' : '');
  const contextReason = input.contextError || (!context ? 'Matching saved price and valuation evidence is unavailable.' : '');
  return {
    exportVersion: 'company-research-evidence-v1', exportedAt, company, dataMode: example ? 'example' : 'real-company',
    scope: 'Evidence already loaded in this company summary, captured without fetching or saving data. Sections retain different dates; this is not an atomic or point-in-time market snapshot. Financial facts include loaded annual history. Valuation summaries exclude full assumptions and do not include value-versus-close gaps. Unsaved drafts and browser-only notes are excluded. This file can contain saved thesis and risk text; review it before sharing. No investment recommendation.',
    financialFacts: { status: financialReason ? 'unavailable' : 'available', reason: financialReason || null, data: financialReason ? null : report },
    savedResearch: { status: notesReason ? 'unavailable' : entry ? 'available' : 'not_saved', reason: notesReason || null, source: 'Shared watchlist; user-entered research', data: notesReason ? null : entry },
    storedClose: { status: contextReason || !context?.quote ? 'unavailable' : 'available', reason: contextReason || (!context?.quote ? context?.quoteError || 'No stored close is available.' : null), evaluatedAt: context?.evaluatedAt || null, data: contextReason ? null : context?.quote || null },
    savedValuationSummaries: { status: contextReason ? 'unavailable' : context?.scenarios.length ? 'available' : 'not_saved', reason: contextReason || null, evaluatedAt: context?.evaluatedAt || null,
      data: context && !contextReason ? context.scenarios.map(item => ({ id: item.id, name: item.name, createdAt: item.createdAt, modelVersion: item.modelVersion, modeledShares: item.modeledShares, valuePerShare: item.valuePerShare })) : null }
  };
}
