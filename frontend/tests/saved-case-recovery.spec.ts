import { expect, test, type Page } from '@playwright/test';
import catalog from './catalog';

const assumptions = { baseFreeCashFlow: 100000000, growthRate: .05, discountRate: .1, terminalGrowthRate: .02, years: 5, netDebt: 200000000, sharesOutstanding: 50000000 };
const result = { projections: [{ year: 1, freeCashFlow: 105000000, presentValue: 95454545 }], terminalValue: 1600000000, presentValueOfTerminalValue: 990000000, enterpriseValue: 1300000000, equityValue: 1100000000, valuePerShare: 22, terminalValueShare: .76 };
const scenario = (id: string) => ({ id, ticker: 'DEMO', name: `My ${id} case`, createdAt: '2026-10-21T01:00:00Z', modelVersion: 'fcff-v1', assumptions, result });
async function setup(page: Page) {
  let fail = true, items = [scenario('base'), scenario('lower')];
  let writes = 0;
  let contextIssue = '';
  // I vary saved-case availability without sending requests to external financial providers.
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/companies/DEMO/scenarios') {
      if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 500, json: { error: 'No writes expected' } }); }
      return fail ? route.fulfill({ status: 503, json: { error: 'Saved research is temporarily unavailable' } }) : route.fulfill({ json: items });
    }
    if (path.endsWith('/scenarios/price-context')) {
      const confirmed = new URL(route.request().url()).searchParams.get('shareBasisConfirmed') === 'true';
      return route.fulfill({ json: { ticker: contextIssue === 'company' ? 'AAPL' : 'DEMO', dataMode: contextIssue === 'mode' ? 'market' : 'example', evaluatedAt: '2026-10-21T01:00:00Z', shareBasisConfirmed: contextIssue === 'confirmation' ? !confirmed : confirmed,
        quote: { close: 20, priceDate: '2026-10-20', priceAgeDays: 1, source: 'Invented check prices', sourceUrl: null, retrievedAt: null }, quoteError: null,
        scenarios: items.map(item => ({ id: item.id, name: item.name, createdAt: item.createdAt, modelVersion: item.modelVersion, modeledShares: item.assumptions.sharesOutstanding, valuePerShare: item.result.valuePerShare, valueMinusClose: confirmed ? 2 : null, relativeGap: confirmed ? .1 : null, unavailableReason: confirmed ? null : 'Confirm the share basis.' })) } });
    }
    if (path === '/api/valuations/dcf') return route.fulfill({ json: result });
    if (path === '/api/valuations/dcf/sensitivity') return route.fulfill({ json: { terminalGrowthRates: [.02], rows: [{ discountRate: .1, cells: [{ terminalGrowthRate: .02, valuePerShare: 22, error: null, baseCase: true }] }] } });
    return route.fulfill({ status: 503, json: { error: 'Not part of this model-only check' } });
  });
  await page.goto('/#research?company=DEMO&view=valuation');
  const saved = page.getByRole('region', { name: 'Saved valuation scenarios' });
  await expect(saved.getByRole('alert')).toContainText('temporarily unavailable');
  await page.locator('.company-browser > summary').press('Escape');
  return { saved, recover: () => { fail = false; }, fail: () => { fail = true; }, replace: (next: typeof items) => { items = next; }, writes: () => writes, contextIssue: (issue: string) => { contextIssue = issue; } };
}

test('saved-case retry preserves the open calculation and name draft without presenting failure as empty', async ({ page }) => {
  const control = await setup(page);
  await expect(control.saved).not.toContainText('No saved scenarios for this company');
  await page.getByRole('button', { name: /Calculate valuation/ }).click();
  await expect(page.locator('.result-heading')).toContainText('$22.00');
  await control.saved.getByLabel('Scenario name').fill('My unsaved next case');
  await expect(control.saved.getByRole('button', { name: 'Save scenario', exact: true })).toBeDisabled();
  expect(control.writes()).toBe(0);
  control.recover();
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  await expect(control.saved.getByRole('button', { name: 'Load My base case' })).toBeVisible();
  await expect(control.saved.getByLabel('Scenario name')).toHaveValue('My unsaved next case');
  await expect(page.locator('.result-heading')).toContainText('$22.00');
  await expect(control.saved.getByRole('button', { name: 'Save scenario', exact: true })).toBeEnabled();
  await expect(control.saved.getByRole('alert')).toHaveCount(0);
  expect(control.writes()).toBe(0);
});

