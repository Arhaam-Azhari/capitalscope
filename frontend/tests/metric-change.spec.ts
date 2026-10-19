import { expect, test } from '@playwright/test';
import { metricChange } from '../src/metricChange';
import type { Metric, Point } from '../src/types';
import catalog from './catalog';

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
