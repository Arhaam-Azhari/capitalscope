import { expect, test, type Page } from '@playwright/test';
import catalog from './catalog';
import { readCsv } from './readCsv';
import { portfolioResearchRows, portfolioResearchQueue } from '../src/portfolioResearch';

// I use invented financial values and stub the API so these checks don't hit the SEC.
const example = {
  company: { ticker: 'DEMO', name: 'Example Manufacturing', sector: 'Industrials' },
  cik: null, retrievedAt: null, servedAt: '2026-10-06T20:00:00Z', source: 'Invented example figures', dataMode: 'example',
  notes: ['These figures are invented for exploring the interface.'],
  metrics: ['Revenue', 'Net income', 'Operating cash flow', 'Capital expenditure', 'Cash and equivalents'].map((name, metric) => ({
    name, unit: 'USD', annualValues: [2025, 2024, 2023, 2022, 2021].map((year, i) => ({
      periodStart: metric === 4 ? null : `${year}-01-01`, periodEnd: `${year}-12-31`,
      value: [1280, 145, 184, 59, 260][metric] * 1_000_000 * (1 - i * .1),
      filed: null, accession: null, sourceUrl: null, tag: 'example'
    }))
  }))
};

async function openCatalog(page: Page) {
  const picker = page.locator('.company-browser');
  if (!await picker.evaluate(element => (element as HTMLDetailsElement).open)) await picker.locator('summary').click();
}

async function installApi(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/scenarios/price-context')) return route.fulfill({ json: { ticker: path.split('/')[3], dataMode: path.includes('/DEMO/') ? 'example' : 'market',
      evaluatedAt: '2026-10-08T00:00:00Z', shareBasisConfirmed: false, quote: null, quoteError: 'No stored close in this fixture.', scenarios: [] } });
    if (path.endsWith('/scenarios')) return route.fulfill({ json: [] });
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { asOf: '2026-10-06', count: 50, dynamic: false } });
    if (path === '/api/examples/financials') return route.fulfill({ json: example });
    const ticker = path.match(/\/companies\/([^/]+)\/financials/)?.[1];
    if (ticker) return route.fulfill({ json: {
      ...example, company: catalog.find(c => c.ticker === ticker), cik: '0000000001',
      dataMode: 'sec', source: 'SEC EDGAR companyfacts', retrievedAt: '2026-10-06T20:00:00Z',
      metrics: example.metrics.map(m => ({ ...m, annualValues: m.annualValues.map(p => ({
        ...p, filed: '2026-02-01', tag: 'TestTag', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/'
      })) }))
    } });
    if (path === '/api/valuations/dcf/sensitivity') return route.fulfill({ json: { terminalGrowthRates: [0.02], rows: [{ discountRate: 0.1, cells: [{ terminalGrowthRate: 0.02, valuePerShare: 22, error: null, baseCase: true }] }] } });
    if (path === '/api/valuations/dcf') return route.fulfill({ json: {
      projections: [{ year: 1, freeCashFlow: 105000000, presentValue: 95454545 }],
      terminalValue: 1600000000, presentValueOfTerminalValue: 990000000,
      enterpriseValue: 1300000000, equityValue: 1100000000, valuePerShare: 22, terminalValueShare: .76
    } });
    return route.fulfill({ status: 404, json: { error: 'Unknown test route' } });
  });
  await page.goto('/');
  await openCatalog(page);
  await expect(page.getByRole('button', { name: /^NVIDIA/ })).toBeVisible();
}

test('catalog search, sector filter, and source-linked financials', async ({ page }) => {
  await installApi(page);
  await expect(page.locator('.company-option')).toHaveCount(50);
  await page.getByRole('combobox', { name: 'Filter by sector' }).selectOption('Energy');
  await expect(page.locator('.company-option')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Filter by sector' }).selectOption('All sectors');
  await openCatalog(page);
  await page.getByRole('textbox', { name: 'Search companies' }).fill('aapl');
  await expect(page.locator('.company-option')).toHaveCount(1);
  await openCatalog(page);
  await page.getByRole('button', { name: /^Apple/ }).click();
  await expect(page.getByRole('heading', { name: 'Apple', exact: true })).toBeVisible();
  await expect(page.locator('.data-banner')).toContainText('SEC financial data');
  await expect(page.getByRole('link', { name: 'SEC filing ↗' }).first()).toHaveAttribute('href', /sec\.gov\/Archives/);
  await page.getByRole('button', { name: /^Net income/ }).click();
  await expect(page.getByRole('heading', { name: 'Net income', exact: true })).toBeVisible();
});

test('example figures are visibly separate from real data', async ({ page }) => {
  await installApi(page);
  await expect(page.locator('.data-banner')).toContainText('invented figures');
  await expect(page.getByRole('heading', { name: 'Example Manufacturing' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SEC filing ↗' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Example only', exact: true })).toHaveCount(5);
});

test('SEC failure clears prior data and never silently falls back', async ({ page }) => {
  await installApi(page);
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await page.route('**/api/companies/AAPL/financials', route => route.fulfill({ status: 503, json: { error: 'SEC returned HTTP 403. Try again later.' } }));
  await openCatalog(page);
  await page.getByRole('button', { name: /^Apple/ }).click();
  await expect(page.getByRole('alert')).toContainText('SEC returned HTTP 403');
  await expect(page.locator('.metric-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Apple', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open example workspace ↗' }).click();
  await expect(page.getByRole('heading', { name: 'Example Manufacturing' })).toBeVisible();
});

test('changing companies cannot render a late response for the prior selection', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/companies/AAPL/financials', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    try { await route.fulfill({ json: { ...example, company: catalog.find(c => c.ticker === 'AAPL'), dataMode: 'sec' } }); }
    catch { /* I allow the browser to cancel the old request. */ }
  });
  await openCatalog(page);
  await page.getByRole('button', { name: /^Apple/ }).click();
  await openCatalog(page);
  await page.getByRole('button', { name: /^Microsoft/ }).click();
  await expect(page.getByRole('heading', { name: 'Microsoft', exact: true })).toBeVisible();
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: 'Microsoft', exact: true })).toBeVisible();
});

test('valuation converts percentages and clears outdated results when assumptions change', async ({ page }) => {
  await installApi(page);
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  const sent = page.waitForRequest('**/api/valuations/dcf');
  await page.getByRole('button', { name: 'Calculate valuation' }).click();
  expect((await sent).postDataJSON()).toMatchObject({ growthRate: .05, discountRate: .10, terminalGrowthRate: .02, baseFreeCashFlow: 100000000 });
  await expect(page.locator('.result-heading')).toContainText('$22.00');
  await expect(page.locator('.valuation-result')).toContainText('More than 75%');
  await page.getByRole('spinbutton', { name: 'Annual growth' }).fill('7');
  await expect(page.locator('.valuation-result')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Terminal growth' }).fill('12');
  await page.getByRole('button', { name: 'Calculate valuation' }).click();
  await expect(page.getByRole('alert')).toContainText('Terminal growth must be below');
});

test('specialized financial companies do not receive generic FCFF valuations', async ({ page }) => {
  await installApi(page);
  await openCatalog(page);
  await page.getByRole('textbox', { name: 'Search companies' }).fill('JPM');
  await openCatalog(page);
  await page.getByRole('button', { name: /^JPMorgan Chase/ }).click();
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await expect(page.getByRole('note')).toContainText('sector-specific valuation');
  await expect(page.getByRole('button', { name: 'Calculate valuation' })).toHaveCount(0);
});

test('notes persist through reload and stay separate for each company', async ({ page }) => {
  await installApi(page);
  await page.getByRole('button', { name: 'Research notes', exact: true }).click();
  await page.getByRole('textbox', { name: /Your notes/ }).fill('My thesis depends on margin expansion.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved in this browser.');
  await page.reload();
  await page.getByRole('button', { name: 'Research notes', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Your notes/ })).toHaveValue('My thesis depends on margin expansion.');
  await openCatalog(page);
  await page.getByRole('textbox', { name: 'Search companies' }).fill('Apple');
  await openCatalog(page);
  await page.getByRole('button', { name: /^Apple/ }).click();
  await page.getByRole('button', { name: 'Research notes', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Your notes/ })).toHaveValue('');
});

