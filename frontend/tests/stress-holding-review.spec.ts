import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readCsv } from './readCsv';
import { stressComparisonCsv, stressReferenceDifference } from '../src/stressComparisonCsv';
import type { SavedStress } from '../src/SavedPortfolioStress';
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

test('I filter saved shock assumptions without hiding baseline differences or export evidence', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const fullMarks = { ...marks, complete: true, totalPositions: 2, totalValue: 350, holdings: holdings.slice(0, 2) };
  const fullResult = { ...result, baseline: fullMarks, assumptions: { defaultShock: 0, sectorShocks: { Technology: 0, Healthcare: -.1 } as Record<string, number> }, holdings: result.holdings.slice(0, 2), stressedTotalValue: 360, change: 10, relativeChange: 10 / 350 };
  const base = { id: 'base', portfolioId: portfolio.id, name: 'My explicit zero', createdAt: '2026-10-23T00:00:00Z', modelVersion: 'price-shock-v1', result: fullResult };
  const inherited = structuredClone(base); inherited.id = 'inherited'; inherited.name = 'My inherited zero';
  delete inherited.result.assumptions.sectorShocks.Technology;
  const later = structuredClone(base); later.id = 'later'; later.name = 'My changed cash';
  later.result.baseline.cash = 200; later.result.baseline.totalValue = 450; later.result.stressedTotalValue = 460;
  let writes = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes++;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio] });
    if (path === `/api/portfolios/${portfolio.id}`) return route.fulfill({ json: { portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, positions: [], trades: [], events: [] } });
    if (path.endsWith('/valuation')) return route.fulfill({ json: fullMarks });
    if (path.endsWith('/stress-scenarios')) return route.fulfill({ json: [base, inherited, later] });
    return route.fulfill({ json: [] });
  });
  await page.goto('/#research?company=DEMO&view=portfolios');
  await page.locator('.company-browser > summary').press('Escape');
  for (const name of [base.name, later.name]) await page.getByRole('checkbox', { name: `Compare ${name}`, exact: true }).check();
  const comparison = page.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  const table = comparison.getByRole('table', { name: 'Saved stress assumptions, baselines, and results', exact: true });
  const results = await table.getByRole('row', { name: /^Stressed total value/ }).innerText();
  await comparison.getByLabel('Show differing shock assumptions only', { exact: true }).check();
  await expect(comparison).toContainText('0 of 3 shock assumption rows differ');
  await expect(comparison.getByRole('status').filter({ hasText: 'identical shock assumptions' })).toHaveCount(1);
  await expect(table.getByRole('row', { name: /^Default price change/ })).toHaveCount(0);
  await expect(table.getByRole('row', { name: /^Healthcare override/ })).toHaveCount(0);
  await expect(table.getByRole('row', { name: /^Cash held fixed/ })).toContainText('$200.00');
  await expect(table.getByRole('row', { name: /^Stressed value difference vs reference/ }).getByRole('cell').nth(1)).toHaveText('Unavailable');
  expect(await table.getByRole('row', { name: /^Stressed total value/ }).innerText()).toBe(results);
  await page.getByRole('checkbox', { name: `Compare ${inherited.name}`, exact: true }).check();
  await expect(comparison).toContainText('1 of 3 shock assumption rows differ');
  const override = table.getByRole('row', { name: /^Technology override/ });
  await expect(override).toContainText('0.00%'); await expect(override).toContainText('Inherit default');
  await expect(table.getByRole('row', { name: /^AAPL · saved holding/ })).toContainText('Invented check prices');
  await comparison.getByLabel('Reference stress scenario').selectOption('inherited');
  await expect(table.getByRole('row', { name: /^Stressed value difference vs reference/ }).getByRole('cell').nth(0)).toHaveText('$0.00');
  const viewport = comparison.getByRole('region', { name: 'Saved stress comparison evidence', exact: true });
  await expect(viewport).toHaveAttribute('tabindex', '0');
  await comparison.getByRole('button', { name: 'Scroll Saved stress comparison evidence right', exact: true }).click();
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  const beforeKey = await viewport.evaluate(element => element.scrollLeft);
  await viewport.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(beforeKey);
  await expect(table.locator('tbody th').first()).toHaveCSS('position', 'sticky');
  await expect(page.getByRole('link', { name: `Download CSV for ${base.name}`, exact: true })).toHaveAttribute('href', `/api/portfolios/${portfolio.id}/stress-scenarios/base/export.csv`);
  await comparison.getByLabel('Show differing shock assumptions only', { exact: true }).uncheck();
  await expect(table.getByRole('row', { name: /^Default price change/ })).toHaveCount(1);
  await expect(table.getByRole('row', { name: /^Healthcare override/ })).toHaveCount(1);
  expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(comparison.locator('.table-navigation')).toBeHidden();
});

