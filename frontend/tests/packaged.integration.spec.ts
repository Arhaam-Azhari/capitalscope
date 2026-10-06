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
  await expect(page.locator('.valuation-result tbody tr')).toHaveCount(5);
});

test('unconfigured live SEC access reports a failure rather than serving example data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Apple/ }).click();
  await expect(page.getByRole('heading', { name: 'Apple', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Live SEC access has not been configured');
  await expect(page.locator('.metric-card')).toHaveCount(0);
});