test('storage failures are reported instead of claiming notes were saved', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage denied'); }; });
  await installApi(page);
  await page.getByRole('button', { name: 'Research notes', exact: true }).click();
  await page.getByRole('textbox', { name: /Your notes/ }).fill('A note I need to keep.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('alert')).toContainText('could not save your note');
});

test('mobile workspace fits the viewport and remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await expect(page.locator('.metric-card')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate valuation' }).click();
  await expect(page.locator('.result-heading')).toContainText('$22.00');
});

test('empty metrics display missing data rather than fabricated zeroes', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/companies/SPCX/financials', route => route.fulfill({ json: {
    ...example, company: catalog.find(c => c.ticker === 'SPCX'), dataMode: 'sec',
    metrics: example.metrics.map(m => ({ ...m, annualValues: [] }))
  } }));
  await openCatalog(page);
  await page.getByRole('textbox', { name: 'Search companies' }).fill('SPCX');
  await openCatalog(page);
  await page.getByRole('button', { name: /^SpaceX/ }).click();
  await expect(page.getByRole('cell', { name: /Missing data is not zero/ })).toBeVisible();
  await expect(page.locator('.metric-card').first()).toContainText('—');
});

test('desktop example screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installApi(page);
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await page.locator('.company-browser > summary').click();
  await page.screenshot({ path: 'test-results/research-dashboard.png', fullPage: true });
});

test('I preserve negative margins, suppress mismatched periods, and keep partial failures visible', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  await page.route('**/api/companies/AAPL/financials', route => route.fulfill({ json: {
    ...example, company: catalog.find(c => c.ticker === 'AAPL'), dataMode: 'sec',
    metrics: example.metrics.map(m => ({ ...m, annualValues: m.annualValues.map(p => ({ ...p,
      value: m.name === 'Net income' ? -128000000 : p.value,
      periodStart: m.name === 'Capital expenditure' ? '2025-02-01' : p.periodStart,
      filed: '2026-02-01', sourceUrl: 'https://www.sec.gov/Archives/example/'
    })) }))
  } }));
  await page.route('**/api/companies/MSFT/financials', route => route.fulfill({ status: 503, json: { error: 'Import unavailable' } }));
  await page.getByRole('button', { name: 'Compare companies', exact: true }).click();
  await page.getByRole('combobox', { name: 'Comparison data' }).selectOption('sec');
  await expect(page.getByRole('alert')).toContainText('MSFT: Import unavailable');
  await expect(page.getByRole('row', { name: /Net income margin/ })).toContainText('-10.0%');
  await expect(page.getByRole('row', { name: /^Cash after capex / }).first()).toContainText('—');
  await expect(page.getByRole('link', { name: 'SEC filing ↗' }).first()).toHaveAttribute('href', 'https://www.sec.gov/Archives/example/');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('I can open the company picker with my keyboard and navigate without a sidebar', async ({ page }) => {
  await installApi(page);
  const picker = page.locator('.company-browser');
  await picker.locator('summary').click();
  await expect(picker).not.toHaveAttribute('open', '');
  await picker.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Search companies' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search companies' }).fill('Apple');
  await page.getByRole('button', { name: /^Apple/ }).click();
  await expect(picker).not.toHaveAttribute('open', '');
  await expect(picker.locator('summary')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Search companies' }).focus();
  await page.keyboard.press('Escape');
  await expect(picker).not.toHaveAttribute('open', '');
  await expect(picker.locator('summary')).toBeFocused();
  await expect(page.locator('.masthead .section-tabs')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
});

test('I compare saved cases, switch baselines, and export my assumptions without changing the model', async ({ page }) => {
  await installApi(page);
  const assumptions = { baseFreeCashFlow: 100000000, growthRate: .05, discountRate: .1, terminalGrowthRate: .02, years: 5, netDebt: 200000000, sharesOutstanding: 50000000 };
  let cases = [
    { id: 'base', name: '=My base, "case"', value: 20, growth: .05 },
    { id: 'up', name: 'My upside', value: 30, growth: .08 },
    { id: 'down', name: 'My downside', value: 10, growth: .01 },
    { id: 'four', name: 'My fourth case', value: 25, growth: .06 },
    { id: 'five', name: 'My fifth case', value: 40, growth: .1 }
  ].map(item => ({ id: item.id, name: item.name, ticker: 'DEMO', createdAt: '2026-10-07T00:00:00Z', modelVersion: 'fcff-v1',
    assumptions: { ...assumptions, growthRate: item.growth }, result: { projections: [], enterpriseValue: 1200000000, equityValue: 1000000000, valuePerShare: item.value, terminalValueShare: .7, terminalValue: 1000000000, presentValueOfTerminalValue: 840000000 } }));
  await page.route(/\/api\/companies\/DEMO\/scenarios(?:\/[^/]+)?$/,  route => {
    if (new URL(route.request().url()).pathname.endsWith('/price-context')) return route.fallback();
    if (route.request().method() === 'DELETE') { cases = cases.filter(item => !route.request().url().endsWith(`/${item.id}`)); return route.fulfill({ status: 204 }); }
    return route.fulfill({ json: cases });
  });
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Compare =My base, "case"', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare My upside', exact: true }).check();
  const table = page.getByRole('table', { name: 'Saved assumptions and valuation estimates' });
  await expect(table.getByRole('row', { name: /^Relative difference vs baseline/ })).toContainText('50%');
  await expect(table.getByRole('row', { name: /^Annual growth/ })).toContainText('Changed from baseline');
  await page.getByRole('combobox', { name: 'Comparison baseline' }).selectOption('up');
  await expect(table.getByRole('row', { name: /^Difference \/ share vs baseline/ })).toContainText('-$10.00');
  await expect(page.getByRole('spinbutton', { name: 'Annual growth', exact: false })).toHaveValue('5');
  await expect(page.locator('.valuation-result')).toHaveCount(0);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download comparison CSV' }).click();
  const file = await downloaded;
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(file.suggestedFilename()).toBe('valuation-comparison.csv');
  expect(csv).toContain('"\'=My base, ""case"""');
  expect(csv).toContain('"fcff-v1","up",100000000,0.05,0.1,0.02,5');
  await page.getByRole('checkbox', { name: 'Compare My downside', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare My fourth case', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Compare My fifth case', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Delete My upside', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Comparison baseline' })).toHaveValue('base');
  await expect(table).not.toContainText('My upside');
});

test('I leave relative differences unavailable for nonpositive baselines and deltas unavailable across models', async ({ page }) => {
  await installApi(page);
  const cases = [
    { id: 'zero', name: 'My zero case', value: 0, model: 'fcff-v1' },
    { id: 'negative', name: 'My negative case', value: -5, model: 'fcff-v1' },
    { id: 'other', name: 'My different model', value: 10, model: 'other-v2' }
  ].map(item => ({ id: item.id, name: item.name, ticker: 'DEMO', createdAt: '2026-10-07T00:00:00Z', modelVersion: item.model,
    assumptions: { baseFreeCashFlow: 100, growthRate: .05, discountRate: .1, terminalGrowthRate: .02, years: 5, netDebt: 200, sharesOutstanding: 50 },
    result: { projections: [], enterpriseValue: 200, equityValue: item.value * 50, valuePerShare: item.value, terminalValueShare: .7 } }));
  await page.route('**/api/companies/DEMO/scenarios', route => route.fulfill({ json: cases }));
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Compare My zero case', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare My negative case', exact: true }).check();
  const table = page.getByRole('table', { name: 'Saved assumptions and valuation estimates' });
  await expect(table.getByRole('row', { name: /^Relative difference/ })).toContainText('baseline is not positive');
  await expect(table.getByRole('row', { name: /^Difference \/ share/ })).toContainText('-$5.00');
  await page.getByRole('combobox', { name: 'Comparison baseline' }).selectOption('negative');
  await expect(table.getByRole('row', { name: /^Relative difference/ })).toContainText('baseline is not positive');
  await expect(table.getByRole('row', { name: /^Difference \/ share/ })).toContainText('$5.00');
  await page.getByRole('checkbox', { name: 'Compare My different model', exact: true }).check();
  await expect(page.locator('.scenario-comparison .notice')).toContainText('different model versions');
  await expect(table.getByRole('row', { name: /^Difference \/ share/ })).toContainText('Unavailable · different model');
});

