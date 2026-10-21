import { expect, test, type Page } from '@playwright/test';
import catalog from './catalog';

async function setup(page: Page, firstIssue = '') {
  let ledgerIssue = firstIssue, marksIssue = '';
  let releaseLedger: (() => void) | null = null;
  let delayed = false;
  const portfolios = [
    { id: 'first', name: 'My fictional practice', mode: 'example', initialCash: 1000, createdAt: '2026-10-21T01:00:00Z' },
    { id: 'second', name: 'My catalog practice', mode: 'market', initialCash: 2000, createdAt: '2026-10-21T01:00:00Z' }
  ];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/portfolios') return route.fulfill({ json: portfolios });
    const ledger = portfolios.find(item => path === `/api/portfolios/${item.id}`);
    if (ledger) {
      if (delayed && ledger.id === 'second') await new Promise<void>(resolve => { releaseLedger = resolve; });
      return route.fulfill({ json: { portfolio: { ...ledger, id: ledgerIssue === 'id' ? 'unrelated' : ledger.id, mode: ledgerIssue === 'mode' ? 'wrong-mode' : ledger.mode }, cash: ledger.initialCash, realizedPnl: 0, dividendIncome: 0, positions: [], trades: [], events: [] } });
    }
    const marked = portfolios.find(item => path === `/api/portfolios/${item.id}/valuation`);
    if (marked) return route.fulfill({ json: { portfolioId: marksIssue === 'id' ? 'unrelated' : marked.id, dataMode: marksIssue === 'mode' ? 'wrong-mode' : marked.mode, evaluatedAt: '2026-10-21T01:00:00Z', cash: marked.initialCash, pricedPositions: 0, totalPositions: 0, complete: true, pricedHoldingsValue: 0, totalValue: marked.initialCash, unrealizedPnl: 0, holdings: [], allocation: { available: true, unavailableReason: null, cashWeight: 1, largestHolding: null, largestSector: null, topThreeHoldingsWeight: 0, companies: [], sectors: [] } } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/#research?company=DEMO&view=portfolios');
  await expect(page.getByRole('heading', { name: 'Simulated portfolios' })).toBeVisible();
  await page.locator('.company-browser > summary').press('Escape');
  return { ledgerIssue: (issue: string) => { ledgerIssue = issue; }, marksIssue: (issue: string) => { marksIssue = issue; }, delaySecond: () => { delayed = true; }, release: () => { releaseLedger?.(); }, waiting: () => releaseLedger !== null };
}

test('portfolio ledgers with another identity or instrument mode stay hidden and reload can recover', async ({ page }) => {
  const control = await setup(page, 'id');
  for (const issue of ['id', 'mode']) {
    control.ledgerIssue(issue);
    if (issue === 'mode') await page.getByRole('button', { name: 'Reload portfolios' }).click();
    await expect(page.getByRole('alert')).toContainText('ledger does not match');
    await expect(page.getByTestId('portfolio-cash')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Record simulated fill', exact: true })).toHaveCount(0);
  }
  control.ledgerIssue('');
  await page.getByRole('button', { name: 'Reload portfolios' }).click();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$1,000.00');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('portfolio price evidence requires the current portfolio and mode while the ledger stays usable', async ({ page }) => {
  const control = await setup(page);
  const marks = page.getByRole('region', { name: 'Holdings valuation', exact: true });
  await expect(marks.getByTestId('portfolio-total-value')).toHaveText('$1,000.00');
  for (const issue of ['id', 'mode']) {
    control.marksIssue(issue);
    await marks.getByRole('button', { name: 'Recheck stored prices' }).click();
    await expect(marks.getByRole('alert')).toContainText('price evidence does not match');
    await expect(marks.getByTestId('portfolio-total-value')).toHaveCount(0);
    await expect(marks.getByRole('table')).toHaveCount(0);
    await expect(page.getByTestId('portfolio-cash')).toHaveText('$1,000.00');
  }
  control.marksIssue('');
  await marks.getByRole('button', { name: 'Recheck stored prices' }).click();
  await expect(marks.getByTestId('portfolio-total-value')).toHaveText('$1,000.00');
  await expect(marks.getByRole('alert')).toHaveCount(0);
});

test('switching portfolios hides the previous ledger and price evidence before the next read completes', async ({ page }) => {
  const control = await setup(page);
  await expect(page.getByTestId('portfolio-total-value')).toHaveText('$1,000.00');
  control.delaySecond();
  await page.getByRole('combobox', { name: /Open portfolio/ }).selectOption('second');
  await expect.poll(control.waiting).toBe(true);
  await expect(page.getByTestId('portfolio-cash')).toHaveCount(0);
  await expect(page.getByTestId('portfolio-total-value')).toHaveCount(0);
  control.release();
  await expect(page.getByTestId('portfolio-cash')).toHaveText('$2,000.00');
  await expect(page.getByTestId('portfolio-total-value')).toHaveText('$2,000.00');
});
