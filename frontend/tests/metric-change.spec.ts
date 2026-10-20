import { expect, test } from '@playwright/test';
import { metricChange } from '../src/metricChange';
import type { Metric, Point } from '../src/types';
import catalog from './catalog';
import { metricChangeCsv } from '../src/metricChangeCsv';
import { readCsv } from './readCsv';
import { readFile } from 'node:fs/promises';
import type { FinancialReport } from '../src/types';

const point = (value: number, periodEnd: string, periodStart: string | null): Point => ({ value, periodEnd, periodStart, filed: null, accession: null, sourceUrl: null, tag: 'InventedTestFact' });
const metric = (latest = 120, prior = 100): Metric => ({ name: 'Net income', unit: 'USD', annualValues: [point(latest, '2025-12-31', '2025-01-01'), point(prior, '2024-12-31', '2024-01-01')] });

test('reported changes preserve losses and withhold misleading nonpositive-base percentages', () => {
  expect(metricChange(metric(-10, 20))).toMatchObject({ amount: -30, percentage: -150, reason: '' });
  expect(metricChange(metric(20, -10))).toMatchObject({ amount: 30, reason: '' });
  expect(metricChange(metric(20, -10)).percentage).toBeUndefined();
  expect(metricChange(metric(-5, 0)).percentage).toBeUndefined();
  expect(metricChange(metric(20, -10)).percentageReason).toContain('positive prior value');
  expect(metricChange(metric(-5, 0))).toMatchObject({ amount: -5, reason: '' });
  expect(metricChange(metric(0, 20))).toMatchObject({ amount: -20, percentage: -100 });
  expect(metricChange(metric(20, 20))).toMatchObject({ amount: 0, percentage: 0 });
  expect(metricChange(metric(120, 100))).toMatchObject({ amount: 20, percentage: 20 });
});

test('annual flow comparisons reject mismatched windows and missing years but allow fiscal week changes', () => {
  const missingStart = metric(); missingStart.annualValues[0].periodStart = null;
  expect(metricChange(missingStart).amount).toBeUndefined();
  expect(metricChange(missingStart).reason).toContain('known starts');
  const shorter = metric(); shorter.annualValues[0].periodStart = '2025-03-01';
  expect(metricChange(shorter).amount).toBeUndefined();
  const missingYear = metric(); missingYear.annualValues[1] = point(100, '2023-12-31', '2023-01-01');
  expect(metricChange(missingYear).reason).toContain('Older gaps');
  const weeks: Metric = { name: 'Revenue', unit: 'USD', annualValues: [point(120, '2025-02-01', '2024-01-28'), point(100, '2024-01-27', '2023-01-29')] };
  expect(metricChange(weeks)).toMatchObject({ amount: 20, percentage: 20, reason: '' });
  const balance: Metric = { name: 'Cash and equivalents', unit: 'USD', annualValues: [point(80, '2025-12-31', null), point(100, '2024-12-31', null)] };
  expect(metricChange(balance)).toMatchObject({ balance: true, amount: -20, percentage: -20, reason: '' });
});

test('invalid dates, ambiguous periods and nonfinite arithmetic do not produce a reported change', () => {
  const invalid = metric(); invalid.annualValues[0].periodEnd = '2025-02-30';
  expect(metricChange(invalid).reason).toContain('invalid or duplicated');
  const duplicate = metric(); duplicate.annualValues.push({ ...duplicate.annualValues[1] });
  expect(metricChange(duplicate).amount).toBeUndefined();
  const ambiguous = metric(); ambiguous.annualValues.push(point(99, '2024-12-30', '2024-01-01'));
  expect(metricChange(ambiguous).reason).toContain('unique comparison');
  expect(metricChange(metric(Infinity, 100)).amount).toBeUndefined();
  expect(metricChange(metric(Number.MAX_VALUE, -Number.MAX_VALUE)).amount).toBeUndefined();
  expect(metricChange({ ...metric(), unit: 'EUR' }).amount).toBeUndefined();
  expect(metricChange({ ...metric(), annualValues: [] }).reason).toContain('No reported');
  const reversed = metric(); reversed.annualValues.reverse();
  expect(metricChange(reversed)).toMatchObject({ amount: 20, percentage: 20 });
  expect(reversed.annualValues[0].periodEnd).toBe('2024-12-31');
  expect(metricChange(metric(1, Number.MIN_VALUE)).amount).toBe(1);
  expect(metricChange(metric(1, Number.MIN_VALUE)).percentage).toBeUndefined();
});

