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

test('I value example holdings and leave missing market prices unavailable', async ({ page }) => {
  const created = await page.request.post('/api/portfolios', { data: { name: 'My priced example', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '1' } });
  const values = await page.request.get(`/api/portfolios/${id}/valuation`);
  const marks = await values.json();
  expect(values.ok()).toBe(true); expect(marks.complete).toBe(true);
  expect(marks.cash).toBe(799); expect(marks.pricedHoldingsValue).toBe(216);
  expect(marks.totalValue).toBe(1015); expect(marks.unrealizedPnl).toBe(15);
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await expect(page.getByTestId('portfolio-total-value')).toHaveText('$1,015.00');
  await expect(page.locator('.portfolio-marks')).toContainText('invented example prices');
  await expect(page.getByRole('table', { name: 'Current holdings valued at stored daily closes' })).toContainText('2026-09-19');
  const market = await page.request.post('/api/portfolios', { data: { name: 'My unpriced market', mode: 'market', initialCash: '1000' } });
  const marketId = (await market.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${marketId}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'AAPL', side: 'BUY', quantity: '2', price: '100', fee: '0' } });
  await page.reload();
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(marketId);
  await expect(page.getByTestId('portfolio-total-value')).toHaveText('Unavailable');
  await expect(page.getByTestId('portfolio-unrealized')).toHaveText('Unavailable');
  await expect(page.locator('.portfolio-marks')).toContainText('No stored prices');
  await page.getByRole('button', { name: 'Recheck stored prices' }).click();
  await expect(page.locator('.portfolio-marks')).toContainText('0 of 1 open holdings priced');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('I keep a research shortlist across reloads and open its company analysis', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByRole('combobox', { name: 'Watchlist company' }).selectOption('DEMO');
  await page.getByRole('textbox', { name: 'My investment thesis' }).fill('My thesis depends on margin expansion.');
  await page.getByRole('textbox', { name: 'Risks and evidence to check' }).fill('I need to check capital spending.');
  await page.getByLabel('Next review date').fill('2026-01-01');
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved to the shared watchlist');
  await page.reload();
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'My investment thesis' })).toHaveValue('My thesis depends on margin expansion.');
  await page.getByRole('combobox', { name: 'Show entries' }).selectOption('due');
  await expect(page.locator('.watchlist-cards')).toContainText('2026-01-01 · due');
  await page.getByRole('combobox', { name: 'Research status' }).selectOption('archived');
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.locator('.watchlist-cards')).not.toContainText('Example Manufacturing');
  await page.getByRole('combobox', { name: 'Show entries' }).selectOption('all');
  await expect(page.locator('.watchlist-cards')).toContainText('archived');
  await page.getByRole('button', { name: 'Valuation for DEMO', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Calculate valuation' })).toBeVisible();
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.getByRole('combobox', { name: 'Show entries' }).selectOption('all');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Remove DEMO from watchlist', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Removed from the shared watchlist');
  await expect(page.locator('.watchlist-cards')).not.toContainText('Example Manufacturing');
});

