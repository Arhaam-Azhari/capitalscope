import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import catalog from './catalog';

const backup = (text: string, ticker = 'DEMO') => ({ format: 'capitalscope-browser-note-v1', ticker, exportedAt: '2026-10-19T20:00:00Z', state: 'draft', text });
async function openNotes(page: Page) {
  // I keep this transfer check independent of financial providers and shared research.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: catalog });
    if (path === '/api/universe') return route.fulfill({ json: { asOf: '2026-10-06', count: 50, dynamic: false } });
    return route.fulfill({ status: 503, json: { error: 'Not loaded in this note-only check.' } });
  });
  await page.addInitScript(() => localStorage.setItem('capitalscope.note.DEMO', 'My saved original'));
  await page.goto('/#research?company=DEMO&view=notes');
  await expect(page.getByLabel('Your notes for Example Manufacturing')).toHaveValue('My saved original');
  await page.locator('.company-browser > summary').press('Escape');
  await page.getByText('Back up or restore this note', { exact: true }).click();
}
async function choose(page: Page, value: unknown) {
  await page.getByLabel('Choose a note backup for DEMO').setInputFiles({ name: 'note.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
}

test('note backup round trip previews text and restores only an unsaved draft', async ({ page }) => {
  await openNotes(page);
  const note = page.getByLabel('Your notes for Example Manufacturing');
  const text = 'My thesis: cash conversion\n\n<script>literal text</script> — café 📈';
  await note.fill(text);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download note backup', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('DEMO-note-backup.json');
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toMatchObject({ format: 'capitalscope-browser-note-v1', ticker: 'DEMO', state: 'draft', text });
  expect(Number.isFinite(Date.parse(exported.exportedAt))).toBe(true);
  await note.fill('My current draft');
  await choose(page, exported);
  await expect(page.getByLabel('Note backup preview')).toHaveText(text);
  await expect(note).toHaveValue('My current draft');
  expect(await page.evaluate(() => localStorage.getItem('capitalscope.note.DEMO'))).toBe('My saved original');
  await page.getByRole('button', { name: 'Cancel restore' }).click();
  await expect(page.getByLabel('Note backup preview')).toHaveCount(0);
  await choose(page, exported);
  await page.getByRole('button', { name: 'Restore into editor' }).click();
  await expect(note).toHaveValue(text);
  await expect(page.getByRole('status')).toContainText('restored as an unsaved draft');
  expect(await page.evaluate(() => localStorage.getItem('capitalscope.note.DEMO'))).toBe('My saved original');
  await page.getByRole('button', { name: 'Discard note draft' }).click();
  await expect(note).toHaveValue('My saved original');
  await choose(page, exported);
  await page.getByRole('button', { name: 'Restore into editor' }).click();
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('capitalscope.note.DEMO'))).toBe(text);
});

test('note restoration rejects mismatches and invalid files without keeping an old preview', async ({ page }) => {
  await openNotes(page);
  await choose(page, backup('Ready to restore'));
  await expect(page.getByLabel('Note backup preview')).toBeVisible();
  for (const value of [backup('Different company', 'AAPL'), { ...backup('Old format'), format: 'v0' }, { ...backup('Bad date'), exportedAt: 'invalid' }, { ...backup('Unexpected fields'), extra: 'ignored?' }, backup('x'.repeat(100_001)), null]) {
    await choose(page, value);
    await expect(page.getByRole('alert')).toContainText('Invalid files leave your note unchanged');
    await expect(page.getByRole('button', { name: 'Restore into editor' })).toHaveCount(0);
    await expect(page.getByLabel('Your notes for Example Manufacturing')).toHaveValue('My saved original');
  }
  await page.getByLabel('Choose a note backup for DEMO').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(1_000_001, ' ') });
  await expect(page.getByRole('alert')).toContainText('up to 1 MB');
  await page.getByLabel('Choose a note backup for DEMO').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('capitalscope.note.DEMO'))).toBe('My saved original');
});

test('empty note restoration is explicit and the preview fits a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openNotes(page);
  await choose(page, backup('word'.repeat(200)));
  await expect(page.getByLabel('Note backup preview')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await choose(page, backup(''));
  await expect(page.getByLabel('Note backup preview')).toHaveText('(Empty note)');
  await page.getByRole('button', { name: 'Restore into editor' }).click();
  await expect(page.getByLabel('Your notes for Example Manufacturing')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('capitalscope.note.DEMO'))).toBe('My saved original');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('capitalscope.note.DEMO'))).toBe('');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.note-transfer')).toBeHidden();
});
