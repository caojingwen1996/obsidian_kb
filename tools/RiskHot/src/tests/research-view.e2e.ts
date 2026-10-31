import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const executable = process.env.SOURCE_BROWSER_EXECUTABLE ?? '';
if (!/Chrome for Testing|Chromium/.test(executable) || /\/Google Chrome\.app\//.test(executable)) throw new Error('独立测试浏览器路径必填');
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('PLAYWRIGHT_MODULE必填');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const origin = process.env.API_ORIGIN;
if (!origin || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('LOCAL_ORIGIN_REQUIRED');
const profile = await mkdtemp(join(tmpdir(), 'riskhot-research-live-'));
const output = resolve(process.env.BROWSER_OUTPUT ?? 'docs/verification/research-view');
await mkdir(output, { recursive: true });
const errors: string[] = [], writes: string[] = [], checks: string[] = [], taskReads: string[] = [];
let browser: any, catalogOnly = true;
try {
  browser = await chromium.launchPersistentContext(profile, { executablePath: executable, headless: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await browser.newPage();
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/*', (route: any) => {
    const request = route.request();
    if (catalogOnly && /\/api\/v1\/l0\/(tasks|schedules)/.test(request.url())) { taskReads.push(request.url()); return route.fulfill({ status: 503, json: { error: { code: 'IO_UNAVAILABLE' } } }); }
    if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.url()); return route.abort(); }
    if (new URL(request.url()).origin !== origin) return route.abort();
    return route.continue();
  });
  const sourceResponse = page.waitForResponse((response: any) => response.url().endsWith('/api/v1/m1/sources'));
  await page.goto(origin + '/m1#sources');
  const sources = (await (await sourceResponse).json()).items as { catalog_key: string; metadata: { dims?: string[] } }[];
  await page.locator('.source-toolbar .view-switch').waitFor();
  const toolbarAligned = async () => page.locator('.source-toolbar').evaluate((toolbar: HTMLElement) => {
    const controls = [...toolbar.querySelectorAll('input, select, button')].map(item => item.getBoundingClientRect());
    return controls.length === 7 && Math.max(...controls.map(rect => rect.bottom)) - Math.min(...controls.map(rect => rect.bottom)) <= 2;
  });
  assert.ok(await toolbarAligned(), '1440桌面搜索、筛选、查询及视图按钮应在同一排');
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.ok(await toolbarAligned(), '1280桌面工具栏应在同一排');
  await page.setViewportSize({ width: 1440, height: 1000 });
  checks.push('1440及1280桌面检索与四个视图按钮合并一排');
  await page.getByRole('button', { name: '专题研究', exact: true }).click();
  const categories = [['钱的数量', 'QUANTITY'], ['钱的价格', 'PRICE'], ['钱的流向', 'FLOW']];
  for (const [name, code] of categories) {
    const group = page.locator(`[data-research-group="${name}"]`);
    await group.waitFor();
    const expected = sources.filter(source => source.metadata.dims?.some(value => value === code || value === name)).length;
    assert.match(await group.locator('summary').first().innerText(), new RegExp(`${expected} 个信源`));
  }
  checks.push('实际页面固定显示钱的数量、钱的价格、钱的流向，计数与真实接口一致');
  const missing = sources.filter(source => !source.metadata.dims?.length).length;
  if (missing) {
    const unclassified = page.locator('[data-research-group="待分类信源"]');
    await unclassified.waitFor();
    assert.equal(await unclassified.locator('[data-source-key]').count(), missing);
    assert.match(await page.locator('.notice').innerText(), new RegExp(`${missing} 个信源尚未维护金融属性`));
    await unclassified.locator('summary').first().click();
  }
  checks.push('实际缺失分类明确进入待分类分组并提供档案维护指引，未伪造已分类结果');
  assert.equal(await page.locator('[data-inline-plan],[data-plan-toggle],[data-source-tasks]').count(), 0);
  assert.doesNotMatch(await page.locator('#content').innerText(), /任务计划|执行周期|任务执行记录/);
  assert.deepEqual(taskReads, []);
  checks.push('实际目录无任务计划、周期与执行记录，且不读取任务和计划接口');
  await page.getByRole('button', { name: '全部', exact: true }).click();
  assert.equal(await page.locator('[data-source-key]').count(), sources.length);
  await page.screenshot({ path: join(output, 'desktop-live.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'mobile-live.png'), fullPage: false });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  checks.push('实际目录1440桌面和390移动布局无横向溢出');
  catalogOnly = false;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: '信息采集任务', exact: true }).click();
  await page.getByRole('heading', { name: '任务执行记录', exact: true }).waitFor();
  assert.equal(await page.locator('.workspaces a').count(), 3);
  assert.deepEqual(await page.locator('.task-subviews a').allTextContents(), ['任务计划设置', '手动发起采集', '任务执行记录']);
  await page.getByRole('link', { name: '任务计划设置', exact: true }).click();
  await page.getByRole('heading', { name: '任务计划设置', exact: true }).waitFor();
  assert.equal(await page.locator('.task-subviews a[aria-current]').innerText(), '任务计划设置');
  await page.screenshot({ path: join(output, 'desktop-task-groups.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'mobile-task-groups.png'), fullPage: false });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole('link', { name: '手动发起采集', exact: true }).click();
  await page.getByRole('heading', { name: '手动发起采集', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '手动发起采集', exact: true }).waitFor();
  assert.equal(await page.locator('.task-subviews a[aria-current]').innerText(), '手动发起采集');
  await page.getByRole('link', { name: '任务执行记录', exact: true }).click();
  await page.getByRole('heading', { name: '任务执行记录', exact: true }).waitFor();
  assert.equal(await page.locator('#intake-workspace-link').getAttribute('aria-current'), 'page');
  checks.push('任务三个分组切换、刷新及移动布局正常，实际服务全程只读');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const blankReads: string[] = [];
  const trackBlank = (request: any) => { if (/\/api\//.test(request.url()) && !request.url().endsWith('/api/v1/session')) blankReads.push(request.url()); };
  page.on('request', trackBlank);
  await page.getByRole('link', { name: '事件处理任务', exact: true }).click();
  await page.locator('#event-workspace-link[aria-current="page"]').waitFor();
  assert.equal(await page.locator('#content').innerHTML(), '');
  assert.equal(await page.locator('.task-subviews').count(), 0);
  assert.deepEqual(await page.locator('.workspaces a').allTextContents(), ['信源目录', '信息采集任务', '事件处理任务']);
  await page.reload();
  await page.locator('#event-workspace-link[aria-current="page"]').waitFor();
  assert.equal(await page.locator('#content').innerHTML(), '');
  assert.deepEqual(blankReads, []);
  await page.screenshot({ path: join(output, 'desktop-event-blank.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'mobile-event-blank.png'), fullPage: false });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  page.off('request', trackBlank);
  await page.getByRole('link', { name: '信息采集任务', exact: true }).click();
  await page.getByRole('heading', { name: '任务执行记录', exact: true }).waitFor();
  checks.push('事件处理任务按顺序显示，空白页切换和刷新正常，不请求业务接口，桌面手机无溢出');
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  checks.push('实际页面无脚本错误；所有写请求被禁止且未发生');
  const result = { checked_at: new Date().toISOString(), origin, source_count: sources.length, unclassified: missing, checks, errors, writes, taskReads, mode: '实际服务只读验证，独立测试浏览器与临时数据目录' };
  await writeFile(join(output, 'live-results.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result));
} finally { await browser?.close(); await rm(profile, { recursive: true, force: true }); }
