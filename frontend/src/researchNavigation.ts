export const tabs = ['Financials', 'Research summary', 'Valuation', 'Research notes', 'Compare companies', 'Prices', 'Portfolios', 'Watchlist'] as const;
export type Section = typeof tabs[number];
const views: Record<Section, string> = { Financials: 'financials', 'Research summary': 'summary', Valuation: 'valuation', 'Research notes': 'notes', 'Compare companies': 'compare', Prices: 'prices', Portfolios: 'portfolios', Watchlist: 'watchlist' };
export function readResearchRoute(hash = window.location.hash): { ticker: string; section: Section; error: string; peers?: string[] } {
  const fallback = { ticker: 'DEMO', section: 'Financials' as Section, error: '' };
  if (!hash || hash === '#') return fallback;
  const invalid = { ...fallback, error: 'This research link is invalid. The example workspace is open instead.' };
  if (!hash.startsWith('#research?')) return invalid;
  const params = new URLSearchParams(hash.slice('#research?'.length));
  const ticker = (params.get('company') || '').trim().toUpperCase();
  const section = tabs.find(tab => views[tab] === params.get('view'));
  if (params.getAll('company').length !== 1 || params.getAll('view').length !== 1 || !/^[A-Z0-9-]{1,16}$/.test(ticker) || !section) return invalid;
  const peers = params.has('peers') ? params.get('peers')!.split(',').map(value => value.trim().toUpperCase()) : undefined;
  if (peers && (section !== 'Compare companies' || params.getAll('peers').length !== 1 || peers.length < 2 || peers.length > 4 || new Set(peers).size !== peers.length || peers.some(value => value === 'DEMO' || !/^[A-Z0-9-]{1,16}$/.test(value)))) return invalid;
  return { ticker, section, error: '', peers };
}
export function researchLink(ticker: string, section: Section, base = window.location.href) {
  const url = new URL(base);
  // I put only navigation in the link, never thesis text, drafts, or provider credentials.
  url.username = ''; url.password = ''; url.search = ''; url.hash = `research?${new URLSearchParams({ company: ticker, view: views[section] })}`;
  return url.href;
}

export function comparisonLink(ticker: string, peers: string[], base = window.location.href) {
  const url = new URL(researchLink(ticker, 'Compare companies', base));
  const params = new URLSearchParams(url.hash.slice('#research?'.length));
  params.set('peers', peers.join(',')); url.hash = `research?${params}`;
  return url.href;
}