test('I recover saved stress reads while keeping my preview and draft separate from unavailable evidence', async ({ page }) => {
  const base = { id: 'base', portfolioId: portfolio.id, name: 'My saved downside', createdAt: '2026-10-23T00:00:00Z', modelVersion: 'price-shock-v1', result };
  const other = { ...base, id: 'other', name: 'My removed downside' };
  let reads = 0, writes = 0, runs = 0, phase = 1;
  let releaseRead!: () => void;
  const pendingRead = new Promise<void>(resolve => { releaseRead = resolve; });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/stress')) { runs++; return route.fulfill({ json: result }); }
    if (route.request().method() !== 'GET') writes++;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio] });
    if (path === `/api/portfolios/${portfolio.id}`) return route.fulfill({ json: { portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, positions: [], trades: [], events: [] } });
    if (path.endsWith('/valuation')) return route.fulfill({ json: marks });
    if (path.endsWith('/stress-scenarios')) {
      reads++;
      if (phase === 1) return route.fulfill({ status: 503, json: { error: 'My temporary saved stress failure' } });
      if (phase === 2) return route.fulfill({ json: [base, other] });
      if (phase === 3) { await pendingRead; return route.fulfill({ status: 503, json: { error: 'My reload failed' } }); }
      if (phase === 4) return route.fulfill({ json: [{ ...base, portfolioId: 'another-portfolio' }] });
      if (phase === 5) return route.fulfill({ json: [{ ...base, result: { ...result, baseline: { ...marks, portfolioId: 'another-portfolio' } } }] });
      return route.fulfill({ json: phase === 6 ? [base] : [] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/#research?company=DEMO&view=portfolios');
  await page.locator('.company-browser > summary').press('Escape');
  const saved = page.getByRole('region', { name: 'Saved portfolio stress scenarios', exact: true });
  const reload = saved.getByRole('button', { name: 'Reload saved stress scenarios', exact: true });
  const save = saved.getByRole('button', { name: 'Save stress scenario', exact: true });
  await expect(saved.getByRole('alert')).toHaveText('My temporary saved stress failure');
  await expect(saved).not.toContainText('No saved stress scenarios for this portfolio.');
  await page.getByRole('button', { name: 'Run stress test', exact: true }).click();
  await expect(page.getByTestId('stress-total')).toHaveText('Unavailable');
  await saved.getByLabel('Stress scenario name', { exact: true }).fill('My retained name draft');
  await expect(save).toBeDisabled();
  phase = 2;
  await reload.click();
  await expect(save).toBeEnabled();
  for (const name of [base.name, other.name]) await saved.getByRole('checkbox', { name: `Compare ${name}`, exact: true }).check();
  await saved.getByRole('button', { name: `Review ${other.name}`, exact: true }).click();
  const comparison = saved.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  const snapshot = saved.getByRole('region', { name: `Saved snapshot ${other.name}`, exact: true });
  await expect(comparison).toBeVisible(); await expect(snapshot).toBeVisible();
  phase = 3;
  await reload.click();
  await expect(saved.getByRole('status')).toHaveText('Loading saved stress scenarios…');
  await expect(comparison).toHaveCount(0); await expect(snapshot).toHaveCount(0);
  await expect(saved.getByRole('link', { name: /^Download CSV for/ })).toHaveCount(0);
  await expect(reload).toBeDisabled(); await expect(save).toBeDisabled();
  releaseRead();
  await expect(saved.getByRole('alert')).toHaveText('My reload failed');
  await expect(saved.getByLabel('Stress scenario name', { exact: true })).toHaveValue('My retained name draft');
  await expect(page.getByTestId('stress-total')).toHaveText('Unavailable');
  for (let i = 0; i < 2; i++) {
    phase = 4 + i;
    await reload.click();
    await expect(saved.getByRole('alert')).toContainText('do not match this portfolio');
    await expect(save).toBeDisabled();
    await expect(saved.getByRole('link', { name: /^Download CSV for/ })).toHaveCount(0);
  }
  phase = 6;
  await reload.click();
  await expect(saved.getByRole('checkbox', { name: `Compare ${base.name}`, exact: true })).toBeChecked();
  await expect(saved.getByRole('checkbox', { name: `Compare ${other.name}`, exact: true })).toHaveCount(0);
  await expect(snapshot).toHaveCount(0); await expect(comparison).toHaveCount(0);
  await expect(save).toBeEnabled();
  await expect(saved.getByLabel('Stress scenario name', { exact: true })).toHaveValue('My retained name draft');
  await expect(page.getByLabel('Default price change (%)', { exact: true })).toHaveValue('-20');
  phase = 7;
  await reload.click();
  await expect(saved).toContainText('No saved stress scenarios for this portfolio.');
  await expect(saved.getByRole('alert')).toHaveCount(0);
  expect(reads).toBeGreaterThanOrEqual(7); expect(runs).toBe(1); expect(writes).toBe(0);
});

test('I organize saved stress cases without losing hidden selections or the open snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const cases = [
    { id: 'c', name: 'My copper case', createdAt: '2026-10-21T00:00:00Z' },
    { id: 'a', name: 'My amber case', createdAt: '2026-10-22T00:00:00Z' },
    { id: 'b', name: 'My amber case', createdAt: '2026-10-22T00:00:00Z' },
    { id: 'd', name: 'My downside case', createdAt: '2026-10-20T00:00:00Z' },
    { id: 'e', name: 'My energy case', createdAt: '2026-10-19T00:00:00Z' }
  ].map((item, i) => ({ ...item, portfolioId: portfolio.id, modelVersion: i === 4 ? 'my-future-model' : 'price-shock-v1', result: { ...result,
    holdings: i === 4 ? [{ ...result.holdings[0], sector: 'Energy', baseline: { ...holdings[0], ticker: 'XOM' } }] : result.holdings } }));
  let current = cases, writes = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes++;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio] });
    if (path === `/api/portfolios/${portfolio.id}`) return route.fulfill({ json: { portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, positions: [], trades: [], events: [] } });
    if (path.endsWith('/valuation')) return route.fulfill({ json: marks });
    if (path.endsWith('/stress-scenarios')) return route.fulfill({ json: current });
    return route.fulfill({ json: [] });
  });
  await page.goto('/#research?company=DEMO&view=portfolios');
  await page.locator('.company-browser > summary').press('Escape');
  const saved = page.getByRole('region', { name: 'Saved portfolio stress scenarios', exact: true });
  const list = saved.locator(':scope > .scenario-list');
  const links = list.getByRole('link', { name: /^Download CSV for/ });
  const ids = async () => (await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')!.split('/').at(-2))));
  const query = saved.getByRole('searchbox', { name: 'Search saved stress scenarios', exact: true });
  const sort = saved.getByRole('combobox', { name: 'Sort saved stress scenarios', exact: true });
  await expect(links).toHaveCount(5);
  expect(await ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
  await sort.selectOption('oldest'); expect(await ids()).toEqual(['e', 'd', 'c', 'a', 'b']);
  await sort.selectOption('name'); expect(await ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
  for (const text of [' XoM ', 'energy', 'my-future-model']) {
    await query.fill(text); await expect(links).toHaveCount(1); expect(await ids()).toEqual(['e']);
  }
  await query.fill('copper'); await expect(links).toHaveCount(1);
  await query.fill('not present'); await expect(saved).toContainText('No saved stress scenarios match these filters.');
  await expect(saved).not.toContainText('No saved stress scenarios for this portfolio.');
  await saved.getByRole('button', { name: 'Reset stress list filters', exact: true }).click();
  await expect(sort).toHaveValue('newest'); await expect(query).toHaveValue('');
  for (const checkbox of (await list.getByRole('checkbox').all()).slice(0, 4)) await checkbox.check();
  await expect(list.getByRole('checkbox').nth(4)).toBeDisabled();
  await saved.getByRole('button', { name: 'Review My copper case', exact: true }).click();
  await saved.getByLabel('Show selected stress scenarios only', { exact: true }).check();
  await expect(links).toHaveCount(4);
  await query.fill('XOM'); await expect(links).toHaveCount(0);
  const comparison = saved.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  const snapshot = saved.getByRole('region', { name: 'Saved snapshot My copper case', exact: true });
  await expect(comparison).toBeVisible(); await expect(snapshot).toBeVisible();
  await expect(saved).toContainText('0 of 5 saved stress scenarios shown · 4 selected for comparison');
  current = cases.filter(item => item.id !== 'c');
  await saved.getByRole('button', { name: 'Reload saved stress scenarios', exact: true }).click();
  await expect(saved).toContainText('0 of 4 saved stress scenarios shown · 3 selected for comparison');
  await expect(query).toHaveValue('XOM'); await expect(sort).toHaveValue('newest');
  await expect(saved.getByLabel('Show selected stress scenarios only', { exact: true })).toBeChecked();
  await expect(snapshot).toHaveCount(0); await expect(comparison).toBeVisible();
  await saved.getByRole('button', { name: 'Clear stress comparison', exact: true }).click();
  await expect(comparison).toHaveCount(0);
  await expect(query).toHaveValue('XOM'); await expect(links).toHaveCount(0);
  await saved.getByRole('button', { name: 'Reset stress list filters', exact: true }).click();
  await expect(links).toHaveCount(4);
  await expect(list.getByRole('checkbox', { checked: true })).toHaveCount(0);
  expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

function myComparisonCases(): SavedStress[] {
  const baseline = { ...marks, complete: true, totalPositions: 2, totalValue: 350, holdings: holdings.slice(0, 2) };
  const make = (id: string, shock: number): SavedStress => ({ id, portfolioId: portfolio.id, name: `My ${id} case`, createdAt: '2026-10-23T00:00:00Z', modelVersion: 'price-shock-v1',
    result: { baseline, assumptions: { defaultShock: 0, sectorShocks: { Healthcare: -.1, Technology: shock } },
      holdings: baseline.holdings.map(mark => ({ baseline: mark, sector: 'Technology', shock, stressedValue: mark.value! * (1 + shock), change: mark.value! * shock })),
      stressedPricedHoldingsValue: 250 * (1 + shock), stressedTotalValue: 350 + 250 * shock, change: 250 * shock, relativeChange: 250 * shock / 350 } });
  return [make('base', 0), make('downside', -.2)];
}

test('I export selected stress evidence with safe text, signed values, missing data and guarded reference differences', () => {
  const [base, downside] = myComparisonCases();
  base.name = '=My, "quoted" case\nwith a second line';
  delete downside.result.assumptions.sectorShocks.Healthcare;
  const original = JSON.stringify([base, downside]);
  const rows = readCsv(stressComparisonCsv([base, downside], base.id, '2026-10-23T20:00:00Z'));
  const summary = rows.filter(row => row.record_type === 'scenario');
  expect(summary).toHaveLength(2);
  expect(summary[0]).toMatchObject({ schema_version: 'stress-comparison-v1', scenario_name: "'" + base.name, reference_scenario_id: 'base', reference_difference: '0', baseline_matches_reference: 'true', default_shock: '0', currency: 'USD' });
  expect(summary[1]).toMatchObject({ stressed_total: '300', change: '-50', reference_difference: '-50', reference_difference_unavailable_reason: '' });
  expect(rows.find(row => row.scenario_id === 'downside' && row.record_type === 'sector_assumption' && row.sector === 'Healthcare')).toMatchObject({ override_kind: 'inherit_default', sector_override: '', applied_shock: '0' });
  expect(rows.find(row => row.scenario_id === 'base' && row.record_type === 'sector_assumption' && row.sector === 'Technology')).toMatchObject({ override_kind: 'explicit', sector_override: '0', applied_shock: '0' });
  expect(rows.find(row => row.scenario_id === 'downside' && row.record_type === 'holding' && row.ticker === 'AAPL')).toMatchObject({ quantity: '2', cost_basis: '100', raw_close: '50', price_date: '2026-10-20', price_age_days: '3', source: 'Invented check prices', retrieved_at: '2026-10-21T00:00:00Z', baseline_value: '100', stressed_value: '80', holding_change: '-20', applied_shock: '-0.2' });
  expect(JSON.stringify([base, downside])).toBe(original);
  expect(stressReferenceDifference(base, downside).value).toBe(50);
  for (const change of ['cash', 'partial', 'model', 'total', 'overflow']) {
    const changed = structuredClone(downside);
    if (change === 'cash') changed.result.baseline.cash++;
    if (change === 'partial') changed.result.baseline.complete = false;
    if (change === 'model') changed.modelVersion = 'price-shock-v2';
    if (change === 'total') changed.result.stressedTotalValue = NaN;
    if (change === 'overflow') { changed.result.stressedTotalValue = -Number.MAX_VALUE; }
    const reference = structuredClone(base);
    if (change === 'overflow') reference.result.stressedTotalValue = Number.MAX_VALUE;
    const row = readCsv(stressComparisonCsv([reference, changed], reference.id, 'now')).find(row => row.record_type === 'scenario' && row.scenario_id === changed.id)!;
    expect(row.reference_difference).toBe(''); expect(row.reference_difference_unavailable_reason).not.toBe('');
    if (change === 'total') expect(row.stressed_total).toBe('');
  }
  const partial: SavedStress = { ...downside, result };
  const missing = readCsv(stressComparisonCsv([base, partial], base.id, 'now')).find(row => row.record_type === 'holding' && row.ticker === 'V')!;
  expect(missing).toMatchObject({ baseline_value: '', raw_close: '', stressed_value: '', holding_change: '', price_error: 'No stored close in this check' });
  for (const invalid of [[], [base], [base, base], [...Array(5)].map((_, i) => ({ ...base, id: String(i) })), [base, { ...downside, portfolioId: 'other' }], [base, { ...downside, result: { ...downside.result, baseline: { ...marks, portfolioId: 'other' } } }]])
    expect(() => stressComparisonCsv(invalid, base.id, 'now')).toThrow('two to four different saved stress cases');
  expect(() => stressComparisonCsv([base, downside], 'missing', 'now')).toThrow('Choose a reference');
});

test('I download the complete selected stress comparison despite filters and can retry a failed download', async ({ page }) => {
  const cases = myComparisonCases();
  let writes = 0, requests = 0;
  await page.route('**/api/**', route => {
    requests++;
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes++;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/portfolios') return route.fulfill({ json: [portfolio] });
    if (path === `/api/portfolios/${portfolio.id}`) return route.fulfill({ json: { portfolio, cash: 100, realizedPnl: 0, dividendIncome: 0, positions: [], trades: [], events: [] } });
    if (path.endsWith('/valuation')) return route.fulfill({ json: cases[0].result.baseline });
    if (path.endsWith('/stress-scenarios')) return route.fulfill({ json: cases });
    return route.fulfill({ json: [] });
  });
  await page.goto('/#research?company=DEMO&view=portfolios');
  await page.locator('.company-browser > summary').press('Escape');
  const saved = page.getByRole('region', { name: 'Saved portfolio stress scenarios', exact: true });
  for (const item of cases) await saved.getByRole('checkbox', { name: `Compare ${item.name}`, exact: true }).check();
  const comparison = saved.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  await saved.getByRole('searchbox', { name: 'Search saved stress scenarios', exact: true }).fill('no matching case');
  await comparison.getByLabel('Show differing shock assumptions only', { exact: true }).check();
  await expect(comparison.getByRole('row', { name: /^Default price change/ })).toHaveCount(0);
  await expect(comparison.getByRole('row', { name: /^Healthcare override/ })).toHaveCount(0);
  await comparison.getByRole('combobox', { name: /^Reference stress scenario/ }).selectOption('downside');
  const before = requests;
  await page.evaluate(() => { const original = URL.createObjectURL; URL.createObjectURL = () => { URL.createObjectURL = original; throw new Error('My download failure'); }; });
  const button = comparison.getByRole('button', { name: 'Download stress comparison CSV', exact: true });
  await button.click();
  await expect(comparison.getByRole('alert')).toHaveText('The stress comparison CSV could not be prepared. Please try again.');
  const pending = page.waitForEvent('download'); await button.click(); const download = await pending;
  expect(download.suggestedFilename()).toBe('saved-stress-comparison.csv');
  const rows = readCsv(await readFile((await download.path())!, 'utf8'));
  expect(rows.filter(row => row.record_type === 'scenario')).toHaveLength(2);
  expect(rows.every(row => row.reference_scenario_id === 'downside')).toBe(true);
  expect(rows.find(row => row.scenario_id === 'base' && row.record_type === 'scenario')).toMatchObject({ reference_difference: '50', default_shock: '0' });
  expect(rows.filter(row => row.record_type === 'sector_assumption' && row.sector === 'Healthcare')).toHaveLength(2);
  expect(rows.filter(row => row.record_type === 'holding')).toHaveLength(4);
  await expect(comparison.getByRole('alert')).toHaveCount(0);
  await expect(saved.getByRole('searchbox', { name: 'Search saved stress scenarios', exact: true })).toHaveValue('no matching case');
  await expect(comparison.getByLabel('Show differing shock assumptions only', { exact: true })).toBeChecked();
  expect(writes).toBe(0); expect(requests).toBe(before);
});
