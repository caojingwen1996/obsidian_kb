import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const executablePath = process.env.RISK_HOT_TEST_BROWSER;
if (!executablePath) throw new Error('Set RISK_HOT_TEST_BROWSER to isolated Chrome for Testing or Chromium.');
const directory = dirname(fileURLToPath(import.meta.url));
const captures = join(directory, '流水线同级导航截图');
await mkdir(captures, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'riskhot-peer-navigation-'));
const results = [], errors = [], external = [];
let context;
const urls = {
  panorama: new URL('../流水线全景交互原型.html', import.meta.url).href,
  M1: new URL('../../06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html', import.meta.url).href,
  M2: new URL('../../06-3-M2风险源管理中心UI设计/M2风险源管理中心交互原型.html', import.meta.url).href,
  M3: new URL('../../06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html', import.meta.url).href,
};
async function check(name, fn) { await fn(); results.push(name); }
try {
  context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  await check('standalone entry opens panorama without a hash and survives reload', async () => {
    await page.goto(urls.panorama);
    await expect(page).toHaveURL(/#panorama$/);
    await expect(page.locator('#module-title')).toHaveText('流水线全景');
    await expect(page.locator('.system-panorama')).toBeVisible();
    await expect(page.locator('[data-flow-module]')).toHaveCount(8);
    await expect(page.locator('[data-flow-module][open]')).toHaveCount(0);
    await expect(page.locator('.module-card-description')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.system-panorama')).toBeVisible();
  });
  await check('legacy M3 panorama deep link remains readable', async () => {
    await page.goto(urls.M3 + '#panorama');
    await expect(page.locator('.system-panorama')).toBeVisible();
    await expect(page.locator('#module-title')).toHaveText('流水线全景');
  });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(urls.M3);
    await check(`${width}: peer destinations and three strategy children`, async () => {
      await expect(page.locator('.support-nav > [data-primary-nav]')).toHaveCount(2);
      await expect(page.locator('.workspace-nav [data-view]')).toHaveCount(3);
      await expect(page.locator('.workspace-nav [data-view=panorama]')).toHaveCount(0);
      await expect(page.locator('[data-primary-nav=strategy]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.workspace-nav')).toBeVisible();
    });
    await page.locator('[data-view=panorama]').click();
    await check(`${width}: panorama owns heading, URL and selected menu`, async () => {
      await expect(page.locator('#module-title')).toHaveText('流水线全景');
      await expect(page).toHaveURL(/#panorama$/);
      await expect(page.locator('[data-primary-nav=panorama]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-primary-nav].active')).toHaveCount(1);
      await expect(page.locator('[data-primary-nav=strategy]')).not.toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.workspace-nav')).toBeHidden();
      await expect(page.locator('.workspace-toolbar')).toBeHidden();
      await expect(page.locator('.system-panorama')).toBeVisible();
    });
    await check(`${width}: navigation fits and has usable touch targets`, async () => {
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        items: [...document.querySelectorAll('[data-primary-nav]')].map(item => { const r = item.getBoundingClientRect(); return { left:r.left, right:r.right, height:r.height }; }) }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
      for (const r of dimensions.items) { expect(r.height).toBeGreaterThanOrEqual(44); expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(width); }
    });
    await page.mouse.move(width - 8, 100);
    if ([1440, 390].includes(width)) await page.screenshot({ path:join(captures, `全景-${width}.png`) });
    await check(`${width}: reload retains independent panorama route`, async () => {
      await page.reload();
      await expect(page.locator('#module-title')).toHaveText('流水线全景');
      await expect(page.locator('.system-panorama')).toBeVisible();
    });
    await page.locator('[data-primary-nav=strategy]').click();
    await check(`${width}: strategy menu restores catalog and children`, async () => {
      await expect(page.locator('#module-title')).toHaveText('策略管理中心');
      await expect(page.locator('.workspace-nav')).toBeVisible();
      await expect(page.locator('#search')).toBeVisible();
      await expect(page.locator('[data-view=catalog]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-view=panorama]')).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
    await page.mouse.move(width - 8, 100);
    if ([1440, 390].includes(width)) await page.screenshot({ path:join(captures, `策略-${width}.png`) });
    for (const view of ['ai', 'evaluation', 'catalog']) {
      await page.locator(`[data-view=${view}]`).click();
      await check(`${width}: ${view} remains under strategy`, async () => {
        await expect(page.locator('[data-primary-nav=strategy]')).toHaveAttribute('aria-current', 'page');
        await expect(page.locator(`[data-view=${view}]`)).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#module-title')).toHaveText('策略管理中心');
      });
    }
    await page.locator('[data-action=open][data-id=STR-L2-01]').click();
    await expect(page.locator('#top-back')).toBeVisible();
    await page.locator('#top-back').click();
    await expect(page.locator('#search')).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const center of ['M1', 'M2']) {
    await check(`${center}: peer link opens panorama directly`, async () => {
      await page.goto(urls[center]);
      const link = page.locator('a[href$="#panorama"]');
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText('流水线全景');
      await link.click();
      await expect(page.locator('#module-title')).toHaveText('流水线全景');
      await expect(page.locator('.workspace-nav')).toBeHidden();
    });
  }
  await check('panorama module expands and node details stay read-only', async () => {
    await page.locator('details[data-flow-module]').first().locator('summary').click();
    await page.locator('[data-node]').first().click();
    await expect(page.locator('.node-detail')).toBeVisible();
    await expect(page.locator('[data-action=save], [data-action=add-node]')).toHaveCount(0);
    await page.locator('#role').selectOption('授权阅读者');
    await expect(page.locator('.system-panorama')).toBeVisible();
    await expect(page.locator('[data-action=save], [data-action=add-node]')).toHaveCount(0);
  });
  await check('no script errors or external requests', async () => { expect(errors).toEqual([]); expect(external).toEqual([]); });
  await writeFile(join(directory, '流水线同级导航验证结果.json'), JSON.stringify({ date:'2026-10-22', checks:results.length, results, errors, external }, null, 2) + '\n', 'utf8');
  console.log(`${results.length} browser checks passed`);
} finally {
  await context?.close();
  await rm(profile, { recursive:true, force:true });
}