test('selected metric comparison changes with the evidence and fits a small phone', async ({ page }) => {
  const metrics: Metric[] = [
    { ...metric(120, 100), name: 'Revenue' }, metric(20, -10),
    { name: 'Cash and equivalents', unit: 'USD', annualValues: [point(80, '2025-12-31', null), point(100, '2024-12-31', null)] },
    { ...metric(120, 100), name: 'Capital expenditure', annualValues: [point(120, '2025-12-31', '2025-03-01'), point(100, '2024-12-31', '2024-01-01')] }
  ];
  // I use invented amounts to check reporting semantics without contacting a financial provider.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { asOf: '2026-10-06', count: 50, dynamic: false } });
    if (path === '/api/examples/financials') return route.fulfill({ json: { company: { ticker: 'DEMO', name: 'Example Manufacturing', sector: 'Industrials' }, cik: null, retrievedAt: null, servedAt: '2026-10-19T00:00:00Z', source: 'Invented example figures', dataMode: 'example', notes: ['Invented for this check.'], metrics } });
    return route.fulfill({ status: 404, json: { error: 'Not in this fixture.' } });
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const revenue = page.getByRole('region', { name: 'Revenue year-over-year comparison' });
  await expect(revenue.getByTestId('metric-dollar-change')).toHaveText('+$20.00');
  await expect(revenue.getByTestId('metric-percentage-change')).toHaveText('+20.0%');
  await expect(revenue).toContainText('2024-01-01 to 2024-12-31 → 2025-01-01 to 2025-12-31');
  await page.locator('.company-browser > summary').press('Escape');
  await page.locator('.metric-card').filter({ hasText: 'Net income' }).click();
  const income = page.getByRole('region', { name: 'Net income year-over-year comparison' });
  await expect(income.getByTestId('metric-dollar-change')).toHaveText('+$30.00');
  await expect(income.getByTestId('metric-percentage-change')).toHaveText('Unavailable');
  await expect(income).toContainText('positive prior value');
  const exportRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) exportRequests.push(request.url()); });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download annual changes CSV', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('DEMO-annual-changes.csv');
  const records = readCsv(await readFile((await download.path())!, 'utf8'));
  expect(records).toHaveLength(4);
  expect(records.map(row => row.metric)).toEqual(metrics.map(metric => metric.name));
  expect(records[0]).toMatchObject({ ticker: 'DEMO', data_mode: 'example', dollar_change_usd: '20', percentage_change_percent: '20', latest_period_end: '2025-12-31', prior_period_end: '2024-12-31' });
  expect(records[1]).toMatchObject({ dollar_change_usd: '30', percentage_change_percent: '', percentage_change_availability: 'unavailable' });
  expect(records[2]).toMatchObject({ comparison_kind: 'dated_balance', dollar_change_usd: '-20', latest_period_start: '' });
  expect(records[3]).toMatchObject({ dollar_change_usd: '', dollar_change_availability: 'unavailable' });
  expect(records[3].dollar_change_issue).toContain('windows do not qualify');
  expect(Number.isFinite(Date.parse(records[0].exported_at))).toBe(true);
  expect(exportRequests).toEqual([]);
  await expect(income).toBeVisible();
  await expect(page.locator('.metric-card').filter({ hasText: 'Net income' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => { URL.createObjectURL = original; throw new Error('Download unavailable in this check'); };
  });
  await page.getByRole('button', { name: 'Download annual changes CSV', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('annual changes CSV could not be prepared');
  const retry = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download annual changes CSV', exact: true }).click();
  await retry;
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('.metric-card').filter({ hasText: 'Cash and equivalents' }).click();
  const cash = page.getByRole('region', { name: 'Cash and equivalents year-over-year comparison' });
  await expect(cash.getByTestId('metric-dollar-change')).toHaveText('-$20.00');
  await expect(cash).toContainText('Balance dates: 2024-12-31 → 2025-12-31');
  await expect(cash).toContainText('not cash generated');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.metric-card').filter({ hasText: 'Capital expenditure' }).click();
  const capex = page.getByRole('region', { name: 'Capital expenditure year-over-year comparison' });
  await expect(capex).toContainText('These windows do not qualify');
  await expect(capex.getByTestId('metric-dollar-change')).toHaveCount(0);
});


test('annual changes CSV preserves evidence, signed numbers, zeros and formula-safe labels', () => {
  const revenue = { ...metric(100, 100), name: 'Revenue' };
  revenue.annualValues[0] = { ...revenue.annualValues[0], filed: '2026-02-01', accession: '0000000001-26-000001', tag: 'RevenueTag', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/' };
  const report: FinancialReport = {
    company: { ticker: 'AAPL', name: '=Unsafe, "label"\nsecond line', sector: 'Technology' }, cik: '0000000001',
    dataMode: 'sec', source: 'SEC EDGAR companyfacts', retrievedAt: '2026-10-18T01:00:00Z', servedAt: '2026-10-19T01:00:00Z', notes: [],
    metrics: [revenue, metric(-10, 20), metric(20, 0), { name: '+Unsupported', unit: 'EUR', annualValues: [] }, { name: 'Operating cash flow', unit: 'USD', annualValues: [] }, metric(Infinity, 20)]
  };
  const serializedBefore = JSON.stringify(report);
  const rows = readCsv(metricChangeCsv(report, '2026-10-20T00:00:00Z'));
  expect(rows).toHaveLength(6);
  expect(rows[0]).toMatchObject({ schema_version: 'reported-metric-changes-v1', ticker: 'AAPL', company_name: '\'=Unsafe, "label"\nsecond line', sector: 'Technology', data_mode: 'sec', retrieved_at: report.retrievedAt!, served_at: report.servedAt, exported_at: '2026-10-20T00:00:00Z', dollar_change_usd: '0', percentage_change_percent: '0', dollar_change_availability: 'available', percentage_change_availability: 'available', latest_reported_value: '100', latest_filed: '2026-02-01', latest_accession: '0000000001-26-000001', latest_tag: 'RevenueTag', latest_source_url: revenue.annualValues[0].sourceUrl!, prior_reported_value: '100', prior_period_start: '2024-01-01' });
  expect(rows[1]).toMatchObject({ dollar_change_usd: '-30', percentage_change_percent: '-150' });
  expect(rows[2]).toMatchObject({ dollar_change_usd: '20', percentage_change_percent: '', percentage_change_availability: 'unavailable' });
  expect(rows[2].percentage_change_issue).toContain('positive prior value');
  expect(rows[3]).toMatchObject({ metric: "'+Unsupported", reported_unit: 'EUR', dollar_change_usd: '' });
  expect(rows[3].dollar_change_issue).toContain('USD');
  expect(rows[4].dollar_change_issue).toContain('No reported');
  expect(rows[5]).toMatchObject({ latest_reported_value: '', dollar_change_usd: '', dollar_change_availability: 'unavailable' });
  expect(rows[5].dollar_change_issue).toContain('numeric range');
  expect(rows[0].scope).toContain('one latest-year comparison');
  expect(JSON.stringify(report)).toBe(serializedBefore);
  expect(readCsv(metricChangeCsv({ ...report, metrics: [] }, '2026-10-20T00:00:00Z'))).toEqual([]);
});
