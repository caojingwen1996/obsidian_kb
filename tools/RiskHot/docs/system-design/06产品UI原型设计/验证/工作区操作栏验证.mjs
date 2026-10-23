import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.RISK_HOT_TEST_BROWSER) throw new Error('RISK_HOT_TEST_BROWSER must name an isolated Chrome for Testing or Chromium executable.');
const directory = dirname(fileURLToPath(import.meta.url));
const captures = join(directory, '工作区操作栏截图');
await mkdir(captures, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'riskhot-workspace-actions-'));
const results = [], errors = [], requests = [];
let context;
async function check(name, fn) { await fn(); results.push(name); }
const urls = {
  M2: new URL('../06-3-M2风险源管理中心UI设计/M2风险源管理中心交互原型.html', import.meta.url).href,
  M3: new URL('../06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html', import.meta.url).href,
};
try {
  context = await chromium.launchPersistentContext(profile, { executablePath: process.env.RISK_HOT_TEST_BROWSER, headless: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  async function fit(name) {
    await check(name, async () => {
      await expect(page.locator('.r-top button, .r-top select, .top button, .top .page-tools')).toHaveCount(0);
      const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        tools: [...document.querySelectorAll('.workspace-toolbar button:not([hidden]), .workspace-toolbar select')].filter(e => e.getClientRects().length).map(e => { const r=e.getBoundingClientRect(); return { left:r.left, right:r.right, height:r.height }; }) }));
      if (box.scroll>box.width) console.log(name,await page.locator('.workspace-toolbar, .workspace-toolbar *').evaluateAll(nodes=>nodes.filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))));
      expect(box.scroll).toBeLessThanOrEqual(box.width);
      for (const r of box.tools) { expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(box.width); if (box.width<=650) expect(r.height).toBeGreaterThanOrEqual(44); }
    });
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(urls.M2);
    await fit(`M2/${width}/风险源目录`);
    await expect(page.locator('.workspace-toolbar [data-action=new]')).toBeVisible();
    await expect(page.locator('.workspace-toolbar [data-action=edit]')).toBeVisible();
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    if ([1440,390].includes(width)) await page.screenshot({path:join(captures,`M2-${width}.png`)});
    await page.locator('[data-action=new]').click();
    await check(`M2/${width}/新增表单操作留在弹窗`, async () => {
      await expect(page.locator('dialog[open]')).toBeVisible();
      await expect(page.locator('dialog[open] .r-dialog-header button[type=submit]')).toHaveCount(2);
      expect(await page.locator('dialog[open] button[type=submit]').evaluateAll(buttons=>buttons.every(b=>b.form?.id==='rh-edit'))).toBe(true);
    });
    await page.keyboard.press('Escape');
    await check(`M2/${width}/关闭新增恢复焦点`,async()=>{await expect(page.locator('[data-action=new]')).toBeFocused();});
    await page.locator('[data-view=variables]').click();
    await fit(`M2/${width}/全局变量`);
    await page.locator('[data-detail-tab=observations]').click();
    await fit(`M2/${width}/观测指标`);
    await expect(page.locator('.workspace-toolbar [data-action=link-indicator]')).toBeVisible();
    await page.locator('[data-action=revisions]').click();
    await fit(`M2/${width}/修订审核`);
    await page.locator('.workspace-toolbar [data-action=back]').click();
    await expect(page.locator('#rh-search')).toBeVisible();

    await page.goto(urls.M3);
    await fit(`M3/${width}/策略目录`);
    await expect(page.locator('.workspace-toolbar [data-action=new]')).toBeVisible();
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    if ([1440,390].includes(width)) await page.screenshot({path:join(captures,`M3目录-${width}.png`)});
    await page.locator('[data-action=open][data-id=STR-L2-01]').click();
    await fit(`M3/${width}/策略详情`);
    await expect(page.locator('.workspace-toolbar #top-back')).toBeVisible();
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    if ([1440,390].includes(width)) await page.screenshot({path:join(captures,`M3详情-${width}.png`)});
    await page.locator('#version').selectOption('V1.2');
    await check(`M3/${width}/版本切换更新操作`,async()=>{
      await expect(page.locator('.workspace-toolbar [data-action=revision]')).toBeVisible();
      await expect(page.locator('[data-action=save]')).toHaveCount(0);
    });
    await page.locator('[data-detail=history]').click();
    await fit(`M3/${width}/版本治理`);
    await expect(page.locator('.workspace-toolbar [data-action=disable]')).toBeVisible();
    await expect(page.locator('[data-action=validate]')).toHaveCount(0);
    await page.locator('#top-back').click();
    await expect(page.locator('#search')).toBeVisible();
    await page.locator('[data-view=ai]').click();
    await fit(`M3/${width}/AI任务`);
    await expect(page.locator('.workspace-toolbar [data-action=edit-task]')).toBeVisible();
    await page.locator('[data-view=evaluation]').click();
    await fit(`M3/${width}/策略评估`);
    await page.locator('[data-view=panorama]').click();
    await check(`M3/${width}/全景无空操作栏`,async()=>{await expect(page.locator('.workspace-toolbar')).toBeHidden();});
    await fit(`M3/${width}/流水线全景`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(urls.M3);
  await page.locator('[data-action=new]').click();
  await check('M3/新建弹窗提交按钮保留表单',async()=>{
    await expect(page.locator('dialog[open] button[form=new-form][type=submit]')).toBeVisible();
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action=new]')).toBeFocused();
  await page.locator('#role').selectOption('授权阅读者');
  await check('M3/阅读者禁止新增',async()=>{await expect(page.locator('[data-action=new]')).toBeDisabled();});
  await page.locator('[data-action=open][data-id=STR-L2-01]').click();
  await check('M3/阅读者禁止保存和添加节点',async()=>{
    await expect(page.locator('[data-action=save]')).toBeDisabled();
    await expect(page.locator('[data-action=add-node]')).toBeDisabled();
  });
  await check('无页面异常和外网请求',async()=>{expect(errors).toEqual([]);expect(requests).toEqual([]);});
  await writeFile(join(directory,'工作区操作栏验证结果.json'),JSON.stringify({date:'2026-10-22',checks:results.length,results,errors,requests},null,2)+'\n','utf8');
  console.log(`${results.length} workspace browser checks passed`);
} finally { await context?.close(); await rm(profile,{recursive:true,force:true}); }
