import { chromium, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const executablePath = process.env.RISK_HOT_TEST_BROWSER;
if (!executablePath) throw new Error('Set RISK_HOT_TEST_BROWSER to an isolated Chrome for Testing or Chromium executable.');
const directory = dirname(fileURLToPath(import.meta.url));
const captures = join(directory, '目录操作区截图');
await mkdir(captures, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'riskhot-m1-actions-'));
let context;
const results = [], errors = [], external = [], scripts = [];
async function check(name, fn) { await fn(); results.push(name); }
try {
  context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await page.goto(new URL('../M1信源管理中心交互原型.html', import.meta.url).href);
  await check('source data loads from project src/data without prototype copies', async () => {
    for (const file of ['source-catalog.js', 'source-demo.js']) {
      expect(scripts).toContain(new URL(`../../../../../src/data/${file}`, import.meta.url).href);
      expect(scripts.some(url => url.includes('/原型资源/' + file) || url.includes(encodeURI('/原型资源/' + file)))).toBe(false);
    }
    expect(await page.evaluate(() => window.RISK_HOT_SOURCE_CATALOG.length)).toBe(40);
  });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await check(`${width}: navigation excludes catalog actions`, async () => {
      await expect(page.locator('.topbar #create, .topbar #group-actions')).toHaveCount(0);
      await expect(page.locator('.list-heading #create')).toBeVisible();
      await expect(page.locator('.list-heading #group-actions')).toBeVisible();
    });
    await check(`${width}: controls and document fit viewport`, async () => {
      const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth,
        buttons: [...document.querySelectorAll('.catalog-actions button')].map(button => { const r = button.getBoundingClientRect(); return { left: r.left, right: r.right, height: r.height }; }) }));
      expect(sizes.document).toBeLessThanOrEqual(sizes.width);
      for (const r of sizes.buttons) { expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(sizes.width); expect(r.height).toBeGreaterThanOrEqual(width <= 640 ? 44 : 36); }
    });
    await check(`${width}: create opens dialog and cancel restores focus`, async () => {
      await page.locator('#create').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('#editor')).toBeVisible();
      await expect(page.locator('#editor .dialog-header #save')).toBeVisible();
      await page.locator('#editor [data-action=close-editor]').first().click();
      await expect(page.locator('#editor')).not.toBeVisible();
      await expect(page.locator('#create')).toBeFocused();
    });
    if (width === 1440 || width === 390) await page.screenshot({ path: join(captures, `${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check('collapse and expand change group visibility', async () => {
    await page.locator('[data-action=collapse-all]').click();
    const collapsed = await page.locator('#list .source-row:visible').count();
    await page.locator('[data-action=expand-all]').click();
    expect(await page.locator('#list .source-row:visible').count()).toBeGreaterThan(collapsed);
  });
  await check('flat view hides only grouping controls', async () => {
    await page.locator('[data-view=all]').click(); await expect(page.locator('#group-actions')).toBeHidden();
    await expect(page.locator('#create')).toBeVisible(); await page.locator('[data-view=verify]').click();
    await expect(page.locator('#group-actions')).toBeVisible();
  });
  for (const view of ['all', 'verify', 'monitor', 'research']) {
    await check(`${view}: all 40 sources available without loading more`, async () => {
      await page.locator(`[data-view=${view}]`).click();
      await expect(page.locator('#load-more, [data-action=load-more]')).toHaveCount(0);
      expect(await page.locator('#list .source-row').evaluateAll(rows => new Set(rows.map(row => row.dataset.select)).size)).toBe(40);
      await expect(page.locator('#result-count')).toContainText('40 个');
    });
  }
  await check('search and clear show all matching results immediately', async () => {
    await page.locator('[data-view=all]').click();
    await page.locator('#search').fill('DEMO_SOURCE_04');
    await page.locator('#search-form').evaluate(form => form.requestSubmit());
    await expect(page.locator('#list .source-row')).toHaveCount(1);
    await expect(page.locator('#list')).toContainText('DEMO_SOURCE_040');
    await page.locator('#clear').click();
    await expect(page.locator('#list .source-row')).toHaveCount(40);
  });
  await check('tier filter includes every matching source and restores all', async () => {
    const checkbox = page.locator('[data-filter=tier][value=T1]');
    await checkbox.evaluate(input => input.closest('details').open = true);
    await checkbox.check();
    const expected = Number((await page.locator('#result-count').textContent()).match(/\d+/)[0]);
    expect(expected).toBeGreaterThan(12);
    await expect(page.locator('#list .source-row')).toHaveCount(expected);
    await checkbox.uncheck();
    await expect(page.locator('#list .source-row')).toHaveCount(40);
    await page.locator('[data-view=research]').click();
  });
  await check('read-only role cannot create', async () => {
    await page.locator('#preview-toggle').click(); await page.locator('#role').selectOption('researcher');
    await expect(page.locator('#create')).toBeHidden();
    await page.locator('#role').selectOption('both'); await expect(page.locator('#create')).toBeVisible();
  });
  await check('no script errors or external requests', async () => { expect(errors).toEqual([]); expect(external).toEqual([]); });
  await writeFile(join(directory, '目录操作区验证结果.json'), JSON.stringify({ date: '2026-10-22', checks: results.length, results, errors, external }, null, 2) + '\n', 'utf8');
  console.log(`${results.length} browser checks passed`);
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