test('I guard stress comparisons against changed evidence, missing prices, and model versions', async ({ page }) => {
  await installApi(page);
  const portfolio = { id: 'my-comparison', name: 'My comparison fixture', mode: 'market', initialCash: 600, createdAt: '2026-10-01T00:00:00Z' };
  const marks = ['AAPL', 'MSFT'].map((ticker, i) => ({ ticker, quantity: i + 2, costBasis: 100, close: 100,
    priceDate: '2026-10-01', priceAgeDays: 7, source: 'My fixture prices', sourceUrl: 'https://example.com/prices',
    retrievedAt: '2026-10-01T12:00:00Z', value: (i + 2) * 100, unrealizedPnl: (i + 2) * 100 - 100, error: null }));
  const baseline = { portfolioId: portfolio.id, dataMode: 'market', evaluatedAt: '2026-10-08T00:00:00Z', cash: 100,
    pricedPositions: 2, totalPositions: 2, complete: true, pricedHoldingsValue: 500, totalValue: 600, unrealizedPnl: 300, holdings: marks,
    allocation: { available: true, unavailableReason: null, cashWeight: 1 / 6, largestHolding: null, largestSector: null,
      topThreeHoldingsWeight: 5 / 6, companies: [], sectors: [{ label: 'Technology', value: 500, weight: 5 / 6 }] } };
  const base = { id: 'base', portfolioId: portfolio.id, name: 'My reference', createdAt: '2026-10-08T00:00:00Z', modelVersion: 'price-shock-v1',
    result: { baseline, assumptions: { defaultShock: -0.2, sectorShocks: { Technology: 0 } },
      holdings: marks.map(mark => ({ baseline: mark, sector: 'Technology', shock: 0, stressedValue: mark.value, change: 0 })),
      stressedPricedHoldingsValue: 500, stressedTotalValue: 600, change: 0, relativeChange: 0 } };
  const reorder = structuredClone(base); reorder.id = 'reorder'; reorder.name = 'My reordered snapshot';
  reorder.result.baseline.evaluatedAt = '2026-10-09T00:00:00Z'; reorder.result.baseline.holdings.reverse(); reorder.result.holdings.reverse();
  const evidence = structuredClone(base); evidence.id = 'evidence'; evidence.name = 'My changed evidence';
  evidence.result.holdings[0].baseline.retrievedAt = '2026-10-02T12:00:00Z';
  const version = structuredClone(base); version.id = 'version'; version.name = 'My future model'; version.modelVersion = 'price-shock-v2';
  const partial = structuredClone(base); partial.id = 'partial'; partial.name = 'My missing prices'; partial.result.baseline.complete = false;
  const items = [base, reorder, evidence, version, partial];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/portfolios')) return route.fallback();
    if (path.endsWith('/stress-scenarios')) return route.fulfill({ json: items });
    if (path.endsWith('/valuation')) return route.fulfill({ json: baseline });
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio] });
    return route.fulfill({ json: { portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, positions: [], trades: [], events: [] } });
  });
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  for (const name of ['My reference', 'My reordered snapshot', 'My changed evidence', 'My future model'])
    await page.getByRole('checkbox', { name: `Compare ${name}`, exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Compare My missing prices', exact: true })).toBeDisabled();
  const comparison = page.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  const delta = comparison.getByRole('row', { name: /^Stressed value difference vs reference/ }).getByRole('cell');
  await expect(delta.nth(0)).toHaveText('$0.00'); await expect(delta.nth(1)).toHaveText('$0.00');
  await expect(delta.nth(2)).toHaveText('Unavailable'); await expect(delta.nth(3)).toHaveText('Unavailable');
  await expect(comparison.getByRole('row', { name: /^Technology override/ })).toContainText('0.00%');
  await page.getByRole('checkbox', { name: 'Compare My changed evidence', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Compare My missing prices', exact: true }).check();
  await expect(delta.nth(3)).toHaveText('Unavailable');
  await comparison.getByLabel('Reference stress scenario').selectOption('version');
  for (let i = 0; i < 4; i++) await expect(delta.nth(i)).toHaveText('Unavailable');
  await page.getByRole('checkbox', { name: 'Compare My future model', exact: true }).uncheck();
  await expect(comparison.getByLabel('Reference stress scenario')).toHaveValue('base');
  await page.getByRole('checkbox', { name: 'Compare My future model', exact: true }).check();
  await expect(comparison.getByLabel('Reference stress scenario')).toHaveValue('base');
  await expect(delta.nth(0)).toHaveText('$0.00');

});

test('I clear share-basis confirmation when the stored quote changes during comparison', async ({ page }) => {
  await installApi(page);
  const saved = { id: 'my-gap', ticker: 'DEMO', name: 'My gap fixture', createdAt: '2026-10-01T00:00:00Z', modelVersion: 'fcff-v1',
    assumptions: { baseFreeCashFlow: 100, growthRate: 0.05, discountRate: 0.1, terminalGrowthRate: 0.02, years: 5, netDebt: 0, sharesOutstanding: 100 },
    result: { projections: [], terminalValue: 1000, presentValueOfTerminalValue: 500, enterpriseValue: 2500, equityValue: 2500, valuePerShare: 25, terminalValueShare: 0.2 } };
  await page.route('**/api/companies/DEMO/scenarios', route => route.fulfill({ json: [saved] }));
  let close = 21.6;
  await page.route('**/api/companies/DEMO/scenarios/price-context?*', route => {
    const confirmed = new URL(route.request().url()).searchParams.get('shareBasisConfirmed') === 'true';
    if (confirmed) close = 22;
    return route.fulfill({ json: { ticker: 'DEMO', dataMode: 'example', evaluatedAt: '2026-10-08T00:00:00Z', shareBasisConfirmed: confirmed,
      quote: { close, priceDate: close === 22 ? '2026-09-20' : '2026-09-19', priceAgeDays: close === 22 ? 18 : 19, source: 'Invented test prices', sourceUrl: null, retrievedAt: null }, quoteError: null,
      scenarios: [{ id: saved.id, name: saved.name, createdAt: saved.createdAt, modelVersion: saved.modelVersion, modeledShares: 100,
        valuePerShare: 25, valueMinusClose: confirmed ? 3 : null, relativeGap: confirmed ? 3 / 22 : null, unavailableReason: confirmed ? null : 'Confirm the share basis.' }] } });
  });
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  const context = page.getByRole('region', { name: 'Saved valuations and dated prices' });
  await expect(context.getByTestId('valuation-price-evidence')).toContainText('$21.60');
  await context.getByRole('checkbox').check();
  await expect(context).toContainText('The stored comparison evidence changed');
  await expect(context.getByRole('checkbox')).not.toBeChecked();
  await expect(context.getByTestId('valuation-price-evidence')).toContainText('$22.00');
  const row = context.getByRole('row', { name: /^My gap fixture/ });
  await expect(row.getByRole('cell').nth(2)).toHaveText('Unavailable');
  await context.getByRole('checkbox').check();
  await expect(row.getByRole('cell').nth(2)).toHaveText('$3.00');
});

test('I withhold stale review counts when storage reload fails and preserve a draft while filtering', async ({ page }) => {
  await installApi(page);
  let unavailable = false;
  const entry = { entryId: 'my-review', ticker: 'DEMO', status: 'watching', thesis: 'My saved thesis', risks: '', reviewDate: '2026-01-01',
    version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
  await page.route('**/api/watchlist', route => unavailable ? route.fulfill({ status: 503, json: { error: 'My test storage is offline' } }) : route.fulfill({ json: [entry] }));
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  const queue = page.getByRole('region', { name: 'Research review queue' });
  await expect(queue.getByTestId('review-count-overdue')).toHaveText('1');
  await page.getByRole('button', { name: 'Edit DEMO', exact: true }).click();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My unsaved thesis');
  await queue.getByRole('button', { name: /^No review date/ }).click();
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My unsaved thesis');
  unavailable = true;
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('My test storage is offline');
  await expect(queue.getByTestId('review-count-overdue')).toHaveText('—');
  await expect(queue.getByRole('button', { name: /^Overdue/ })).toBeDisabled();
  await expect(page.locator('.watchlist-cards')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(queue.getByTestId('review-count-overdue')).toHaveText('1');
  await queue.getByRole('button', { name: /^Overdue/ }).click();
  await expect(page.locator('.watchlist-cards')).toContainText('Example Manufacturing');
});


test('I report failed watchlist downloads without saving an error page or clearing my draft', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  let unexpected = false;
  await page.route('**/api/watchlist/export.csv', route => unexpected
    ? route.fulfill({ status: 200, contentType: 'text/html', body: '<p>My test service is unavailable</p>' })
    : route.fulfill({ status: 503, json: { error: 'My export storage is offline' } }));
  let downloads = 0; page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My draft survives export errors');
  const button = page.getByRole('button', { name: 'Download all saved research CSV', exact: true });
  await button.click();
  await expect(page.getByRole('alert')).toHaveText('My export storage is offline');
  await expect(button).toBeEnabled();
  unexpected = true;
  await button.click();
  await expect(page.getByRole('alert')).toContainText('did not return a CSV file');
  await expect(button).toBeEnabled();
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My draft survives export errors');
  expect(downloads).toBe(0);
});


test('I keep summary sections independent and reject mismatched saved evidence on reload', async ({ page }) => {
  await installApi(page);
  let recovered = false;
  await page.route('**/api/watchlist', route => recovered ? route.fulfill({ json: [{ ticker: 'DEMO', status: 'researching', thesis: 'My recovered thesis', risks: '', reviewDate: null, version: 2, updatedAt: '2026-10-08T00:00:00Z' }] })
    : route.fulfill({ status: 503, json: { error: 'My summary notes are offline' } }));
  await page.route('**/api/companies/DEMO/scenarios/price-context?*', route => route.fulfill({ json: {
    ticker: recovered ? 'AAPL' : 'DEMO', dataMode: recovered ? 'market' : 'example', evaluatedAt: '2026-10-08T00:00:00Z', shareBasisConfirmed: false,
    quote: { close: 21.6, priceDate: '2026-09-19', priceAgeDays: 19, source: 'My invented close', sourceUrl: null, retrievedAt: null }, quoteError: null,
    scenarios: [{ id: 'my-summary', name: 'My summary fixture', createdAt: '2026-10-01T00:00:00Z', modelVersion: 'fcff-v1', modeledShares: 100, valuePerShare: 25 }]
  } }));
  await page.getByRole('button', { name: 'Research summary', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Research summary for DEMO', exact: true });
  await expect(summary.getByRole('region', { name: 'Saved company thesis' })).toContainText('My summary notes are offline');
  await expect(summary.getByTestId('summary-close')).toHaveText('$21.60');
  await expect(summary.getByRole('region', { name: 'Company saved valuation cases' })).toContainText('My summary fixture');
  await expect(summary.getByRole('region', { name: 'Company financial evidence' })).toContainText('$1,280,000,000.00');
  recovered = true;
  await summary.getByRole('button', { name: 'Reload saved research' }).click();
  await expect(summary.getByRole('region', { name: 'Saved company thesis' })).toContainText('My recovered thesis');
  await expect(summary.getByRole('region', { name: 'Company stored close' })).toContainText('does not match this company');
  await expect(summary.getByTestId('summary-close')).toHaveCount(0);
  await expect(summary.getByRole('region', { name: 'Company saved valuation cases' })).not.toContainText('My summary fixture');
  await expect(summary.getByRole('region', { name: 'Company financial evidence' })).toContainText('$1,280,000,000.00');
});

test('I clear a prior company summary when its delayed saved evidence arrives', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [
    { ticker: 'AAPL', status: 'watching', thesis: 'My Apple thesis', risks: '', reviewDate: null, version: 1, updatedAt: '2026-10-08T00:00:00Z' },
    { ticker: 'MSFT', status: 'watching', thesis: 'My Microsoft thesis', risks: '', reviewDate: null, version: 1, updatedAt: '2026-10-08T00:00:00Z' }
  ] }));
  let release: () => void = () => {};
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/companies/AAPL/scenarios/price-context?*', async route => {
    await delayed;
    try { await route.fulfill({ json: { ticker: 'AAPL', dataMode: 'market', evaluatedAt: '2026-10-08T00:00:00Z', shareBasisConfirmed: false,
      quote: { close: 999, priceDate: '2026-10-07', priceAgeDays: 1, source: 'My old Apple fixture', sourceUrl: null, retrievedAt: null }, quoteError: null, scenarios: [] } }); }
    catch { /* I allow the old company's request to be canceled. */ }
  });
  await page.getByRole('button', { name: /^Apple/ }).click();
  await page.getByRole('button', { name: 'Research summary', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toContainText('My Apple thesis');
  await openCatalog(page); await page.getByRole('button', { name: /^Microsoft/ }).click();
  await page.getByRole('button', { name: 'Research summary', exact: true }).click();
  release();
  const summary = page.getByRole('region', { name: 'Research summary for MSFT', exact: true });
  await expect(summary).toContainText('My Microsoft thesis');
  await expect(summary.getByRole('region', { name: 'Company stored close' })).toContainText('No stored close in this fixture');
  await expect(summary).not.toContainText('My Apple thesis');
  await expect(summary).not.toContainText('My old Apple fixture');
  await expect(summary.getByTestId('summary-close')).toHaveCount(0);
});


test('I wait for summary evidence before printing and keep unavailable sections visible', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ status: 503, json: { error: 'My print notes are unavailable' } }));
  let release: () => void = () => {};
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/companies/DEMO/scenarios/price-context?*', async route => {
    await delayed;
    await route.fulfill({ json: { ticker: 'DEMO', dataMode: 'example', evaluatedAt: '2026-10-08T00:00:00Z', shareBasisConfirmed: false,
      quote: null, quoteError: 'My print close is unavailable', scenarios: [] } });
  });
  await page.evaluate(() => { (window as unknown as { print: () => void }).print = () => { throw new Error('My print test is blocked'); }; });
  await page.getByRole('button', { name: 'Research summary', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Research summary for DEMO', exact: true });
  const button = summary.getByRole('button', { name: 'Print research summary', exact: true });
  await expect(button).toBeDisabled();
  release(); await expect(button).toBeEnabled();
  const originalTitle = await page.title();
  await button.click();
  await expect(summary).toContainText('The browser could not open printing');
  expect(await page.title()).toBe(originalTitle);
  await page.evaluate(() => {
    window.print = () => { document.documentElement.dataset.printedTitle = document.title; };
  });
  await button.click();
  expect(await page.evaluate(() => document.documentElement.dataset.printedTitle)).toBe('CapitalScope - DEMO research summary');
  expect(await page.title()).toBe(originalTitle);
  await expect(summary).not.toContainText('The browser could not open printing');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.masthead')).toBeHidden();
  await expect(button).toBeHidden();
  await expect(summary.locator('.summary-print-header')).toContainText('Example Manufacturing (DEMO)');
  await expect(summary.locator('.summary-print-header')).toContainText('Fictional company / invented data');
  await expect(summary.getByTestId('summary-print-time')).toContainText('(UTC)');
  await expect(summary).toContainText('My print notes are unavailable');
  await expect(summary).toContainText('My print close is unavailable');
  expect(await summary.locator('.table-scroll').evaluate(element => getComputedStyle(element).overflow)).toBe('visible');
  await page.emulateMedia({ media: 'screen' });
  await expect(button).toBeVisible();
  await expect(page.locator('.masthead')).toBeVisible();
  await openCatalog(page); await page.getByRole('button', { name: /^Apple/ }).click();
  await page.getByRole('button', { name: 'Research summary', exact: true }).click();
  const market = page.getByRole('region', { name: 'Research summary for AAPL', exact: true });
  const filing = market.getByRole('link', { name: 'SEC filing ↗' }).first();
  await expect(filing).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  expect(await filing.evaluate(element => getComputedStyle(element, '::after').content)).toContain('https://www.sec.gov/Archives/');
  expect(await market.locator('thead th').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
});


test('I keep my checklist draft when a save fails and reset it only when saved research reloads', async ({ page }) => {
  await installApi(page);
  const entry = { entryId: 'my-checklist', ticker: 'DEMO', status: 'watching', thesis: 'My saved checklist thesis', risks: '', reviewDate: null,
    checks: ['filings'], version: 1, createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' };
  await page.route('**/api/watchlist', route => route.fulfill({ json: [entry] }));
  await page.route('**/api/watchlist/DEMO', route => {
    expect(route.request().postDataJSON().checks).toEqual(['filings', 'risks']);
    return route.fulfill({ status: 409, json: { error: 'My checklist changed in another session. Reload before saving.' } });
  });
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  const risks = page.getByRole('checkbox', { name: /^I revisited risks to my thesis/ });
  await expect(page.getByRole('checkbox', { name: /^I reviewed the latest filing/ })).toBeChecked();
  await risks.check();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My unsaved checklist evidence');
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('My checklist changed in another session');
  await expect(risks).toBeChecked();
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My unsaved checklist evidence');
  await page.getByRole('combobox', { name: 'Show entries' }).selectOption('checks');
  await expect(risks).toBeChecked();
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(risks).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^I reviewed the latest filing/ })).toBeChecked();
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My saved checklist thesis');
});


