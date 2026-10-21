import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { compareResearchRevisions, researchRevisionChangesCsv } from '../src/researchRevisionComparison';
import type { ResearchRevision } from '../src/types';
import catalog from './catalog';
import { readCsv } from './readCsv';

const entry = { ticker: 'DEMO', entryId: 'my-original-entry', version: 3, status: 'watching' as const, thesis: 'My original thesis', risks: '', reviewDate: null, checks: ['filings'], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
const earlier: ResearchRevision = { id: 11, action: 'removed', recordedAt: '2026-10-03T00:00:00Z', entry };
const later: ResearchRevision = { id: 12, action: 'saved', recordedAt: '2026-10-04T00:00:00Z', entry: { ...entry, entryId: 'my-recreated-entry', version: 1, thesis: '=My, "revised" thesis\nwith another line', checks: ['filings', 'risks'], updatedAt: '2026-10-04T00:00:00Z' } };

test('research changes preserve both record sequences, exact fields and safe CSV text', () => {
  const records = [later, earlier];
  const comparison = compareResearchRevisions(records);
  expect(comparison.earlier.id).toBe(11);
  expect(comparison.later.id).toBe(12);
  expect(comparison.changed.map(field => field.label)).toEqual(['Investment thesis', 'I revisited risks to my thesis']);
  expect(records[0].id).toBe(12);
  const rows = readCsv(researchRevisionChangesCsv(records, '2026-10-21T23:00:00Z'));
  expect(rows).toHaveLength(9);
  expect(rows[0]).toMatchObject({ schema_version: 'research-revision-changes-v1', ticker: 'DEMO', earlier_record_id: '11', earlier_action: 'removed', earlier_entry_id: 'my-original-entry', earlier_version: '3', later_record_id: '12', later_action: 'saved', later_entry_id: 'my-recreated-entry', later_version: '1', exported_at: '2026-10-21T23:00:00Z' });
  expect(rows.find(row => row.research_field === 'Investment thesis')).toMatchObject({ earlier_value: 'My original thesis', later_value: '\'=My, "revised" thesis\nwith another line', changed: 'true' });
  expect(rows.find(row => row.research_field === 'Risks and evidence to check')).toMatchObject({ earlier_value: '', later_value: '', changed: 'false' });
  expect(rows.find(row => row.research_field === 'I revisited risks to my thesis')).toMatchObject({ earlier_value: 'Not marked reviewed', later_value: 'Marked reviewed', changed: 'true' });
  const removal = { ...earlier, id: 13, action: 'removed' as const, entry: { ...earlier.entry, version: 4 } };
  expect(compareResearchRevisions([earlier, removal]).changed).toHaveLength(0);
  expect(readCsv(researchRevisionChangesCsv([earlier, removal], 'now')).every(row => row.changed === 'false')).toBe(true);
});

test('revision comparisons reject duplicate records, incomplete pairs and different companies', () => {
  for (const records of [[], [earlier], [earlier, earlier], [earlier, later, earlier], [earlier, { ...later, entry: { ...later.entry, ticker: 'AAPL' } }]])
    expect(() => compareResearchRevisions(records)).toThrow('two different research records for the same company');
});

test('selected-revision download includes hidden unchanged fields and leaves the editor draft intact', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let writes = 0;
  // I use recorded research fixtures and never write a watchlist entry in this review.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 500, json: { error: 'No writes expected' } }); }
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { count: 50, asOf: '2026-10-06', dynamic: false } });
    if (path === '/api/watchlist') return route.fulfill({ json: [] });
    if (path === '/api/watchlist/DEMO/history') return route.fulfill({ json: { items: [later, earlier], nextBefore: null } });
    return route.fulfill({ status: 503, json: { error: 'No financial import in this research-only check' } });
  });
  await page.goto('/#research?company=DEMO&view=watchlist');
  await page.locator('.company-browser > summary').press('Escape');
  await page.getByLabel('My investment thesis', { exact: true }).fill('My unsaved editor thesis');
  await page.getByRole('button', { name: 'Load research history', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Compare record 12 / }).check();
  await page.getByRole('checkbox', { name: /^Compare record 11 / }).check();
  const comparison = page.getByRole('region', { name: 'Changes between saved research records', exact: true });
  await expect(comparison).toContainText('different entry IDs');
  await comparison.getByLabel('Only show changed research fields').check();
  await expect(comparison.getByRole('row', { name: /^Research status/ })).toHaveCount(0);
  await expect(comparison.getByRole('row', { name: /^Investment thesis/ })).toBeVisible();
  const viewport = comparison.getByRole('region', { name: 'Research revision changes', exact: true });
  await expect(viewport).toHaveAttribute('tabindex', '0');
  await comparison.getByRole('button', { name: 'Scroll Research revision changes right', exact: true }).click();
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  const downloadEvent = page.waitForEvent('download');
  await comparison.getByRole('button', { name: 'Download research changes CSV', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('DEMO-research-changes-11-12.csv');
  const rows = readCsv(await readFile((await download.path())!, 'utf8'));
  expect(rows).toHaveLength(9);
  expect(rows.filter(row => row.changed === 'false')).toHaveLength(7);
  await expect(page.getByLabel('My investment thesis', { exact: true })).toHaveValue('My unsaved editor thesis');
  expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
