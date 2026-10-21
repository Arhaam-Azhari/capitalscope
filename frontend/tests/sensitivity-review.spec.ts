import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { sensitivityCsv, sensitivityReview, type SensitivityGrid } from '../src/sensitivityReview';
import { readCsv } from './readCsv';
import catalog from './catalog';

const assumptions = { baseFreeCashFlow: 100000000, growthRate: .05, discountRate: .1, terminalGrowthRate: .02, years: 5, netDebt: 200000000, sharesOutstanding: 50000000 };
const grid: SensitivityGrid = { terminalGrowthRates: [.02, .025], rows: [
  { discountRate: .09, cells: [{ terminalGrowthRate: .02, valuePerShare: 30, error: null, baseCase: false }, { terminalGrowthRate: .025, valuePerShare: 35, error: null, baseCase: false }] },
  { discountRate: .1, cells: [{ terminalGrowthRate: .02, valuePerShare: 22, error: null, baseCase: true }, { terminalGrowthRate: .025, valuePerShare: null, error: 'An invented unavailable cell', baseCase: false }] },
  { discountRate: .11, cells: [{ terminalGrowthRate: .02, valuePerShare: -5, error: null, baseCase: false }, { terminalGrowthRate: .025, valuePerShare: 0, error: null, baseCase: false }] }
] };

test('sensitivity review keeps negative and zero estimates and handles ties and no valid range', () => {
  const review = sensitivityReview(grid);
  expect(review).toMatchObject({ valid: 5, unavailable: 1, low: { valuePerShare: -5, discountRate: .11 }, high: { valuePerShare: 35, terminalGrowthRate: .025 } });
  expect(review.cells.find(cell => cell.valuePerShare === 0)?.available).toBe(true);
  const tied: SensitivityGrid = { terminalGrowthRates: [.01, .02], rows: [{ discountRate: .1, cells: [.01, .02].map(terminalGrowthRate => ({ terminalGrowthRate, valuePerShare: 10, error: null, baseCase: false })) }] };
  expect(sensitivityReview(tied).low?.terminalGrowthRate).toBe(.01);
  expect(sensitivityReview(tied).high?.terminalGrowthRate).toBe(.01);
  const unavailable: SensitivityGrid = { terminalGrowthRates: [.02], rows: [{ discountRate: .1, cells: [{ terminalGrowthRate: .02, valuePerShare: Infinity, error: null, baseCase: false }] }] };
  expect(sensitivityReview(unavailable)).toMatchObject({ valid: 0, unavailable: 1 });
  expect(sensitivityReview(unavailable).low).toBeUndefined();
  expect(sensitivityReview({ terminalGrowthRates: [], rows: [] }).cells).toEqual([]);
});

test('sensitivity CSV retains fixed inputs, decimal cell rates, unavailable reasons and safe text', () => {
  const company = { ticker: 'AAPL', name: '=My, "company"\nlabel', sector: 'Technology' };
  const rows = readCsv(sensitivityCsv(company, assumptions, grid, '2026-10-21T01:00:00Z', '2026-10-21T02:00:00Z'));
  expect(rows).toHaveLength(6);
  expect(rows[0]).toMatchObject({ schema_version: 'dcf-sensitivity-v1', ticker: 'AAPL', company_name: '\'=My, "company"\nlabel', input_mode: 'user_assumptions', model_version: 'fcff-v1', evaluated_at: '2026-10-21T01:00:00Z', exported_at: '2026-10-21T02:00:00Z', base_free_cash_flow_usd: '100000000', forecast_growth_decimal: '0.05', forecast_years: '5', net_debt_usd: '200000000', shares_outstanding: '50000000', base_discount_rate_decimal: '0.1', base_terminal_growth_decimal: '0.02', cell_discount_rate_decimal: '0.09', cell_terminal_growth_decimal: '0.02', base_case: 'false', modeled_value_per_share_usd: '30', availability: 'available' });
  expect(rows[2].base_case).toBe('true');
  expect(rows[3]).toMatchObject({ modeled_value_per_share_usd: '', availability: 'unavailable', unavailable_reason: 'An invented unavailable cell' });
  expect(rows[4].modeled_value_per_share_usd).toBe('-5');
  expect(rows[5].modeled_value_per_share_usd).toBe('0');
  expect(rows[0].scope).toContain('not a stored historical grid');
});