test('I open company research links and restore my view with browser history', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  await page.goto('/#research?company=aapl&view=summary');
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Apple', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await expect(page).toHaveURL(/company=AAPL&view=valuation$/);
  await page.getByRole('button', { name: 'Research summary', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Valuation', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goForward();
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = 'research?company=MSFT&view=summary'; });
  await expect(page.getByRole('region', { name: 'Research summary for MSFT', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toHaveCount(0);
});

test('I copy only navigation and offer manual copying if the clipboard is blocked', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copiedResearchLink = value; } } });
  });
  await page.goto('/?api_key=private-test#research?company=DEMO&view=summary');
  const input = page.getByRole('textbox', { name: 'Company research link', exact: true });
  await expect(input).toHaveValue(/#research\?company=DEMO&view=summary$/);
  const value = await input.inputValue(); expect(value).not.toContain('private-test'); expect(value).not.toContain('api_key');
  await page.getByRole('button', { name: 'Copy company research link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Research link copied');
  expect(await page.evaluate(() => document.documentElement.dataset.copiedResearchLink)).toBe(value);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('My clipboard fixture is blocked'); }; });
  await page.getByRole('button', { name: 'Copy company research link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Select and copy the link below');
  await input.focus();
  expect(await input.evaluate(element => (element as HTMLInputElement).selectionEnd)).toBe(value.length);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.summary-share').screenshot({ path: 'test-results/company-research-link-mobile.png' });
});

