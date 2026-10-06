import { expect, test, type Page } from '@playwright/test';
import catalog from './catalog';

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

async function installApi(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
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
  await expect(page.getByRole('button', { name: /^NVIDIA/ })).toBeVisible();
}

test('catalog search, sector filter, and source-linked financials', async ({ page }) => {
  await installApi(page);
  await expect(page.locator('.company-option')).toHaveCount(50);
  await page.getByRole('combobox', { name: 'Filter by sector' }).selectOption('Energy');
  await expect(page.locator('.company-option')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Filter by sector' }).selectOption('All sectors');
  await page.getByRole('textbox', { name: 'Search companies' }).fill('aapl');
  await expect(page.locator('.company-option')).toHaveCount(1);
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
    catch { /* The browser may already have canceled the request. */ }
  });
  await page.getByRole('button', { name: /^Apple/ }).click();
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
  await page.getByRole('textbox', { name: 'Search companies' }).fill('JPM');
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
  await page.getByRole('textbox', { name: 'Search companies' }).fill('Apple');
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
  await page.getByRole('textbox', { name: 'Search companies' }).fill('SPCX');
  await page.getByRole('button', { name: /^SpaceX/ }).click();
  await expect(page.getByRole('cell', { name: /Missing data is not zero/ })).toBeVisible();
  await expect(page.locator('.metric-card').first()).toContainText('—');
});

test('desktop example screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installApi(page);
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await page.screenshot({ path: 'test-results/research-dashboard.png', fullPage: true });
});

test('I preserve negative margins, suppress mismatched periods, and keep partial failures visible', async ({ page }) => {
  await installApi(page);
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
