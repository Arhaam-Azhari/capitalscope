import { pathToFileURL } from 'node:url';

const metrics = ['Revenue', 'Net income', 'Operating cash flow', 'Capital expenditure', 'Cash and equivalents'];
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && date(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const number = value => typeof value === 'number' && Number.isFinite(value);
const invalid = () => { throw new Error('invalid_response'); };

export function parseEvidenceOptions(args) {
  const options = { baseUrl: 'http://127.0.0.1:8080' }, seen = new Set();
  const names = { '--base-url': 'baseUrl', '--provider': 'provider', '--ticker': 'ticker' };
  for (let i = 0; i < args.length; i += 2) {
    if (!names[args[i]] || seen.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('usage');
    seen.add(args[i]); options[names[args[i]]] = args[i + 1];
  }
  options.ticker = options.ticker?.trim().toUpperCase();
  if (!['sec', 'prices'].includes(options.provider) || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(options.ticker || '') || options.ticker === 'DEMO') throw new Error('usage');
  let url;
  try { url = new URL(options.baseUrl); } catch { throw new Error('usage'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('usage');
  options.baseUrl = url.origin;
  return options;
}

function secEvidence(body, ticker) {
  if (body?.dataMode !== 'sec' || body.company?.ticker !== ticker || body.source !== 'SEC EDGAR companyfacts'
    || !instant(body.retrievedAt) || !instant(body.servedAt) || !Array.isArray(body.metrics)) invalid();
  const coverage = metrics.map(name => {
    const candidates = body.metrics.filter(metric => metric?.name === name);
    if (candidates.length !== 1 || candidates[0].unit !== 'USD' || !Array.isArray(candidates[0].annualValues)) invalid();
    const values = candidates[0].annualValues;
    const periods = new Set();
    for (const point of values) {
      let source;
      try { source = new URL(point?.sourceUrl); } catch { invalid(); }
      if (!date(point.periodEnd) || !date(point.filed) || !number(point.value) || !point.tag || typeof point.tag !== 'string'
        || periods.has(point.periodEnd) || source.protocol !== 'https:' || source.hostname !== 'www.sec.gov'
        || !source.pathname.startsWith('/Archives/edgar/data/') || source.username || source.password || source.search || source.hash) invalid();
      periods.add(point.periodEnd);
    }
    return { metric: name, annualPeriods: values.length, latestPeriodEnd: [...periods].sort().at(-1) || null };
  });
  const available = coverage.filter(item => item.annualPeriods > 0).length;
  return { status: available === 0 ? 'no_coverage' : available === metrics.length ? 'evidence_available' : 'partial_coverage',
    evidence: { dataMode: 'sec', currency: 'USD', retrievedAt: body.retrievedAt, servedAt: body.servedAt, metrics: coverage } };
}

function priceEvidence(body, ticker) {
  if (body?.ticker !== ticker || body.dataMode !== 'market' || body.currency !== 'USD' || body.adjusted !== false
    || body.source !== 'Alpha Vantage daily prices' || !instant(body.retrievedAt) || !Array.isArray(body.days)) invalid();
  const dates = new Set();
  for (const day of body.days) {
    if (!date(day?.date) || dates.has(day.date) || !number(day.close) || day.close <= 0) invalid();
    dates.add(day.date);
  }
  const ordered = [...dates].sort();
  return { status: ordered.length ? 'evidence_available' : 'no_coverage', evidence: { dataMode: 'market', currency: 'USD', adjusted: false,
    retrievedAt: body.retrievedAt, observations: ordered.length, firstDate: ordered[0] || null, lastDate: ordered.at(-1) || null } };
}

export async function checkProviderEvidence(options, fetcher = fetch, now = () => new Date().toISOString()) {
  const { baseUrl, provider, ticker } = parseEvidenceOptions(['--base-url', options.baseUrl ?? 'http://127.0.0.1:8080', '--provider', options.provider, '--ticker', options.ticker]);
  const report = { schemaVersion: 'provider-evidence-check-v1', appOrigin: baseUrl, ticker, provider, startedAt: now(), completedAt: null,
    status: 'request_failed', providerConfigured: null, configurationCheckedAt: null, httpStatus: null, evidence: null,
    scope: 'One selected company and provider. API reads may use cached snapshots and may import/cache data when configured. This does not prove a fresh upstream connection, current prices, all-company coverage, or investment suitability. No credentials or raw provider errors are included.' };
  async function read(path) {
    const response = await fetcher(`${baseUrl}${path}`, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(45000) });
    report.httpStatus = response.status;
    if (!response.ok) throw new Error('request_failed');
    try { return await response.json(); } catch { invalid(); }
  }
  try {
    const connections = await read('/api/data-connections');
    if (typeof connections?.secConfigured !== 'boolean' || typeof connections?.marketPricesConfigured !== 'boolean' || !instant(connections.checkedAt)) invalid();
    report.providerConfigured = provider === 'sec' ? connections.secConfigured : connections.marketPricesConfigured;
    report.configurationCheckedAt = connections.checkedAt;
    if (!report.providerConfigured) report.status = 'setup_needed';
    else {
      const catalog = await read('/api/companies');
      if (!Array.isArray(catalog)) invalid();
      if (!catalog.some(item => item?.ticker === ticker)) report.status = 'not_in_catalog';
      else {
        const body = await read(`/api/companies/${encodeURIComponent(ticker)}/${provider === 'sec' ? 'financials' : 'prices'}`);
        Object.assign(report, provider === 'sec' ? secEvidence(body, ticker) : priceEvidence(body, ticker));
      }
    }
  } catch (error) {
    // I report fixed categories instead of echoing a response body, contact address, key, or URL.
    report.status = error?.message === 'invalid_response' ? 'invalid_response' : 'request_failed';
  }
  report.completedAt = now();
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseEvidenceOptions(process.argv.slice(2));
    const report = await checkProviderEvidence(options);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'evidence_available' ? 0 : 2;
  } catch {
    console.error('I use: npm run check:provider -- --provider sec|prices --ticker AAPL [--base-url http://127.0.0.1:8080]. I choose one catalog ticker and omit credentials from the URL.');
    process.exitCode = 1;
  }
}