test('I validate linked companies before loading evidence and explain invalid links', async ({ page }) => {
  await installApi(page);
  let unavailable = true;
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  await page.route('**/api/companies', route => unavailable ? route.fulfill({ status: 503, json: { error: 'My link catalog is offline' } }) : route.fulfill({ json: catalog }));
  const financialRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/financials')) financialRequests.push(request.url()); });
  await page.goto('/?test=catalog-reload#research?company=AAPL&view=summary');
  await expect(page.getByRole('heading', { name: 'Opening research link', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('My link catalog is offline');
  expect(financialRequests).toEqual([]);
  unavailable = false;
  await page.getByRole('button', { name: 'Retry company catalog', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toBeVisible();
  expect(financialRequests.every(url => url.includes('/AAPL/'))).toBe(true);
  await page.goto('/#research?company=UNKNOWN&view=summary');
  await expect(page.locator('.main-content > .notice.warning')).toContainText('This company is not in the catalog');
  await expect(page.getByRole('heading', { name: 'Example Manufacturing', exact: true })).toBeVisible();
  await page.goto('/#research?company=DEMO&view=unknown');
  await expect(page.locator('.main-content > .notice.warning')).toContainText('This research link is invalid');
  await page.goto('/#research?company=AAPL&company=MSFT&view=summary');
  await expect(page.locator('.main-content > .notice.warning')).toContainText('This research link is invalid');
  await page.route('**/api/companies', route => route.fulfill({ json: [] }));
  await page.goto('/?test=empty-catalog#research?company=AAPL&view=summary');
  await expect(page.locator('.main-content > .notice.warning')).toContainText('This company is not in the catalog');
});


test('I keep separate note and watchlist drafts when moving between research views', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Research notes', exact: true }).click();
  await page.getByLabel('Your notes for Example Manufacturing').fill('My unsaved example thesis');
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await page.getByRole('button', { name: 'Research notes', exact: true }).click();
  await expect(page.getByLabel('Your notes for Example Manufacturing')).toHaveValue('My unsaved example thesis');
  await page.getByRole('button', { name: 'Discard note draft' }).click();
  await expect(page.getByLabel('Your notes for Example Manufacturing')).toHaveValue('');
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis').fill('My draft for DEMO');
  await page.getByLabel('Watchlist company').selectOption('AAPL');
  await page.getByLabel('My investment thesis').fill('My draft for Apple');
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByLabel('My investment thesis')).toHaveValue('My draft for DEMO');
  await page.getByLabel('Watchlist company').selectOption('AAPL');
  await expect(page.getByLabel('My investment thesis')).toHaveValue('My draft for Apple');
  await page.getByRole('button', { name: 'Reload watchlist' }).click();
  await expect(page.getByLabel('My investment thesis')).toHaveValue('');
});

test('I retain the original watchlist version when restoring an unsaved draft', async ({ page }) => {
  await installApi(page);
  let version = 1;
  await page.route('**/api/watchlist', route => route.fulfill({ json: [{ ticker: 'DEMO', entryId: 'original', version,
    status: 'watching', thesis: 'Saved thesis', risks: '', checks: [], reviewDate: null, updatedAt: '2026-10-08T00:00:00Z' }] }));
  await page.route('**/api/watchlist/DEMO', async route => {
    expect(route.request().postDataJSON()).toMatchObject({ version: 1, entryId: 'original', thesis: 'My older draft' });
    await route.fulfill({ status: 409, json: { error: 'Research changed elsewhere. Reload before saving.' } });
  });
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis').fill('My older draft');
  version = 2;
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByLabel('My investment thesis')).toHaveValue('My older draft');
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Research changed elsewhere');
  await expect(page.getByLabel('My investment thesis')).toHaveValue('My older draft');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(page.getByLabel('My investment thesis')).toHaveValue('Saved thesis');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(false);
});


test('I compare saved research independently of filings and retry without exposing drafts', async ({ page }) => {
  await installApi(page);
  let unavailable = true;
  let reads = 0;
  await page.route('**/api/watchlist', route => {
    reads++;
    return unavailable ? route.fulfill({ status: 503, json: { error: 'Research storage unavailable' } }) : route.fulfill({ json: [
      { ticker: 'AAPL', entryId: 'apple', version: 3, status: 'researching', thesis: 'My saved Apple thesis\nSecond line', risks: 'My saved Apple risks', checks: ['filings', 'risks'], reviewDate: '2026-11-01', updatedAt: '2026-10-09T00:00:00Z' },
      { ticker: 'MSFT', entryId: 'microsoft', version: 2, status: 'archived', thesis: '', risks: '', reviewDate: null, updatedAt: '2026-10-08T00:00:00Z' },
      { ticker: 'DEMO', entryId: 'example', version: 1, status: 'watching', thesis: 'Fictional research must stay separate', risks: '', checks: [], reviewDate: null, updatedAt: '2026-10-08T00:00:00Z' }
    ] });
  });
  await page.route('**/api/companies/*/financials', route => route.fulfill({ status: 503, json: { error: 'Filings unavailable' } }));
  await page.getByRole('button', { name: 'Compare companies', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compare saved company research' })).toHaveCount(0);
  expect(reads).toBe(0);
  await page.getByLabel('Comparison data').selectOption('sec');
  const saved = page.getByRole('region', { name: 'Compare saved company research' });
  await expect(saved.getByRole('alert')).toContainText('Research storage unavailable');
  unavailable = false;
  await saved.getByRole('button', { name: 'Reload saved research comparison' }).click();
  await expect(saved.getByRole('row', { name: /Investment thesis/ })).toContainText('My saved Apple thesis');
  await expect(saved.getByRole('row', { name: /Saved status/ })).toContainText('Archived research');
  await expect(saved.getByRole('row', { name: /Manual research progress/ })).toContainText('2 of 5 marked reviewed');
  await expect(saved.getByRole('row', { name: /Manual research progress/ })).toContainText('0 of 5 marked reviewed');
  await expect(saved).not.toContainText('Fictional research must stay separate');
  await page.getByRole('combobox', { name: 'Company 1', exact: true }).selectOption('NVDA');
  await expect(saved.getByRole('row', { name: /Saved status/ })).toContainText('No saved watchlist entry');
  await expect(saved).not.toContainText('My saved Apple thesis');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await saved.screenshot({ path: 'test-results/saved-research-comparison-mobile.png' });
  await saved.getByRole('button', { name: 'Open research for MSFT' }).click();
  await expect(page).toHaveURL(/company=MSFT&view=summary/);
  await expect(page.getByRole('region', { name: 'Saved company thesis', exact: true })).toContainText('archived');
});


test('I reopen company comparisons and restore selections with browser history', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  await page.goto('/?comparison=start#research?company=DEMO&view=compare&peers=aapl,MSFT,BRK-B');
  await expect(page.getByRole('combobox', { name: 'Company 1', exact: true })).toHaveValue('AAPL');
  await expect(page.getByRole('combobox', { name: 'Company 3', exact: true })).toHaveValue('BRK-B');
  await page.getByRole('combobox', { name: 'Company 2', exact: true }).selectOption('NVDA');
  const link = await page.getByLabel('Company comparison link', { exact: true }).inputValue();
  expect(new URL(link).search).toBe('');
  expect(new URLSearchParams(new URL(link).hash.slice('#research?'.length)).get('peers')).toBe('AAPL,NVDA,BRK-B');
  await page.getByRole('button', { name: 'Add company', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Company 4', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Company 4', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Company 2', exact: true })).toHaveValue('MSFT');
  await page.goForward();
  await expect(page.getByRole('combobox', { name: 'Company 2', exact: true })).toHaveValue('NVDA');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Company 3', exact: true })).toHaveValue('BRK-B');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Blocked')) } }));
  await page.getByRole('button', { name: 'Copy company comparison link' }).click();
  await expect(page.getByText('Copy is unavailable. Select and copy the link below.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.summary-share').screenshot({ path: 'test-results/comparison-link-mobile.png' });
});

