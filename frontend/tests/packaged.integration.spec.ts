import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

// I run these against the packaged Spring app without intercepting its API requests.
test('packaged dashboard serves its catalog and explicitly labeled example', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.company-option')).toHaveCount(50);
  await expect(page.locator('.data-banner')).toContainText('invented figures');
  await expect(page.locator('.metric-card').first()).toContainText('$1.28B');
  await expect(page.getByRole('cell', { name: '$840,000,000.00', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/packaged-research-dashboard.png', fullPage: true });
});

test('dashboard sends percentage inputs to the real Java calculator', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  for (const [label, value] of [
    ['Starting unlevered cash flow', '100'], ['Annual growth', '0'],
    ['Discount rate / WACC', '10'], ['Terminal growth', '0'],
    ['Net debt', '100'], ['Shares outstanding', '10']
  ]) await page.getByRole('spinbutton', { name: label, exact: false }).fill(value);
  await page.getByRole('button', { name: 'Calculate valuation' }).click();
  await expect(page.locator('.result-heading')).toContainText('$90.00');
  await expect(page.locator('.valuation-result > .table-scroll tbody tr')).toHaveCount(5);
  await expect(page.locator('.sensitivity-table .base-case')).toContainText('$90.00');
  await expect(page.locator('.sensitivity-table td')).toHaveCount(25);
  await page.getByRole('spinbutton', { name: 'Annual growth', exact: false }).fill('1');
  await expect(page.locator('.sensitivity-table')).toHaveCount(0);
});

test('unconfigured live SEC access reports a failure rather than serving example data', async ({ page }) => {
  await page.goto('/');
  await page.locator('.company-browser > summary').click();
  await page.getByRole('button', { name: /^Apple/ }).click();
  await expect(page.getByRole('heading', { name: 'Apple', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Live SEC access has not been configured');
  await expect(page.locator('.metric-card')).toHaveCount(0);
});


test('saved scenarios survive reload and can be loaded and deleted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save scenario', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Calculate valuation' }).click();
  await expect(page.locator('.result-heading')).toBeVisible();
  const estimate = await page.locator('.result-heading strong').textContent();
  await page.getByRole('textbox', { name: 'Scenario name' }).fill('My saved base case');
  await page.getByRole('button', { name: 'Save scenario', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load My saved base case', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await page.getByRole('button', { name: 'Load My saved base case', exact: true }).click();
  await expect(page.locator('.result-heading strong')).toHaveText(estimate!);
  await page.getByRole('spinbutton', { name: 'Annual growth', exact: false }).fill('7');
  await expect(page.getByRole('button', { name: 'Save scenario', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Delete My saved base case', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load My saved base case', exact: true })).toHaveCount(0);
});

test('I can inspect fictional peer ratios without confusing them with SEC data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare companies', exact: true }).click();
  await expect(page.locator('.comparison-table')).toBeVisible();
  await expect(page.getByRole('row', { name: /Annual revenue growth/ })).toContainText('10.3%');
  await expect(page.getByRole('row', { name: /Net income margin/ })).toContainText('11.3%');
  await expect(page.getByRole('row', { name: /^Cash after capex / }).first()).toContainText('$125M');
  await expect(page.getByRole('link', { name: 'SEC filing ↗' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Comparison data' }).selectOption('sec');
  await expect(page.locator('.comparison-table')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('SEC_USER_AGENT');
});

test('I can inspect example prices and see a clear error for unconfigured market imports', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prices', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Daily raw prices, newest first' }).locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('These prices are invented', { exact: false })).toBeVisible();
  await page.locator('.company-browser > summary').click();
  await page.getByRole('button', { name: /^Apple/ }).click();
  await page.getByRole('button', { name: 'Prices', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ALPHA_VANTAGE_API_KEY');
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('I can practice buys and partial sales without spending real money', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('textbox', { name: 'Portfolio name', exact: true }).fill('My browser portfolio');
  await page.getByRole('spinbutton', { name: 'Starting cash (USD)' }).fill('1000');
  await page.getByRole('button', { name: 'Create portfolio', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$1,000.00');
  await page.getByRole('spinbutton', { name: 'Shares to trade' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Manual fill price (USD)' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Trade fee (USD)' }).fill('1');
  await page.getByRole('button', { name: 'Record simulated fill', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$799.00');
  await page.getByRole('combobox', { name: 'Trade side' }).selectOption('SELL');
  await page.getByRole('spinbutton', { name: 'Shares to trade' }).fill('4');
  await page.getByRole('spinbutton', { name: 'Manual fill price (USD)' }).fill('30');
  await page.getByRole('spinbutton', { name: 'Trade fee (USD)' }).fill('1');
  await page.getByRole('button', { name: 'Record simulated fill', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$918.00');
  await expect(page.getByTestId('portfolio-realized')).toHaveText('$38.60');
  await page.getByRole('spinbutton', { name: 'Shares to trade' }).fill('100');
  await page.getByRole('spinbutton', { name: 'Manual fill price (USD)' }).fill('30');
  await page.getByRole('button', { name: 'Record simulated fill', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('exceeds the shares held');
  await expect(page.getByRole('table', { name: 'Recorded simulated fills, oldest first' }).locator('tbody tr')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$918.00');
  await expect(page.getByRole('table', { name: 'Holdings at weighted-average cost' })).toContainText('$120.60');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('I can record a simulated split and dividend in order with my trades', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  const create = page.locator('.portfolio-create');
  if (!await create.evaluate(element => (element as HTMLDetailsElement).open)) await create.locator('summary').click();
  await page.getByRole('textbox', { name: 'Portfolio name', exact: true }).fill('My company event portfolio');
  await page.getByRole('spinbutton', { name: 'Starting cash (USD)' }).fill('1000');
  await page.getByRole('button', { name: 'Create portfolio', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$1,000.00');
  await page.getByRole('spinbutton', { name: 'Shares to trade' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Manual fill price (USD)' }).fill('20');
  await page.getByRole('button', { name: 'Record simulated fill', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$800.00');
  await page.getByRole('combobox', { name: 'Event type' }).selectOption('SPLIT');
  await page.getByRole('spinbutton', { name: 'New shares in split ratio' }).fill('2');
  await page.getByRole('button', { name: 'Record simulated event', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Holdings at weighted-average cost' })).toContainText('$200.00');
  await expect(page.getByRole('table', { name: 'Holdings at weighted-average cost' }).getByRole('cell', { name: '20', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Event type' }).selectOption('DIVIDEND');
  await page.getByRole('spinbutton', { name: 'Cash dividend per share (USD)' }).fill('0.5');
  await page.getByRole('button', { name: 'Record simulated event', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$810.00');
  await expect(page.getByTestId('portfolio-dividends')).toHaveText('$10.00');
  await page.getByRole('combobox', { name: 'Trade side' }).selectOption('SELL');
  await page.getByRole('spinbutton', { name: 'Shares to trade' }).fill('5');
  await page.getByRole('spinbutton', { name: 'Manual fill price (USD)' }).fill('15');
  await page.getByRole('button', { name: 'Record simulated fill', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$885.00');
  await expect(page.getByTestId('portfolio-realized')).toHaveText('$25.00');
  await page.reload();
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$885.00');
  await expect(page.getByRole('table', { name: 'Recorded simulated company events' }).locator('tbody tr')).toHaveCount(2);
});


test('I can download research and event CSV files with clear provenance', async ({ page }) => {
  await page.goto('/');
  const financialDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download financial CSV', exact: true }).click();
  const financial = await financialDownload;
  expect(financial.suggestedFilename()).toBe('financial-facts.csv');
  const facts = await readFile((await financial.path())!, 'utf8');
  expect(facts).toContain('"DEMO","Example Manufacturing","example"');
  expect(facts).toContain('1280000000');
  const created = await page.request.post('/api/portfolios', { data: { name: '=My export', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  const trade = await page.request.post(`/api/portfolios/${id}/trades`, { data: {
    requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '1.500001', price: '100.1234', fee: '0.01'
  } });
  expect(trade.ok()).toBe(true);
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  const eventDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download event CSV', exact: true }).click();
  const events = await eventDownload;
  expect(events.suggestedFilename()).toBe('portfolio-events.csv');
  const history = await readFile((await events.path())!, 'utf8');
  expect(history).toContain('"\'=My export"');
  expect(history).toContain(',true,0,');
  expect(history).toContain('1.500001,100.1234,0.01');
});