async function openValuation(page: Page, failed = false, unavailable = false) {
  let sensitivityRequests = 0;
  let failSensitivity = failed;
  // I stub only this model workflow so the check never imports real-company evidence.
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { asOf: '2026-10-06', count: 50, dynamic: false } });
    if (path.endsWith('/scenarios')) return route.fulfill({ json: [] });
    if (path.endsWith('/scenarios/price-context')) return route.fulfill({ json: { ticker: 'DEMO', dataMode: 'example', evaluatedAt: '2026-10-21T01:00:00Z', shareBasisConfirmed: false, quote: null, quoteError: 'No stored close', scenarios: [] } });
    if (path === '/api/valuations/dcf') return route.fulfill({ json: { projections: [{ year: 1, freeCashFlow: 105000000, presentValue: 95454545 }], terminalValue: 1600000000, presentValueOfTerminalValue: 990000000, enterpriseValue: 1300000000, equityValue: 1100000000, valuePerShare: 22, terminalValueShare: .76 } });
    if (path === '/api/valuations/dcf/sensitivity') {
      sensitivityRequests++;
      if (failSensitivity) return route.fulfill({ status: 503, json: { error: 'Sensitivity temporarily unavailable' } });
      return route.fulfill({ json: unavailable ? { terminalGrowthRates: [.02], rows: [{ discountRate: .1, cells: [{ terminalGrowthRate: .02, valuePerShare: null, error: 'Invalid model inputs', baseCase: false }] }] } : grid });
    }
    return route.fulfill({ status: 503, json: { error: 'No financial import in this model-only check.' } });
  });
  await page.goto('/#research?company=DEMO&view=valuation');
  await expect(page.getByRole('button', { name: /Calculate valuation/ })).toBeVisible();
  await page.locator('.company-browser > summary').press('Escape');
  await page.getByRole('button', { name: /Calculate valuation/ }).click();
  return { requests: () => sensitivityRequests, recover: () => { failSensitivity = false; } };
}

test('sensitivity range and CSV share the calculated grid and clear when inputs change', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const control = await openValuation(page, true);
  const section = page.locator('.sensitivity-section');
  await expect(section.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(section.getByRole('button', { name: 'Download sensitivity CSV' })).toHaveCount(0);
  control.recover();
  await section.getByRole('button', { name: 'Retry sensitivity' }).click();
  await expect(section).toContainText('5 of 6 cells available · 1 unavailable');
  await expect(section.locator('.sensitivity-range')).toContainText('-$5.00');
  await expect(section.locator('.sensitivity-range')).toContainText('$35.00');
  await expect(section.locator('.sensitivity-range')).toContainText('WACC 11.00%');
  const beforeExport = control.requests();
  const event = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Download sensitivity CSV' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('DEMO-valuation-sensitivity.csv');
  const rows = readCsv(await readFile((await download.path())!, 'utf8'));
  expect(rows).toHaveLength(6);
  expect(rows[0].input_mode).toBe('fictional_example');
  expect(rows[0].base_discount_rate_decimal).toBe('0.1');
  expect(rows[4].modeled_value_per_share_usd).toBe('-5');
  expect(rows[3].unavailable_reason).toBe('An invented unavailable cell');
  expect(Number.isFinite(Date.parse(rows[0].evaluated_at))).toBe(true);
  expect(control.requests()).toBe(beforeExport);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Discount rate / WACC').fill('12');
  await expect(section).toHaveCount(0);
  await page.getByRole('button', { name: /Calculate valuation/ }).click();
  await expect(page.locator('.sensitivity-range')).toBeVisible();
  const recalculated = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download sensitivity CSV' }).click();
  const next = await recalculated;
  expect(readCsv(await readFile((await next.path())!, 'utf8'))[0].base_discount_rate_decimal).toBe('0.12');
});

test('an unavailable sensitivity grid remains exportable without inventing a modeled range', async ({ page }) => {
  await openValuation(page, false, true);
  const section = page.locator('.sensitivity-section');
  await expect(section).toContainText('0 of 1 cells available · 1 unavailable');
  await expect(section).toContainText('No valid modeled range');
  await expect(section.locator('.sensitivity-range')).toHaveCount(0);
  const event = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Download sensitivity CSV' }).click();
  const download = await event;
  const rows = readCsv(await readFile((await download.path())!, 'utf8'));
  expect(rows[0]).toMatchObject({ modeled_value_per_share_usd: '', availability: 'unavailable', unavailable_reason: 'Invalid model inputs' });
});