test('reloading reconciles removed comparison cases and preserves search and draft through failure', async ({ page }) => {
  const control = await setup(page);
  control.recover();
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  await control.saved.getByLabel('Compare My base case', { exact: true }).check();
  await control.saved.getByLabel('Compare My lower case', { exact: true }).check();
  await expect(control.saved.locator('.scenario-comparison')).toBeVisible();
  await control.saved.getByLabel('Search saved valuation cases').fill('base');
  await control.saved.getByLabel('Scenario name').fill('My retained draft');
  control.fail();
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  await expect(control.saved.getByRole('alert')).toBeVisible();
  await expect(control.saved.locator('.scenario-list')).toHaveCount(0);
  await expect(control.saved.locator('.scenario-comparison')).toHaveCount(0);
  await expect(control.saved.getByRole('button', { name: 'Download all saved cases CSV' })).toHaveCount(0);
  control.replace([scenario('base')]); control.recover();
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  await expect(control.saved.getByLabel('Search saved valuation cases')).toHaveValue('base');
  await expect(control.saved.getByLabel('Scenario name')).toHaveValue('My retained draft');
  await expect(control.saved).toContainText('1 selected for comparison');
  await expect(control.saved.getByLabel('Compare My base case', { exact: true })).toBeChecked();
  await expect(control.saved.locator('.scenario-comparison')).toHaveCount(0);
  expect(control.writes()).toBe(0);
});

test('a successful empty saved-case read is distinct from failure', async ({ page }) => {
  const control = await setup(page);
  control.replace([]); control.recover();
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  await expect(control.saved).toContainText('No saved scenarios for this company');
  await expect(control.saved).not.toContainText('list is unavailable');
  await expect(control.saved.getByRole('alert')).toHaveCount(0);
});


test('valuation-price evidence rejects mismatched identity and confirmation and recovers on recheck', async ({ page }) => {
  const control = await setup(page);
  control.recover(); control.contextIssue('company');
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  const context = page.getByRole('region', { name: 'Saved valuations and dated prices' });
  for (const issue of ['company', 'mode', 'confirmation']) {
    control.contextIssue(issue);
    await context.getByRole('button', { name: 'Recheck valuation price' }).click();
    await expect(context.getByRole('alert')).toContainText('does not match');
    await expect(context.getByRole('table')).toHaveCount(0);
    await expect(context.getByRole('checkbox')).toBeDisabled();
  }
  control.contextIssue('');
  await context.getByRole('button', { name: 'Recheck valuation price' }).click();
  await expect(context.getByRole('alert')).toHaveCount(0);
  await expect(context.getByTestId('valuation-price-evidence')).toContainText('$20.00');
  await context.getByRole('checkbox').check();
  await expect(context.getByRole('row', { name: /^My base case/ }).getByRole('cell').nth(2)).toHaveText('$2.00');
  expect(control.writes()).toBe(0);
});

test('valuation-price evidence is keyboard scrollable at 320px and hides controls in print', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const control = await setup(page);
  control.recover();
  await control.saved.getByRole('button', { name: 'Reload saved scenarios' }).click();
  const context = page.getByRole('region', { name: 'Saved valuations and dated prices' });
  const viewport = context.getByRole('region', { name: 'Saved valuation price evidence', exact: true });
  await expect(viewport).toHaveAttribute('tabindex', '0');
  const right = context.getByRole('button', { name: 'Scroll Saved valuation price evidence right' });
  await expect(right).toBeEnabled();
  await right.click();
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await viewport.focus();
  const beforeKey = await viewport.evaluate(element => element.scrollLeft);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(beforeKey);
  await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await expect(right).toBeDisabled();
  await expect(context.getByRole('button', { name: 'Scroll Saved valuation price evidence left' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(context.locator('.table-navigation')).toBeHidden();
  await expect(context.getByRole('table')).toBeVisible();
});
