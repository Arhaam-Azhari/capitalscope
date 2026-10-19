import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const [base, recordPath, mode] = process.argv.slice(2);
async function json(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}${path}`, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!response.ok) throw new Error(`I received ${response.status} from ${path}.`);
  return response.json();
}
const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
const html = await (await fetch(base)).text();
const asset = html.match(/src="([^\"]+\.js)"/)?.[1];
assert(html.includes('CapitalScope') && asset, 'I could not find the packaged dashboard.');
const bundle = await fetch(`${base}${asset}`);
assert(bundle.ok && (await bundle.text()).length > 0, 'I could not read the packaged entry script.');
assert((await json('/api/companies')).length === 50, 'I did not receive the complete catalog.');
assert((await json('/api/examples/financials')).dataMode === 'example', 'I did not receive labeled example facts.');
const valuation = await json('/api/valuations/dcf', { baseFreeCashFlow: 100, growthRate: 0, discountRate: .1, terminalGrowthRate: 0, years: 5, netDebt: 100, sharesOutstanding: 10 });
assert(Math.abs(valuation.valuePerShare - 90) < 1e-8, 'My packaged valuation check failed.');
for (const path of ['/api/companies/AAPL/financials', '/api/companies/AAPL/prices']) {
  const response = await fetch(`${base}${path}`);
  assert(response.status === 503, `I expected an explicit unconfigured-provider failure from ${path}.`);
}
let record;
if (mode === 'create') {
  const created = await json('/api/portfolios', { name: 'My container persistence check', mode: 'example', initialCash: 1000 });
  const id = created.portfolio.id;
  await json(`/api/portfolios/${id}/trades`, { requestId: randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: 10, price: 20, fee: 0 });
  let entry = await json('/api/watchlist/DEMO', { status: 'researching', thesis: 'My original container research', risks: 'My simulated research risk', reviewDate: null, checks: [], version: 0, entryId: null }, 'PUT');
  entry = await json('/api/watchlist/DEMO', { status: 'researching', thesis: 'My revised container research', risks: entry.risks, reviewDate: null, checks: [], version: entry.version, entryId: entry.entryId }, 'PUT');
  const scenario = await json('/api/companies/DEMO/scenarios', { name: 'My preserved model', assumptions: { baseFreeCashFlow: 100, growthRate: 0, discountRate: .1, terminalGrowthRate: 0, years: 5, netDebt: 100, sharesOutstanding: 10 } });
  record = { id, entry, scenario, history: await json('/api/watchlist/DEMO/history') };
  writeFileSync(recordPath, JSON.stringify(record));
} else if (mode === 'verify') record = JSON.parse(readFileSync(recordPath, 'utf8'));
else throw new Error('I need create or verify mode.');
const saved = await json(`/api/portfolios/${record.id}`);
assert(saved.cash === 800 && saved.positions.length === 1 && saved.positions[0].ticker === 'DEMO' && saved.positions[0].quantity === 10 && saved.trades.length === 1, 'My container did not preserve the expected cash, holdings, and fill.');
console.log(`I checked the packaged container and ${mode === 'create' ? 'saved' : 'reopened'} its practice portfolio.`);
const entry = (await json('/api/watchlist')).find(item => item.entryId === record.entry.entryId);
const scenario = (await json('/api/companies/DEMO/scenarios')).find(item => item.id === record.scenario.id);
assert(JSON.stringify(entry) === JSON.stringify(record.entry), 'My saved research changed.');
assert(JSON.stringify(scenario) === JSON.stringify(record.scenario), 'My saved valuation changed.');
assert(JSON.stringify(await json('/api/watchlist/DEMO/history')) === JSON.stringify(record.history), 'My saved research revisions changed.');
console.log('I reopened the same saved research, revision history, and valuation case.');
