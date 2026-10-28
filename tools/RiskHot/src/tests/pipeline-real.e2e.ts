import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const executable = process.env.SOURCE_BROWSER_EXECUTABLE ?? '';
if (!/Chrome for Testing|Chromium/.test(executable) || /\/Google Chrome\.app\//.test(executable)) throw new Error('Independent testing browser required');
if (!process.env.PLAYWRIGHT_MODULE || !process.env.API_ORIGIN) throw new Error('Set PLAYWRIGHT_MODULE and API_ORIGIN');
const origin = new URL(process.env.API_ORIGIN).origin;
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local verification only');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const profile = await mkdtemp(join(tmpdir(), 'riskhot-pipeline-real-'));
let browser: any;
const errors: string[] = [], checks: string[] = [], unexpected: string[] = [];
try {
  browser = await chromium.launchPersistentContext(profile, { executablePath: executable, headless: true, reducedMotion: 'reduce' });
  await browser.route('**/*', (route: any) => {
    const request = route.request();
    if (!request.url().startsWith(origin + '/') || !['GET', 'HEAD'].includes(request.method())) {
      unexpected.push(request.method() + ' ' + request.url()); return route.abort();
    }
    return route.continue();
  });
  const page = await browser.newPage();
  page.on('pageerror', (error: Error) => errors.push(error.message));
  const output = resolve('docs/verification/pipeline-panorama');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/pipeline'); await page.locator('.system-panorama').waitFor();
    assert.equal(await page.locator('[data-node]').count(), 115);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: join(output, `real-${width}.png`) });
    await page.locator('[data-flow-module="F02"] > summary').click();
    await page.locator('[data-node="EV-A1"]').click();
    await page.locator('.task-catalog-link').click(); await page.locator('.task-page').waitFor();
    await page.getByRole('link', { name: '← 返回流水线全景', exact: true }).click();
    await page.locator('.node-detail h2').waitFor();
    assert.equal(await page.locator('[data-flow-module="F02"][open]').count(), 1);
    checks.push(`${width}px真实全景、节点、AI任务及返回`);
    for (const route of ['/m1', '/events']) {
      await page.goto(origin + route);
      await page.locator('[aria-labelledby="nav-config"] a[href="/pipeline"]').click();
      await page.locator('.system-panorama').waitFor();
      checks.push(`${width}px${route}配置入口`);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  await writeFile(join(output, 'real-results.json'), JSON.stringify({ status: 'passed', origin, checks, errors, unexpectedRequests: unexpected, readOnly: true }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, errors: errors.length, readOnly: true }));
} finally { await browser?.close(); await rm(profile, { recursive: true, force: true }); }