test('I keep my unsaved thesis when another session changes the watchlist', async ({ page }) => {
  await page.request.put('/api/watchlist/DEMO', { data: { status: 'watching', thesis: 'My original thesis', risks: '', reviewDate: null, version: 0 } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'My investment thesis' })).toHaveValue('My original thesis');
  await page.getByRole('textbox', { name: 'My investment thesis' }).fill('My unsaved draft');
  const entryId = (await (await page.request.get('/api/watchlist')).json()).find((entry: { ticker: string }) => entry.ticker === 'DEMO').entryId;
  const changed = await page.request.put('/api/watchlist/DEMO', { data: { status: 'researching', thesis: 'My other session changed this', risks: '', reviewDate: null, version: 1, entryId } });
  expect(changed.ok()).toBe(true);
  await page.getByRole('button', { name: 'Save watchlist entry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('another session');
  await expect(page.getByRole('textbox', { name: 'My investment thesis' })).toHaveValue('My unsaved draft');
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'My investment thesis' })).toHaveValue('My other session changed this');
  await page.getByRole('button', { name: 'Remove DEMO from watchlist', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Removed');
  await page.route('**/api/watchlist', route => route.fulfill({ status: 503, json: { error: 'My test storage is unavailable' } }));
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('storage is unavailable');
  await expect(page.getByRole('button', { name: 'Save watchlist entry', exact: true })).toBeDisabled();
  await page.unroute('**/api/watchlist');
  await page.getByRole('button', { name: 'Reload watchlist', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save watchlist entry', exact: true })).toBeEnabled();
});

test('I inspect cash and company concentration without normalizing missing prices', async ({ page }) => {
  const created = await page.request.post('/api/portfolios', { data: { name: 'My allocation example', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '1' } });
  const allocation = (await (await page.request.get(`/api/portfolios/${id}/valuation`)).json()).allocation;
  expect(allocation.available).toBe(true); expect(allocation.cashWeight).toBeCloseTo(799 / 1015, 9);
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await expect(page.getByTestId('allocation-cash-weight')).toHaveText('78.7%');
  await expect(page.getByTestId('allocation-largest-company')).toHaveText('DEMO · 21.3%');
  await expect(page.getByTestId('allocation-largest-sector')).toHaveText('Fictional Industrials · 21.3%');
  const market = await page.request.post('/api/portfolios', { data: { name: 'My incomplete allocation', mode: 'market', initialCash: '1000' } });
  const marketId = (await market.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${marketId}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'AAPL', side: 'BUY', quantity: '1', price: '100', fee: '0' } });
  await page.reload();
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(marketId);
  await expect(page.getByTestId('allocation-cash-weight')).toHaveText('Unavailable');
  await expect(page.getByTestId('allocation-largest-company')).toHaveText('Unavailable');
  await expect(page.getByRole('table', { name: 'Sector allocation including cash' })).toContainText('Technology');
  await expect(page.locator('.allocation-meter')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('I compare saved Java valuations and keep the open assumptions unchanged', async ({ page }) => {
  const inputs = { baseFreeCashFlow: 100, growthRate: 0, discountRate: .1, terminalGrowthRate: 0, years: 5, netDebt: 100, sharesOutstanding: 10 };
  const base = await page.request.post('/api/companies/DEMO/scenarios', { data: { name: 'My comparison base', assumptions: inputs } });
  const upside = await page.request.post('/api/companies/DEMO/scenarios', { data: { name: 'My comparison upside', assumptions: { ...inputs, growthRate: .1 } } });
  expect(base.ok()).toBe(true); expect(upside.ok()).toBe(true);
  const baseId = (await base.json()).id, upsideId = (await upside.json()).id;
  await page.goto('/');
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Compare My comparison base', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare My comparison upside', exact: true }).check();
  const table = page.getByRole('table', { name: 'Saved assumptions and valuation estimates' });
  await expect(table.getByRole('row', { name: /^Estimated value \/ share/ })).toContainText('$90.00');
  await expect(table.getByRole('row', { name: /^Estimated value \/ share/ })).toContainText('$140.00');
  await expect(table.getByRole('row', { name: /^Difference \/ share/ })).toContainText('$50.00');
  await expect(page.getByRole('spinbutton', { name: 'Starting unlevered cash flow', exact: false })).toHaveValue('100000000');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.scenario-comparison').screenshot({ path: 'test-results/scenario-comparison-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.scenario-comparison').screenshot({ path: 'test-results/scenario-comparison-mobile.png' });
  await page.request.delete(`/api/companies/DEMO/scenarios/${baseId}`);
  await page.request.delete(`/api/companies/DEMO/scenarios/${upsideId}`);
});

test('I stress dated holdings, clear edited assumptions, and withhold unpriced totals', async ({ page }) => {
  const created = await page.request.post('/api/portfolios', { data: { name: 'My stress example', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '1' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('$971.80');
  await expect(page.getByTestId('stress-change')).toHaveText('-$43.20');
  await expect(page.getByRole('table', { name: 'Hypothetical holding values and baseline evidence' })).toContainText('2026-09-19');
  await page.getByLabel('Fictional Industrials override (%)').fill('0');
  await expect(page.getByTestId('stress-total')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('$1,015.00');
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$799.00');
  await page.getByLabel('Fictional Industrials override (%)').fill('');
  await page.getByLabel('Default price change (%)').fill('-0.57');
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('$1,013.77');
  await page.getByLabel('Default price change (%)').fill('-20');
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('$971.80');
  await page.locator('.portfolio-stress').screenshot({ path: 'test-results/portfolio-stress-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.portfolio-stress').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/portfolio-stress-mobile.png', fullPage: true });
  const market = await page.request.post('/api/portfolios', { data: { name: 'My unpriced stress', mode: 'market', initialCash: '1000' } });
  const marketId = (await market.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${marketId}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'AAPL', side: 'BUY', quantity: '1', price: '100', fee: '0' } });
  await page.reload();
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(marketId);
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('Unavailable');
  await expect(page.getByTestId('stress-change')).toHaveText('Unavailable');
});

test('I preserve a saved stress snapshot while rerunning its assumptions on changed holdings', async ({ page }) => {
  const created = await page.request.post('/api/portfolios', { data: { name: 'My saved stress browser', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '1' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await page.getByLabel('Fictional Industrials override (%)').fill('-20');
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('$971.80');
  await page.getByLabel('Stress scenario name', { exact: true }).fill('My downside snapshot');
  await page.getByRole('button', { name: 'Save stress scenario', exact: true }).click();
  await expect(page.getByTestId('saved-stress-total')).toHaveText('$971.80');
  await expect(page.getByRole('region', { name: 'Saved snapshot My downside snapshot' })).toContainText('2026-09-19');
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'SELL', quantity: '10', price: '20', fee: '1' } });
  await page.reload();
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$998.00');
  await page.getByRole('button', { name: 'Review My downside snapshot', exact: true }).click();
  await expect(page.getByTestId('saved-stress-total')).toHaveText('$971.80');
  await page.getByRole('button', { name: 'Load assumptions from My downside snapshot', exact: true }).click();
  await expect(page.getByLabel('Default price change (%)')).toHaveValue('-20.00');
  await expect(page.locator('.portfolio-stress')).toContainText('Overrides for sectors no longer held were omitted: Fictional Industrials.');
  await expect(page.getByTestId('stress-total')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run stress test' }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('$998.00');
  await expect(page.getByTestId('saved-stress-total')).toHaveText('$971.80');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.saved-stress').screenshot({ path: 'test-results/saved-stress-mobile.png' });
  await page.getByRole('button', { name: 'Delete My downside snapshot', exact: true }).click();
  await expect(page.getByTestId('saved-stress-total')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review My downside snapshot', exact: true })).toHaveCount(0);
});

test('I download a saved stress report without replacing its original baseline', async ({ page }) => {
  const created = await page.request.post('/api/portfolios', { data: { name: 'My report portfolio', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '1' } });
  const saved = await page.request.post(`/api/portfolios/${id}/stress-scenarios`, { data: { name: '=My, "stress"\nreport', assumptions: { defaultShock: '-0.2', sectorShocks: {} } } });
  expect(saved.ok()).toBe(true);
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'SELL', quantity: '10', price: '20', fee: '1' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$998.00');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download CSV for/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('portfolio-stress-scenario.csv');
  const content = await readFile((await download.path())!, 'utf8');
  expect(content).toContain('"\'=My, ""stress""\nreport"');
  expect(content).toContain('"default_price_change","decimal_rate",-0.2');
  expect(content).toContain('"stressed_total_value","USD",971.8');
  expect(content).toContain('"cash_held_fixed","USD",799');
  expect(content).toContain('"2026-09-19"');
  expect(content).toContain('"hypothetical","simulated_holdings"');
  expect(content).toContain('Blank values are unavailable, not zero');
  await download.saveAs('test-results/saved-stress-report.csv');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.saved-stress').screenshot({ path: 'test-results/stress-report-download-mobile.png' });
});

test('I compare saved stress cases and withhold differences after holdings change', async ({ page }) => {
  const created = await page.request.post('/api/portfolios', { data: { name: 'My stress comparison', mode: 'example', initialCash: '1000' } });
  const id = (await created.json()).portfolio.id;
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '1' } });
  for (const [name, defaultShock] of [['My downside', '-0.2'], ['My upside', '0.2']] as const)
    expect((await page.request.post(`/api/portfolios/${id}/stress-scenarios`, { data: { name, assumptions: { defaultShock } } })).ok()).toBe(true);
  await page.request.post(`/api/portfolios/${id}/trades`, { data: { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'SELL', quantity: '10', price: '20', fee: '1' } });
  expect((await page.request.post(`/api/portfolios/${id}/stress-scenarios`, { data: { name: 'My changed holdings', assumptions: { defaultShock: '-0.2' } } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open portfolio' }).selectOption(id);
  await page.getByRole('checkbox', { name: 'Compare My downside', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare My upside', exact: true }).check();
  const comparison = page.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  const delta = comparison.getByRole('row', { name: /^Stressed value difference vs reference/ });
  await expect(delta.getByRole('cell').nth(0)).toHaveText('$0.00');
  await expect(delta.getByRole('cell').nth(1)).toHaveText('$86.40');
  await comparison.getByLabel('Reference stress scenario').selectOption({ label: 'My upside' });
  await expect(delta.getByRole('cell').nth(0)).toHaveText('-$86.40');
  await page.getByRole('checkbox', { name: 'Compare My changed holdings', exact: true }).check();
  await expect(delta.getByRole('cell').nth(2)).toHaveText('Unavailable');
  await expect(comparison).toContainText('Some cases have different or incomplete baselines');
  await expect(comparison.getByRole('row', { name: /^DEMO · saved holding/ })).toContainText('Not held');
  await page.locator('.stress-comparison').screenshot({ path: 'test-results/stress-comparison-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.stress-comparison').screenshot({ path: 'test-results/stress-comparison-mobile.png' });
  await page.getByRole('button', { name: 'Delete My upside', exact: true }).click();
  await expect(comparison.getByLabel('Reference stress scenario')).toHaveValue(await comparison.getByLabel('Reference stress scenario').locator('option').first().getAttribute('value') as string);
  await expect(delta.getByRole('cell')).toHaveCount(2);
  await expect(delta.getByRole('cell').nth(0)).toHaveText('$0.00');
  await page.getByRole('checkbox', { name: 'Compare My changed holdings', exact: true }).uncheck();
  await expect(comparison).toHaveCount(0);
});

test('I compare a saved valuation with an invented dated close after checking share basis', async ({ page }) => {
  const response = await page.request.post('/api/companies/DEMO/scenarios', { data: { name: 'My price gap browser', assumptions: {
    baseFreeCashFlow: 1000000, growthRate: 0.05, discountRate: 0.10, terminalGrowthRate: 0.02, years: 5, netDebt: 0, sharesOutstanding: 1000000
  } } });
  expect(response.ok()).toBe(true);
  const saved = await response.json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  const context = page.getByRole('region', { name: 'Saved valuations and dated prices' });
  const row = context.getByRole('row', { name: /^My price gap browser/ });
  await expect(context.getByTestId('valuation-price-evidence')).toContainText('2026-09-19');
  await expect(context.getByTestId('valuation-price-evidence')).toContainText('Invented example close');
  await expect(row.getByRole('cell').nth(2)).toHaveText('Unavailable');
  await context.getByRole('checkbox').check();
  const difference = saved.result.valuePerShare - 21.6;
  await expect(row.getByRole('cell').nth(2)).toHaveText(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(difference));
  await expect(row.getByRole('cell').nth(3)).toHaveText(`${(difference / 21.6 * 100).toFixed(2)}%`);
  await context.getByRole('button', { name: 'Recheck valuation price' }).click();
  await expect(context.getByRole('checkbox')).not.toBeChecked();
  await expect(row.getByRole('cell').nth(2)).toHaveText('Unavailable');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.screenshot({ path: 'test-results/valuation-price-context-mobile.png' });
  await page.request.delete(`/api/companies/DEMO/scenarios/${saved.id}`);
});