test('I reject malformed or unsupported comparison selections before requesting their evidence', async ({ page }) => {
  await installApi(page);
  const requested: string[] = [];
  page.on('request', request => { if (/\/companies\/.*\/financials/.test(request.url())) requested.push(request.url()); });
  const links = ['peers=AAPL', 'peers=AAPL,AAPL', 'peers=AAPL,MSFT,NVDA,AMD,GOOG', 'peers=AAPL,DEMO', 'peers=AAPL,MSFT&peers=NVDA,AMD', 'peers=AAPL,UNKNOWN', 'peers=AAPL,,MSFT'];
  for (let i = 0; i < links.length; i++) {
    await page.goto(`/?invalidComparison=${i}#research?company=DEMO&view=compare&${links[i]}`);
    await expect(page.locator('.main-content > .notice.warning')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Financials', exact: true })).toHaveAttribute('aria-current', 'page');
  }
  expect(requested).toEqual([]);
});

test('I inspect saved revisions on demand and keep history separate from my draft', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  const entry = { ticker: 'DEMO', entryId: 'my-original-entry', version: 2, status: 'archived', thesis: 'My historical thesis', risks: 'My historical risk', checks: ['filings'], reviewDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
  let unavailable = true; let reads = 0;
  await page.route('**/api/watchlist/DEMO/history*', route => {
    reads++;
    if (unavailable) return route.fulfill({ status: 503, json: { error: 'History storage unavailable' } });
    const older = new URL(route.request().url()).searchParams.get('before');
    return route.fulfill({ json: older ? { items: [{ id: 1, action: 'baseline', recordedAt: '2026-10-03T00:00:00Z', entry: { ...entry, version: 1, thesis: 'My surviving baseline' } }], nextBefore: null }
      : { items: [{ id: 3, action: 'removed', recordedAt: '2026-10-04T00:00:00Z', entry }], nextBefore: 3 } });
  });
  await page.route('**/api/watchlist/AAPL/history*', route => route.fulfill({ json: { items: [], nextBefore: null } }));
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My unsaved new draft');
  expect(reads).toBe(0);
  const history = page.getByRole('region', { name: 'Research revision history · DEMO', exact: true });
  await history.getByRole('button', { name: 'Load research history', exact: true }).click();
  await expect(history.getByRole('alert')).toContainText('History storage unavailable');
  unavailable = false;
  await history.getByRole('button', { name: 'Load research history', exact: true }).click();
  await history.locator('summary').click();
  await expect(history).toContainText('My historical thesis');
  await expect(history).not.toContainText('My unsaved new draft');
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My unsaved new draft');
  await history.getByRole('button', { name: 'Load older research revisions' }).click();
  await expect(history.locator('details')).toHaveCount(2);
  await history.locator('summary').last().click();
  await expect(history).toContainText('My surviving baseline');
  await expect(history.getByRole('button', { name: 'Load older research revisions' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await history.screenshot({ path: 'test-results/research-history-mobile.png' });
  await page.getByRole('combobox', { name: 'Watchlist company', exact: true }).selectOption('AAPL');
  const apple = page.getByRole('region', { name: 'Research revision history · AAPL', exact: true });
  await expect(apple).not.toContainText('My historical thesis');
  await apple.getByRole('button', { name: 'Load research history', exact: true }).click();
  await expect(apple).toContainText('No recorded revisions for AAPL');
});

test('I compare exact research fields across revisions without confusing removals or recreated entries', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  const original = { ticker: 'DEMO', entryId: 'my-original-entry', version: 2, status: 'watching', thesis: 'My unchanged thesis', risks: 'My unchanged risks', checks: ['filings'], reviewDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
  await page.route('**/api/watchlist/DEMO/history*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('before') ? {
    items: [{ id: 1, action: 'baseline', recordedAt: '2026-10-03T00:00:00Z', entry: { ...original, version: 1 } }], nextBefore: null
  } : { items: [
    { id: 5, action: 'saved', recordedAt: '2026-10-05T00:00:00Z', entry: { ...original, entryId: 'my-recreated-entry', version: 1, status: 'researching', thesis: 'My replacement thesis\nMy second line', risks: '', checks: ['risks'], reviewDate: '2026-12-01' } },
    { id: 3, action: 'removed', recordedAt: '2026-10-04T00:00:00Z', entry: original },
    { id: 2, action: 'saved', recordedAt: '2026-10-03T00:00:00Z', entry: original }
  ], nextBefore: 2 } }));
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My untouched draft');
  const history = page.getByRole('region', { name: 'Research revision history · DEMO', exact: true });
  await history.getByRole('button', { name: 'Load research history', exact: true }).click();
  await history.getByRole('checkbox', { name: /^Compare record 3 / }).check();
  await history.getByRole('checkbox', { name: /^Compare record 2 / }).check();
  const comparison = history.getByRole('region', { name: 'Changes between saved research records', exact: true });
  await expect(comparison).toContainText('0 of 9 research fields changed');
  await expect(comparison.locator('.revision-comparison-records > div').first()).toContainText('Earlier record · Record 2');
  await expect(comparison.locator('.revision-comparison-records > div').last()).toContainText('Removed from watchlist');
  await expect(history.getByRole('checkbox', { name: /^Compare record 5 / })).toBeDisabled();
  await comparison.getByRole('checkbox', { name: 'Only show changed research fields' }).check();
  await expect(comparison.getByRole('table')).toHaveCount(0);
  await expect(comparison).toContainText('No research fields changed');
  await history.getByRole('button', { name: 'Clear revision comparison' }).click();
  await history.getByRole('checkbox', { name: /^Compare record 5 / }).check();
  await history.getByRole('button', { name: 'Load older research revisions' }).click();
  await history.getByRole('checkbox', { name: /^Compare record 1 / }).check();
  await expect(comparison).toContainText('6 of 9 research fields changed');
  await expect(comparison.getByRole('status')).toHaveCount(0);
  await expect(comparison.getByText('These records belong to different entry IDs.', { exact: false })).toBeVisible();
  const thesis = comparison.getByRole('row', { name: /Investment thesis/ });
  await expect(thesis.locator('td').first()).toHaveText('My unchanged thesis');
  await expect(thesis.locator('td').last()).toHaveText('My replacement thesis\nMy second line');
  await expect(comparison.getByRole('row', { name: /Risks and evidence/ }).locator('td').last()).toHaveText('Not recorded');
  await comparison.getByRole('checkbox', { name: 'Only show changed research fields' }).check();
  await expect(comparison.locator('tbody tr')).toHaveCount(6);
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My untouched draft');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await comparison.screenshot({ path: 'test-results/research-revision-comparison-mobile.png' });
  await history.getByRole('button', { name: 'Reload research history', exact: true }).click();
  await expect(comparison).toHaveCount(0);
  await expect(history.getByRole('checkbox', { name: /^Compare record 5 / })).not.toBeChecked();
});

test('I preview historical research before replacing my draft and keep my original conflict version', async ({ page }) => {
  await installApi(page);
  let current = { ticker: 'DEMO', entryId: 'my-active-entry', version: 2, status: 'researching', thesis: 'My current saved thesis', risks: 'My current risks', checks: [], reviewDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
  const historical = { ...current, entryId: 'my-earlier-entry', version: 7, status: 'archived', thesis: 'My historical thesis', risks: 'My historical risks', checks: ['filings'], reviewDate: '2026-01-01' };
  await page.route('**/api/watchlist', route => route.fulfill({ json: [current] }));
  await page.route('**/api/watchlist/DEMO/history*', route => route.fulfill({ json: { items: [{ id: 9, action: 'removed', recordedAt: '2026-10-03T00:00:00Z', entry: historical }], nextBefore: null } }));
  let writes = 0;
  await page.route('**/api/watchlist/DEMO', route => {
    writes++;
    expect(route.request().postDataJSON()).toMatchObject({ version: 2, entryId: 'my-active-entry', thesis: 'My historical thesis', status: 'archived', checks: ['filings'], reviewDate: '2026-01-01' });
    return route.fulfill({ status: 409, json: { error: 'Research changed elsewhere. Reload before saving.' } });
  });
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My existing unsaved draft');
  const history = page.getByRole('region', { name: 'Research revision history · DEMO', exact: true });
  await history.getByRole('button', { name: 'Load research history', exact: true }).click();
  await history.locator('summary').first().click();
  await history.getByRole('button', { name: 'Prepare draft from record 9' }).click();
  const preview = history.getByRole('region', { name: 'Prepare record 9 as an editor draft', exact: true });
  await expect(preview).toContainText('This replaces your current unsaved editor draft');
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My existing unsaved draft');
  await preview.getByRole('button', { name: 'Cancel draft replacement' }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My existing unsaved draft');
  await history.getByRole('button', { name: 'Prepare draft from record 9' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await preview.screenshot({ path: 'test-results/research-restore-preview-mobile.png' });
  await preview.getByRole('button', { name: 'Replace editor draft with record 9' }).click();
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My historical thesis');
  await expect(page.getByLabel('My investment thesis', { exact: true })).toBeFocused();
  await expect(page.getByRole('checkbox', { name: /^I reviewed the latest filing/ })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Research status', exact: true })).toHaveValue('archived');
  expect(writes).toBe(0);
  current = { ...current, version: 3 };
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My historical thesis');
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Research changed elsewhere');
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My historical thesis');
  expect(writes).toBe(1);
});

test('I save a restored removed record as a new entry without reusing its historical identity', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  const old = { ticker: 'DEMO', entryId: 'my-removed-entry', version: 8, status: 'watching', thesis: 'My recovered thesis', risks: 'My recovered risks', checks: ['risks'], reviewDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
  await page.route('**/api/watchlist/DEMO/history*', route => route.fulfill({ json: { items: [{ id: 11, action: 'removed', recordedAt: '2026-10-03T00:00:00Z', entry: old }], nextBefore: null } }));
  let writes = 0;
  await page.route('**/api/watchlist/DEMO', route => {
    writes++;
    expect(route.request().postDataJSON()).toMatchObject({ version: 0, entryId: null, thesis: old.thesis, risks: old.risks, checks: ['risks'] });
    return route.fulfill({ json: { ...old, entryId: 'my-new-entry', version: 1 } });
  });
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  const history = page.getByRole('region', { name: 'Research revision history · DEMO', exact: true });
  await history.getByRole('button', { name: 'Load research history', exact: true }).click();
  await history.locator('summary').first().click();
  await history.getByRole('button', { name: 'Prepare draft from record 11' }).click();
  await history.getByRole('button', { name: 'Replace editor draft with record 11' }).click();
  expect(writes).toBe(0);
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue(old.thesis);
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.locator('.save-status').first()).toContainText('Saved to the shared watchlist');
  expect(writes).toBe(1);
});

test('I download all stored research history without changing my draft or requiring loaded pages', async ({ page }) => {
  await installApi(page);
  await page.route('**/api/watchlist', route => route.fulfill({ json: [] }));
  let mode = 'unavailable'; let historyReads = 0;
  await page.route('**/api/watchlist/DEMO/history', route => { historyReads++; return route.fulfill({ json: { items: [], nextBefore: null } }); });
  await page.route('**/api/watchlist/DEMO/history/export.csv', route => mode === 'unavailable'
    ? route.fulfill({ status: 503, json: { error: 'History export unavailable' } })
    : mode === 'html' ? route.fulfill({ contentType: 'text/html', body: '<html>Unexpected response</html>' })
    : route.fulfill({ contentType: 'text/csv;charset=UTF-8', body: '"revision_id","action","thesis"\r\n1,"baseline","My stored older thesis"\r\n' }));
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByLabel('My investment thesis', { exact: true }).fill('My unsaved export draft');
  const history = page.getByRole('region', { name: 'Research revision history · DEMO', exact: true });
  const button = history.getByRole('button', { name: 'Download all DEMO research revisions CSV' });
  await button.click();
  await expect(history.getByRole('alert')).toContainText('History export unavailable');
  mode = 'html'; await button.click();
  await expect(history.getByRole('alert')).toContainText('did not return a CSV');
  mode = 'csv';
  const downloadPromise = page.waitForEvent('download'); await button.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('DEMO-research-history.csv');
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv).toContain('My stored older thesis'); expect(csv).not.toContain('My unsaved export draft');
  expect(historyReads).toBe(0);
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My unsaved export draft');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await history.locator('.export-actions').screenshot({ path: 'test-results/research-history-export-mobile.png' });
});

test('I review saved research for current holdings and reset it when I switch portfolios', async ({ page }) => {
  await installApi(page);
  const portfolio = { id: 'review', name: '=My, "research" portfolio', mode: 'market', initialCash: 1000, createdAt: '2026-10-01T00:00:00Z' };
  const empty = { ...portfolio, id: 'empty', name: 'My cash portfolio' };
  const checks = ['filings', 'cash_flow', 'leverage', 'share_basis', 'risks'];
  const entries = [
    { ticker: 'AAPL', status: 'researching', thesis: '=SUM(1,2)\nMy "quoted" thesis', risks: '\tMy recorded risks', reviewDate: '2099-01-01', checks },
    { ticker: 'MSFT', status: 'watching', thesis: ' ', risks: 'My risk notes', reviewDate: '2000-01-01', checks: [] },
    { ticker: 'TSLA', status: 'watching', thesis: 'My unrelated notes', risks: 'My unrelated risk', reviewDate: null, checks: [] },
    { ticker: 'AMZN', status: 'archived', thesis: '', risks: '', reviewDate: '2000-01-01', checks: [] }
  ].map((entry, i) => ({ ...entry, entryId: `entry-${i}`, version: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }));
  let reads = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/watchlist') {
      reads++;
      return reads === 1 ? route.fulfill({ status: 503, json: { error: 'My saved research is unavailable' } }) : route.fulfill({ json: entries });
    }
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio, empty] });
    if (path === '/api/portfolios/review' || path === '/api/portfolios/empty') return route.fulfill({ json: {
      portfolio: path.endsWith('empty') ? empty : portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, events: [], trades: [],
      positions: path.endsWith('empty') ? [] : ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'DEMO'].map(ticker => ({ ticker, quantity: 2, costBasis: 100, averageCost: 50 }))
    } });
    return route.fallback();
  });
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  const review = page.getByRole('region', { name: 'Research review for my holdings', exact: true });
  await expect(review.getByRole('button', { name: 'Load portfolio research' })).toBeEnabled();
  await expect(review.getByRole('button', { name: 'Download all holdings research CSV' })).toBeDisabled();
  expect(reads).toBe(0);
  await review.getByRole('button', { name: 'Load portfolio research' }).click();
  await expect(review.getByRole('alert')).toContainText('unavailable');
  await expect(review.getByRole('button', { name: 'Download all holdings research CSV' })).toBeDisabled();
  await review.getByRole('button', { name: 'Load portfolio research' }).click();
  await expect(review).toContainText('5 holdings · 1 without a saved entry · 1 with archived research · 1 with missing notes · 1 with open manual checks · 1 due for review');
  await expect(review.getByRole('button', { name: 'Open research for DEMO' })).toBeDisabled();
  await review.getByLabel('Portfolio research order').selectOption('queue');
  const tickers = review.locator('tbody th[scope="row"]');
  await expect(tickers).toHaveText([/^MSFT/, /^NVDA/, /^AMZN/, /^AAPL/, /^DEMO/]);
  await expect(review.getByRole('row', { name: /^MSFT/ })).toContainText('Review overdue · Missing thesis · Open manual checks');
  await expect(review.getByRole('row', { name: /^NVDA/ })).toContainText('No saved research');
  await expect(review.getByRole('row', { name: /^DEMO/ })).toContainText('Unsupported instrument');
  const gapFilter = review.getByLabel('Portfolio research filter');
  for (const [filter, expected] of [['due', 'MSFT'], ['notes', 'MSFT'], ['checks', 'MSFT'], ['missing', 'NVDA'], ['archived', 'AMZN'], ['unsupported', 'DEMO']]) {
    await gapFilter.selectOption(filter);
    await expect(tickers).toHaveText([new RegExp(`^${expected}`)]);
  }
  await gapFilter.selectOption('all');
  await review.getByLabel('Search holdings research').fill('  teCHnology  ');
  await expect(tickers).toHaveText([/^MSFT/, /^NVDA/, /^AAPL/]);
  await gapFilter.selectOption('missing');
  await expect(tickers).toHaveText([/^NVDA/]);
  await review.getByLabel('Search holdings research').fill('apple');
  await expect(review).toContainText('Showing 0 of 5 holdings');
  await expect(review).toContainText('No holdings match this research filter');
  await review.getByRole('button', { name: 'Clear research filters' }).click();
  await expect(tickers).toHaveText([/^MSFT/, /^NVDA/, /^AMZN/, /^AAPL/, /^DEMO/]);
  await expect(review.getByLabel('Portfolio research order')).toHaveValue('queue');
  await review.getByLabel('Portfolio research filter').selectOption('needs');
  await expect(review.getByRole('button', { name: 'Open research for AAPL' })).toHaveCount(0);
  await expect(review.getByRole('button', { name: 'Open research for MSFT' })).toBeVisible();
  await review.getByLabel('Search holdings research').fill('microsoft');
  await expect(tickers).toHaveText([/^MSFT/]);
  const downloaded = page.waitForEvent('download');
  await review.getByRole('button', { name: 'Download all holdings research CSV' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('portfolio-research.csv');
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile((await file.path())!, 'utf8');
  const records = readCsv(csv);
  expect(records.map(row => row.ticker)).toEqual(['AAPL', 'MSFT', 'AMZN', 'NVDA', 'DEMO']);
  const [apple, microsoft, amazon, nvidia, demo] = records;
  expect(apple.portfolio_name).toBe("'=My, \"research\" portfolio");
  expect(apple.thesis).toBe("'=SUM(1,2)\nMy \"quoted\" thesis");
  expect(apple.risks).toBe("'\tMy recorded risks");
  expect(apple.simulated_shares).toBe('2');
  expect(apple.research_needs_review).toBe('false');
  expect(apple.manual_checks_reviewed).toBe('5');
  expect(apple.user_reviewed_filings).toBe('true');
  expect(microsoft.review_bucket).toBe('overdue');
  expect(microsoft.review_queue_group).toBe('Overdue');
  expect(microsoft.review_reasons).toBe('Review overdue; Missing thesis; Open manual checks');
  expect(microsoft.missing_active_notes).toBe('true');
  expect(microsoft.open_active_manual_checks).toBe('true');
  expect(amazon.research_status).toBe('archived');
  expect(amazon.active_review_due).toBe('false');
  expect(nvidia.saved_entry_present).toBe('false');
  expect(nvidia.manual_checks_reviewed).toBe('');
  expect(nvidia.user_reviewed_filings).toBe('');
  expect(demo.supported_in_portfolio_mode).toBe('false');
  expect(demo.entry_id).toBe('');
  expect(apple.saved_research_loaded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(apple.local_review_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(apple.export_scope).toContain('not an atomic database snapshot');
  expect(apple.exported_at >= apple.saved_research_loaded_at).toBe(true);
  expect(reads).toBe(2);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await review.locator('.export-actions').first().screenshot({ path: 'test-results/portfolio-research-export-mobile.png' });
  await review.getByText('Read saved notes for MSFT', { exact: true }).click();
  await expect(review).toContainText('My risk notes');
  await page.getByLabel('Open portfolio').selectOption('empty');
  await expect(review).toContainText('No open positions to review');
  await expect(review.getByRole('button', { name: 'Load portfolio research' })).toBeDisabled();
  await expect(review.getByRole('button', { name: 'Download all holdings research CSV' })).toBeDisabled();
  await page.getByLabel('Open portfolio').selectOption('review');
  await expect(review).toContainText('Load saved research to review the current holdings');
  expect(reads).toBe(2);
  await expect(review.getByLabel('Portfolio research order')).toHaveCount(0);
  await expect(review.getByRole('button', { name: 'Download all holdings research CSV' })).toBeDisabled();
  await review.getByRole('button', { name: 'Load portfolio research' }).click();
  await expect(review.getByLabel('Search holdings research')).toHaveValue('');
  await expect(review.getByLabel('Portfolio research filter')).toHaveValue('all');
  await review.getByRole('button', { name: 'Open research for AAPL' }).click();
  await expect(page).toHaveURL(/company=AAPL&view=summary/);
  await expect(page.getByRole('region', { name: 'Research summary for AAPL', exact: true })).toBeVisible();
});


test('I order due research by local calendar dates without elevating old archived dates', () => {
  const tickers = ['AMZN', 'MSFT', 'AAPL', 'NVDA', 'GOOG'];
  const summary = { portfolio: { id: 'queue', name: 'My queue', mode: 'market' as const, initialCash: 1000, createdAt: '2026-01-01T00:00:00Z' },
    cash: 0, realizedPnl: 0, dividendIncome: 0, trades: [], events: [],
    positions: tickers.map(ticker => ({ ticker, quantity: 1, costBasis: 1, averageCost: 1 })) };
  const entries = tickers.map(ticker => ({ ticker, entryId: ticker, version: 1, status: ticker === 'AMZN' ? 'archived' as const : 'researching' as const,
    thesis: 'My thesis', risks: 'My risks', checks: ['filings', 'cash_flow', 'leverage', 'share_basis', 'risks'],
    reviewDate: ticker === 'AMZN' ? '2000-01-01' : ticker === 'NVDA' ? '2026-10-08' : ticker === 'GOOG' ? '2026-10-10' : '2026-10-09',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }));
  const rows = portfolioResearchRows(summary, catalog, entries, '2026-10-09');
  const queue = portfolioResearchQueue(rows);
  expect(queue.map(row => row.position.ticker)).toEqual(['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOG']);
  expect(queue[1].reasons).toEqual(['Review due today']);
  expect(queue[4].needsReview).toBe(false);
  expect(rows.map(row => row.position.ticker)).toEqual(tickers);
  const nextDay = portfolioResearchQueue(portfolioResearchRows(summary, catalog, entries, '2026-10-10'));
  expect(nextDay.find(row => row.position.ticker === 'GOOG')?.reasons).toEqual(['Review due today']);
});
