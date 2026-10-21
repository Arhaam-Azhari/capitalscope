import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import catalog from './catalog';
import { readCsv } from './readCsv';

// I use invented raw closes to check table access without contacting a market provider.
const prices = (ticker: string) => ({ ticker, currency: 'USD', adjusted: false, dataMode: 'market', source: 'Invented browser-check snapshot', sourceUrl: null, retrievedAt: '2026-10-21T00:00:00Z',
  days: (ticker === 'AAPL' ? [['2026-10-04', 110], ['2026-10-03', 90], ['2026-10-02', 95], ['2026-10-01', 100]] : [['2026-10-04', 55], ['2026-10-03', 52], ['2026-10-01', 50]]).map(([date, close]) => ({ date, close, open: close, high: close, low: close, volume: 1000 })) });

test('price evidence tables expose keyboard and button navigation on phones without changing CSV scope', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let priceReads = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    const ticker = path.match(/^\/api\/companies\/(AAPL|MSFT)\/prices$/)?.[1];
    if (ticker) { priceReads++; return route.fulfill({ json: prices(ticker) }); }
    if (path.endsWith('/price-comparison-setups')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 503, json: { error: 'Not part of this price-only check' } });
  });
  await page.goto('/#research?company=AAPL&view=prices');
  const comparison = page.getByRole('region', { name: 'Compare company prices', exact: true });
  await expect(comparison.getByRole('button', { name: 'Load price comparison', exact: true })).toBeVisible();
  await page.locator('.company-browser > summary').press('Escape');
  await comparison.getByRole('combobox', { name: /Comparison company/ }).selectOption('MSFT');
  await comparison.getByRole('button', { name: 'Load price comparison', exact: true }).click();
  await expect(comparison.getByRole('table', { name: 'Shared-date raw closes and index values' })).toBeVisible();
  await comparison.getByText('Inspect shared and excluded price dates', { exact: true }).click();
  await comparison.getByText('Inspect every shared-date interval', { exact: true }).click();
  const tables = comparison.locator('.evidence-table');
  await expect(tables).toHaveCount(5);
  for (const table of await tables.all()) {
    await expect(table.locator('thead th:not([scope="col"])')).toHaveCount(0);
    const viewport = table.locator('.table-scroll');
    const overflow = await viewport.evaluate(element => element.scrollWidth > element.clientWidth + 1);
    if (overflow) {
      await expect(viewport).toHaveAttribute('tabindex', '0');
      await expect(viewport).toHaveAttribute('role', 'region');
      await expect(table.getByRole('button', { name: / right$/ })).toBeEnabled();
    }
  }
  const shared = comparison.getByRole('region', { name: 'Shared-date price evidence', exact: true });
  await shared.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => shared.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  const interval = comparison.getByRole('region', { name: 'Shared-date interval changes', exact: true });
  const before = await interval.evaluate(element => element.scrollLeft);
  await comparison.getByRole('button', { name: 'Scroll Shared-date interval changes right', exact: true }).click();
  await expect.poll(() => interval.evaluate(element => element.scrollLeft)).toBeGreaterThan(before);
  await comparison.getByLabel('Minimum absolute interval gap (percentage points)').fill('1000');
  await expect(comparison).toContainText('Showing 0 of 2 intervals');
  const readsBeforeExport = priceReads;
  const downloadEvent = page.waitForEvent('download');
  await comparison.getByRole('button', { name: 'Download price intervals CSV', exact: true }).click();
  const download = await downloadEvent;
  expect(readCsv(await readFile((await download.path())!, 'utf8'))).toHaveLength(2);
  expect(priceReads).toBe(readsBeforeExport);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  for (const control of await comparison.locator('.table-navigation').all()) await expect(control).toBeHidden();
  await expect(comparison.getByRole('table', { name: 'Shared-date raw closes and index values' })).toBeVisible();
});
