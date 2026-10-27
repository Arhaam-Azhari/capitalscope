import { chromium, request, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const jar = resolve(root, 'backend/target/capitalscope-0.1.0.jar');
await access(jar);
const probe = createServer();
await new Promise((done, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', done); });
const port = probe.address().port;
await new Promise(done => probe.close(done));
const baseURL = `http://127.0.0.1:${port}`;
// I capture an isolated fictional workspace, without touching a saved local database or live providers.
const server = spawn('java', ['-jar', jar], { cwd: root, env: { ...process.env, PORT: String(port),
  DATABASE_URL: 'jdbc:h2:mem:demo_capture', DATABASE_USER: 'sa', DATABASE_PASSWORD: '', SEC_USER_AGENT: '', ALPHA_VANTAGE_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser, api;
server.stdout.on('data', data => { log = (log + data).slice(-16000); });
server.stderr.on('data', data => { log = (log + data).slice(-16000); });
let launchError;
server.on('error', error => { launchError = error; });
try {
  api = await request.newContext({ baseURL });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(`My demo server exited before startup.\n${log}`);
    try { if ((await api.get('/api/universe', { timeout: 1000 })).ok()) { ready = true; break; } } catch { /* I wait for the jar to finish starting. */ }
    await new Promise(done => setTimeout(done, 500));
  }
  assert(ready, `My demo server did not become ready.\n${log}`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseURL);
  await expect(page.locator('.data-banner')).toContainText('invented figures');
  await expect(page.locator('.metric-card').first()).toContainText('$1.28B');
  await page.locator('.company-browser > summary').press('Escape');
  await page.getByRole('heading', { name: 'Example Manufacturing', exact: true }).click();
  await page.screenshot({ path: resolve(root, 'docs/research-dashboard.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(root, 'docs/research-dashboard-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Valuation', exact: true }).click();
  for (const [name, value] of [['Starting unlevered cash flow', '100'], ['Annual growth', '0'], ['Discount rate / WACC', '10'], ['Terminal growth', '0'], ['Net debt', '100'], ['Shares outstanding', '10']])
    await page.getByRole('spinbutton', { name, exact: false }).fill(value);
  await page.getByRole('button', { name: 'Calculate valuation', exact: false }).click();
  await expect(page.locator('.result-heading')).toContainText('$90.00');
  await expect(page.locator('.sensitivity-table .base-case')).toContainText('$90.00');
  await page.locator('#valuation-heading').click();
  await page.locator('.valuation-panel').screenshot({ path: resolve(root, 'docs/valuation-review.png') });
  async function post(path, data) { const response = await api.post(path, { data }); assert(response.ok(), `My demo setup failed: ${path}`); return response.json(); }
  const created = await post('/api/portfolios', { name: 'My demo practice portfolio', mode: 'example', initialCash: '1000' });
  const id = created.portfolio.id, path = `/api/portfolios/${id}`;
  await post(`${path}/trades`, { requestId: crypto.randomUUID(), ticker: 'DEMO', side: 'BUY', quantity: '10', price: '20', fee: '0' });
  for (const [name, defaultShock] of [['My downside', '-0.2'], ['My upside', '0.2']])
    await post(`${path}/stress-scenarios`, { name, assumptions: { defaultShock, sectorShocks: {} } });
  await page.getByRole('button', { name: 'Portfolios', exact: true }).click();
  await page.getByRole('combobox', { name: /^Open portfolio/ }).selectOption(id);
  for (const name of ['My downside', 'My upside']) await page.getByRole('checkbox', { name: `Compare ${name}`, exact: true }).check();
  const comparison = page.getByRole('region', { name: 'Saved stress scenario comparison', exact: true });
  await expect(comparison.getByRole('row', { name: /^Stressed value difference vs reference/ }).getByRole('cell').nth(1)).toHaveText('$86.40');
  const pending = page.waitForEvent('download');
  await comparison.getByRole('button', { name: 'Download stress comparison CSV', exact: true }).click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), 'saved-stress-comparison.csv');
  assert.equal(await download.failure(), null);
  await comparison.screenshot({ path: resolve(root, 'docs/stress-comparison.png') });
  console.log('I captured the financial workspace, mobile view, $90 valuation, and saved stress comparison from the packaged app. I checked the $86.40 case difference and comparison download.');
} finally {
  await Promise.allSettled([browser?.close(), api?.dispose()]);
  server.kill('SIGTERM');
  await Promise.race([new Promise(done => server.once('exit', done)), new Promise(done => setTimeout(done, 5000))]);
  if (server.exitCode === null) server.kill('SIGKILL');
}
