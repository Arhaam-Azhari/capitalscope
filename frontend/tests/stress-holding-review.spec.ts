import { expect, test } from '@playwright/test';
import { reviewStressHoldings } from '../src/stressHoldingReview';
import type { StressResult } from '../src/PortfolioStressResult';
import type { PortfolioMarks } from '../src/types';
import catalog from './catalog';

const portfolio = { id: 'my-stress-review', name: 'My stress review', mode: 'market', initialCash: 400, createdAt: '2026-10-01T00:00:00Z' };
const holding = (ticker: string, value: number | null): PortfolioMarks['holdings'][number] => ({ ticker, quantity: 2, costBasis: 100, close: value === null ? null : value / 2, priceDate: value === null ? null : '2026-10-20', priceAgeDays: value === null ? null : 3, source: 'Invented check prices', sourceUrl: null, retrievedAt: '2026-10-21T00:00:00Z', value, unrealizedPnl: value === null ? null : value - 100, error: value === null ? 'No stored close in this check' : null });
const holdings = [holding('AAPL', 100), holding('MSFT', 150), holding('V', null)];
const marks: PortfolioMarks = { portfolioId: portfolio.id, dataMode: 'market', evaluatedAt: '2026-10-23T00:00:00Z', cash: 100, pricedPositions: 2, totalPositions: 3, complete: false, pricedHoldingsValue: 250, totalValue: null, unrealizedPnl: null, holdings,
  allocation: { available: false, unavailableReason: 'No complete valuation', cashWeight: null, largestHolding: null, largestSector: null, topThreeHoldingsWeight: null, companies: [], sectors: [] } };
const result: StressResult = { baseline: marks, assumptions: { defaultShock: -.2, sectorShocks: {} }, holdings: holdings.map((baseline, i) => ({ baseline, sector: 'Technology', shock: i === 1 ? .2 : -.2, stressedValue: [80, 180, null][i], change: [-20, 30, null][i] })), stressedPricedHoldingsValue: 260, stressedTotalValue: null, change: null, relativeChange: null };

test('stress holding review preserves signed changes, unavailable rows, tie order and original results', () => {
  const rows = [...result.holdings, { ...result.holdings[0], baseline: holding('AMD', 100), change: 30 }, { ...result.holdings[0], baseline: holding('ZERO', 100), change: 0 }];
  const original = JSON.stringify(rows);
  expect(reviewStressHoldings(rows, 'lowest', false).map(row => row.baseline.ticker)).toEqual(['AAPL', 'ZERO', 'AMD', 'MSFT', 'V']);
  expect(reviewStressHoldings(rows, 'absolute', false).map(row => row.baseline.ticker)).toEqual(['AMD', 'MSFT', 'AAPL', 'ZERO', 'V']);
  expect(reviewStressHoldings(rows, 'original', false)).toEqual(rows);
  expect(reviewStressHoldings(rows, 'lowest', true).map(row => row.baseline.ticker)).toEqual(['V']);
  expect(reviewStressHoldings([{ ...rows[0], change: NaN }], 'absolute', true)).toHaveLength(1);
  expect(reviewStressHoldings([], 'original', false)).toEqual([]);
  expect(JSON.stringify(rows)).toBe(original);
});

test('stress holding filters and sorting change the mobile table without rerunning or changing totals', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let runs = 0, writes = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio] });
    if (path === `/api/portfolios/${portfolio.id}`) return route.fulfill({ json: { portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, positions: holdings.map(row => ({ ticker: row.ticker, quantity: row.quantity, costBasis: row.costBasis, averageCost: 50 })), trades: [], events: [] } });
    if (path.endsWith('/valuation')) return route.fulfill({ json: marks });
    if (path.endsWith('/stress')) { runs++; return route.fulfill({ json: result }); }
    if (route.request().method() !== 'GET') writes++;
    return route.fulfill({ json: [] });
  });
  await page.goto('/#research?company=DEMO&view=portfolios');
  const stress = page.getByRole('region', { name: 'Portfolio stress test', exact: true });
  await expect(stress.getByRole('button', { name: 'Run stress test', exact: true })).toBeVisible();
  await page.locator('.company-browser > summary').press('Escape');
  await stress.getByRole('button', { name: 'Run stress test', exact: true }).click();
  await expect(stress.getByTestId('stress-total')).toHaveText('Unavailable');
  const totals = await stress.locator('.result-summary').innerText();
  const table = stress.getByRole('table', { name: 'Hypothetical holding values and baseline evidence', exact: true });
  await stress.getByRole('combobox', { name: /Stress holding order/ }).selectOption('absolute');
  await expect(table.locator('tbody tr').first()).toContainText('MSFT');
  await stress.getByRole('combobox', { name: /Stress holding order/ }).selectOption('lowest');
  await expect(table.locator('tbody tr').first()).toContainText('AAPL');
  await stress.getByLabel('Show unavailable stress changes only', { exact: true }).check();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr')).toContainText('V');
  await expect(table).toContainText('No stored close');
  await expect(stress).toContainText('Showing 1 of 3 holding changes');
  expect(await stress.locator('.result-summary').innerText()).toBe(totals);
  await stress.getByLabel('Show unavailable stress changes only', { exact: true }).uncheck();
  const viewport = stress.getByRole('region', { name: 'Stress holding evidence', exact: true });
  await expect(viewport).toHaveAttribute('tabindex', '0');
  await stress.getByRole('button', { name: 'Scroll Stress holding evidence right', exact: true }).click();
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(runs).toBe(1); expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
