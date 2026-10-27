import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { checkProviderEvidence, parseEvidenceOptions } from './check-provider-evidence.mjs';

const now = '2026-10-27T00:00:00Z';
const names = ['Revenue', 'Net income', 'Operating cash flow', 'Capital expenditure', 'Cash and equivalents'];
const connections = { secConfigured: true, marketPricesConfigured: true, checkedAt: now };
const financials = { company: { ticker: 'AAPL' }, dataMode: 'sec', source: 'SEC EDGAR companyfacts', retrievedAt: '2025-01-01T00:00:00Z', servedAt: now,
  metrics: names.map((name, i) => ({ name, unit: 'USD', annualValues: [{ periodEnd: '2024-12-31', filed: '2025-02-01', value: i === 1 ? -10 : 0,
    tag: 'MyFixtureTag', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1/123/' }] })) };
const prices = { ticker: 'AAPL', dataMode: 'market', source: 'Alpha Vantage daily prices', currency: 'USD', adjusted: false,
  retrievedAt: '2025-01-03T00:00:00Z', days: [{ date: '2025-01-02', close: 10 }, { date: '2025-01-01', close: 9 }] };
function fixture(body, setup = connections, code = 200) {
  const calls = [];
  return { calls, fetcher: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/data-connections')) return Response.json(setup);
    if (url.endsWith('/companies')) return Response.json([{ ticker: 'AAPL' }]);
    return Response.json(body, { status: code });
  } };
}
async function check(body, provider = 'sec', setup = connections, code = 200) {
  const service = fixture(body, setup, code);
  return { report: await checkProviderEvidence({ provider, ticker: 'AAPL' }, service.fetcher, () => now), calls: service.calls };
}

test('I require one explicit catalog-style ticker and provider, with a credential-free app origin', () => {
  assert.deepEqual(parseEvidenceOptions(['--provider', 'sec', '--ticker', 'aapl']), { baseUrl: 'http://127.0.0.1:8080', provider: 'sec', ticker: 'AAPL' });
  for (const args of [[], ['--provider', 'both', '--ticker', 'AAPL'], ['--provider', 'sec', '--ticker', 'DEMO'], ['--provider', 'sec', '--ticker', '../AAPL'], ['--provider', 'sec', '--ticker', 'AAPL', '--ticker', 'MSFT'], ['--provider', 'sec', '--ticker', 'AAPL', '--unknown', 'x']]) assert.throws(() => parseEvidenceOptions(args));
  for (const base of ['http://user:password@localhost', 'http://localhost?key=secret', 'http://localhost/path', 'file:///tmp/app', 'http://localhost/#key'])
    assert.throws(() => parseEvidenceOptions(['--provider', 'prices', '--ticker', 'AAPL', '--base-url', base]));
});

test('I stop after configuration when setup is missing and never probe an unknown catalog ticker', async () => {
  const missing = await check(financials, 'sec', { ...connections, secConfigured: false });
  assert.equal(missing.report.status, 'setup_needed'); assert.equal(missing.calls.length, 1);
  const service = fixture(financials);
  const unknown = await checkProviderEvidence({ provider: 'sec', ticker: 'ZZZZ' }, service.fetcher, () => now);
  assert.equal(unknown.status, 'not_in_catalog'); assert.equal(service.calls.length, 2);
});

test('I distinguish full, partial and empty SEC coverage while preserving old retrieval dates and valid signed facts', async () => {
  const original = JSON.stringify(financials);
  const full = await check(financials);
  assert.equal(full.report.status, 'evidence_available');
  assert.equal(full.report.evidence.retrievedAt, '2025-01-01T00:00:00Z');
  assert.equal(full.report.evidence.metrics.length, 5);
  assert.equal(full.report.evidence.metrics[0].annualPeriods, 1);
  assert.match(full.report.scope, /does not prove a fresh upstream connection/);
  assert.equal(full.calls.length, 3); assert(full.calls.every(call => call.init.redirect === 'error' && call.init.credentials === 'omit'));
  const partial = structuredClone(financials); partial.metrics[0].annualValues = [];
  assert.equal((await check(partial)).report.status, 'partial_coverage');
  const empty = structuredClone(financials); empty.metrics.forEach(metric => { metric.annualValues = []; });
  assert.equal((await check(empty)).report.status, 'no_coverage');
  assert.equal(JSON.stringify(financials), original);
});

test('I reject fictional, mismatched, duplicate and invalid SEC evidence instead of calling it coverage', async () => {
  const variants = [];
  for (const change of [body => { body.dataMode = 'example'; }, body => { body.company.ticker = 'MSFT'; }, body => { body.metrics[0].unit = 'shares'; },
    body => { body.metrics.push(body.metrics[0]); }, body => { body.metrics[0].annualValues.push(body.metrics[0].annualValues[0]); },
    body => { body.metrics[0].annualValues[0].periodEnd = '2025-02-30'; }, body => { body.metrics[0].annualValues[0].sourceUrl = 'https://www.sec.gov/Archives/edgar/data/1/?key=my-private-key'; },
    body => { body.retrievedAt = '2025-02-30T00:00:00Z'; }, body => { body.metrics[0].annualValues[0].filed = null; }, body => { body.metrics[0].annualValues = [null]; }]) {
    const body = structuredClone(financials); change(body); variants.push(body);
  }
  for (const body of variants) { const { report } = await check(body); assert.equal(report.status, 'invalid_response'); assert.equal(report.evidence, null); }
});

test('I report dated raw price coverage without interpreting it as fresh or adjusted returns', async () => {
  const { report, calls } = await check(prices, 'prices');
  assert.equal(report.status, 'evidence_available');
  assert.deepEqual(report.evidence, { dataMode: 'market', currency: 'USD', adjusted: false, retrievedAt: prices.retrievedAt, observations: 2, firstDate: '2025-01-01', lastDate: '2025-01-02' });
  assert(calls.at(-1).url.endsWith('/AAPL/prices'));
  assert.equal((await check({ ...prices, days: [] }, 'prices')).report.status, 'no_coverage');
  for (const body of [{ ...prices, dataMode: 'example' }, { ...prices, ticker: 'MSFT' }, { ...prices, adjusted: true }, { ...prices, days: [prices.days[0], prices.days[0]] },
    { ...prices, days: [null] }, { ...prices, days: [{ date: '2025-02-30', close: 1 }] }, { ...prices, days: [{ date: '2025-01-01', close: 0 }] }])
    assert.equal((await check(body, 'prices')).report.status, 'invalid_response');
});

test('I keep raw HTTP, transport and JSON errors out of the report', async () => {
  const failed = await check({ error: 'my-private-key and private@example.com' }, 'sec', connections, 503);
  assert.equal(failed.report.status, 'request_failed'); assert.equal(failed.report.httpStatus, 503);
  assert(!JSON.stringify(failed.report).includes('my-private-key'));
  assert(!JSON.stringify(failed.report).includes('private@example.com'));
  const transport = await checkProviderEvidence({ provider: 'prices', ticker: 'AAPL' }, async () => { throw new Error('https://example.com?apikey=my-private-key'); }, () => now);
  assert.equal(transport.status, 'request_failed'); assert.equal(transport.httpStatus, null); assert(!JSON.stringify(transport).includes('my-private-key'));
  const invalid = await checkProviderEvidence({ provider: 'sec', ticker: 'AAPL' }, async () => new Response('my-private-key', { status: 200 }), () => now);
  assert.equal(invalid.status, 'invalid_response'); assert(!JSON.stringify(invalid).includes('my-private-key'));
});

test('I return a machine-readable CLI report and incomplete exit code without sending provider requests', async () => {
  const paths = [];
  const server = createServer((req, res) => { paths.push(req.url); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ...connections, secConfigured: false })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const cli = spawn(process.execPath, ['scripts/check-provider-evidence.mjs', '--provider', 'sec', '--ticker', 'AAPL', '--base-url', `http://127.0.0.1:${server.address().port}`]);
    let output = ''; cli.stdout.on('data', chunk => { output += chunk; });
    const code = await new Promise((resolve, reject) => { cli.once('error', reject); cli.once('exit', resolve); });
    assert.equal(code, 2); assert.equal(JSON.parse(output).status, 'setup_needed'); assert.deepEqual(paths, ['/api/data-connections']);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
