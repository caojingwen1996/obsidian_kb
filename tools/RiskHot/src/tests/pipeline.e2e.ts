import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { openFixture } from './fixture.js';
import { buildServer } from '../runtime/server.js';

const executable = process.env.SOURCE_BROWSER_EXECUTABLE ?? '';
if (!/Chrome for Testing|Chromium/.test(executable) || /\/Google Chrome\.app\//.test(executable)) throw new Error('Independent testing browser required');
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright entry');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const output = resolve('docs/verification/pipeline-panorama'); await mkdir(output, { recursive: true });
const fixture = await openFixture(), profile = await mkdtemp(join(tmpdir(), 'riskhot-pipeline-'));
let browser: any, app: any;
const checks: string[] = [], errors: string[] = [], unexpected: string[] = [], measurements: unknown[] = [];
const check = (name: string) => checks.push(name);
try {
  await fixture.db.query("INSERT INTO platform.actors SELECT 'riskhot-local-operator',permissions,source_keys FROM platform.actors WHERE subject='review-operator'");
  app = await buildServer(fixture.repo, { mode: 'local', origin: 'http://127.0.0.1:18249' });
  const root = resolve('.');
  app.get('/prototype/*', async (request: any, reply: any) => {
    const path = resolve(root, request.params['*']);
    if (!path.startsWith(root + sep + 'docs/system-design/')) return reply.code(404).send();
    try {
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      return reply.type((types[extname(path)] ?? 'text/plain') + '; charset=utf-8').send(await readFile(path));
    } catch { return reply.code(404).send(); }
  });
  await app.listen({ host: '127.0.0.1', port: 18249 });
  const origin = app.listeningOrigin;
  browser = await chromium.launchPersistentContext(profile, { executablePath: executable, headless: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await browser.newPage();
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', (route: any) => {
    const request = route.request();
    if (!request.url().startsWith(origin + '/') || !['GET', 'HEAD'].includes(request.method())) {
      unexpected.push(request.method() + ' ' + request.url()); return route.abort();
    }
    return route.continue();
  });
  const visit = async () => { await page.goto(origin + '/pipeline'); await page.locator('.system-panorama').waitFor(); };
  await visit();
  assert.equal(await page.locator('[aria-labelledby="nav-config"] a[aria-current="page"]').innerText(), '流水线全景');
  assert.equal(await page.locator('[data-flow-layer][open]').count(), 4);
  assert.equal(await page.locator('[data-flow-module][open]').count(), 0);
  assert.equal(await page.locator('[data-node]').count(), 115); check('初始四层展开、八模块收起、115节点及配置分组');
  await page.locator('[data-flow-module="F01"] > summary').click();
  await page.locator('[data-node="IN-CHECK"]').click();
  await page.getByRole('heading', { name: /L0 \/ F01 \/ Step 1/ }).waitFor();
  assert.equal(await page.locator('.node-detail form').count(), 0);
  await page.locator('.node-detail [data-select-node="IN-HOLD"]').click();
  assert.match(await page.locator('.node-detail h2').innerText(), /阻断或待处理/);
  check('F01判断详情与共享待处理定位');
  await page.locator('[data-node="IN-SEND-WAIT"]').click();
  await page.locator('.node-detail [data-select-node="IN-DELIVER"]').click();
  assert.match(await page.locator('.node-detail h2').innerText(), /Step 6/); check('F01恢复出口定位交付步骤');
  await page.locator('[data-node="IN-DONE"]').click();
  await page.locator('.node-detail [data-select-node="EV-S"]').click();
  assert.equal(await page.locator('[data-flow-module="F02"]').getAttribute('open'), ''); check('跨模块自动展开F02');

  const ids = await page.locator('[data-node]').evaluateAll((nodes: HTMLElement[]) => nodes.map(node => node.dataset.node));
  for (const id of ids) {
    // Choose through the real node button after revealing its module; scroll is
    // exercised separately to avoid 115 animations obscuring a functional check.
    await page.evaluate((id: string) => {
      const target = document.querySelector(`[data-node="${id}"]`) as HTMLElement;
      target.closest('details[data-flow-layer]')?.setAttribute('open', '');
      target.closest('details[data-flow-module]')?.setAttribute('open', '');
      target.click();
    }, id);
    assert.ok((await page.locator('.node-detail h2').innerText()).trim(), id);
  }
  check('115个节点逐一实际打开详情');
  const ai01 = 'EV-A1';
  assert.ok(ids.includes(ai01));
  await page.locator(`[data-node="${ai01}"]`).click();
  assert.equal(await page.locator('[data-node-task-tab]').count(), 4);
  await page.locator('.task-prompt-disclosure > summary').click();
  assert.equal(await page.locator('.task-prompt-disclosure[open]').count(), 1);
  await page.locator('[data-node-task-tab="schema"]').click();
  assert.equal(await page.locator('.task-prompt-disclosure[open]').count(), 1);
  await page.locator('[data-node-task-tab="schema"]').press('End');
  assert.equal(await page.locator('[data-node-task-tab="usage"]').getAttribute('aria-selected'), 'true'); check('AI四标签、键盘导航及提示词开合保留');
  const previous = await page.locator('[data-flow-module][open]').count();
  await page.locator('.task-catalog-link').click();
  await page.locator('.task-page').waitFor();
  assert.match(page.url(), /#ai\/AI-01\/1.0$/);
  await page.getByRole('link', { name: '← 返回流水线全景', exact: true }).click();
  await page.locator('.system-panorama').waitFor();
  assert.equal(await page.locator('[data-flow-module][open]').count(), previous);
  assert.equal(await page.locator('.task-prompt-disclosure[open]').count(), 1); check('固定任务阅读及返回保留全景状态');
  await page.goto(origin + '/pipeline#ai/AI-01/99.0');
  await page.getByRole('heading', { name: 'AI 任务版本不可用' }).waitFor();
  await page.reload(); await page.getByRole('heading', { name: 'AI 任务版本不可用' }).waitFor(); check('无效任务版本与刷新不回退');
  await page.goto(origin + '/pipeline#ai/AI-01/1.0');
  await page.locator('.task-page').waitFor(); await page.reload(); await page.locator('.task-page').waitFor(); check('有效固定版本直达及刷新');

  const prototypePath = '/prototype/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/流水线全景交互原型.html';
  const reference = await browser.newPage();
  reference.on('pageerror', (error: Error) => errors.push('prototype: ' + error.message));
  for (const width of [1440, 1024, 901, 900, 768, 761, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await visit();
    await reference.setViewportSize({ width, height: 1000 }); await reference.goto(origin + prototypePath);
    await reference.locator('.system-panorama').waitFor();
    const boxes = await page.locator('.flow-layout').boundingBox(), original = await reference.locator('.flow-layout').boundingBox();
    measurements.push({ width, product: boxes, prototype: original });
    assert.ok(boxes && original);
    assert.ok(Math.abs(boxes!.width - original!.width) < 2, `画布宽度${width}`);
    assert.ok(Math.abs(boxes!.x - original!.x) < 2 && Math.abs(boxes!.y - original!.y) < 2, `画布位置${width}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `初始溢出${width}`);
    const config = page.locator('[aria-labelledby="nav-config"] a[href="/pipeline"]'); assert.ok(await config.isVisible());
    if ([1440, 390, 320].includes(width)) {
      await page.screenshot({ path: join(output, `product-${width}.png`), fullPage: true });
      await reference.screenshot({ path: join(output, `prototype-${width}.png`), fullPage: true });
    }
    await page.locator('[data-flow-module="F01"] > summary').click();
    await page.locator('[data-node="IN-CHECK"]').click();
    await reference.locator('[data-flow-module="F01"] > summary').click();
    await reference.locator('[data-node="IN-CHECK"]').click();
    await page.waitForTimeout(100);
    await page.locator('.f01-wires [data-f01-line]').first().waitFor({ state: 'attached' });
    const columns = await page.evaluate(() => {
      const main = document.querySelector('[data-node="IN-CHECK"]')!.getBoundingClientRect();
      const hold = document.querySelector('[data-node="IN-HOLD"]')!.getBoundingClientRect();
      return hold.left > main.left + main.width;
    });
    assert.ok(columns, `F01两列${width}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `F01溢出${width}`);
    const nodeStyle = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return { font: style.fontSize, color: style.color, background: style.backgroundColor, padding: style.padding, radius: style.borderRadius };
    };
    assert.deepEqual(await page.locator('[data-node="IN-CHECK"]').evaluate(nodeStyle), await reference.locator('[data-node="IN-CHECK"]').evaluate(nodeStyle), `节点视觉${width}`);
    if ([1440, 390, 320].includes(width)) {
      await page.screenshot({ path: join(output, `f01-${width}.png`), fullPage: true });
      await reference.screenshot({ path: join(output, `prototype-f01-${width}.png`), fullPage: true });
    }
    if (width <= 760) {
      await page.locator('.panorama-return-step').click();
      assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.node), 'IN-CHECK');
    }
    await page.locator('[data-flow-module="F02"] > summary').click();
    await page.locator(`[data-node="${ai01}"]`).click();
    await page.locator('.task-prompt-disclosure > summary').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `F02溢出${width}`);
    if ([1440, 390, 320].includes(width)) {
      await page.screenshot({ path: join(output, `f02-ai-${width}.png`), fullPage: true });
      await page.locator('.node-detail').evaluate((element: HTMLElement) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 20));
      await page.screenshot({ path: join(output, `detail-${width}.png`) });
    }
    await page.evaluate(() => { document.querySelectorAll('[data-flow-module]').forEach(element => element.setAttribute('open', '')); });
    await page.waitForTimeout(80);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `全模块溢出${width}`);
    check(`${width}px初始对照、全模块布局、F01两列连线和手机往返`);
  }
  await reference.close();
  await page.setViewportSize({ width: 1440, height: 1000 }); await visit();
  await page.locator('[data-flow-module="F01"] > summary').focus();
  await page.keyboard.press('Enter'); assert.equal(await page.locator('[data-flow-module="F01"][open]').count(), 1);
  await page.keyboard.press('Space'); assert.equal(await page.locator('[data-flow-module="F01"][open]').count(), 0); check('原生模块Enter与Space折叠');
  const references = JSON.parse(await readFile('src/data/pipeline-documents.json', 'utf8'));
  for (const key of Object.keys(references)) assert.equal((await page.request.get(origin + '/pipeline/documents/' + key)).status(), 200);
  check('全部12份来源文档可读取');
  await page.route('**/pipeline/pipeline-data.js', (route: any) => route.abort());
  const consoleBaseline = errors.length;
  await page.reload(); await page.getByRole('heading', { name: '流水线全景加载失败' }).waitFor();
  errors.splice(consoleBaseline); await page.unroute('**/pipeline/pipeline-data.js'); check('资料加载失败有重载入口');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/m1', '/events']) {
      await page.goto(origin + path);
      const entry = page.locator('[aria-labelledby="nav-config"] a[href="/pipeline"]');
      assert.ok(await entry.isVisible()); await entry.click(); await page.locator('.system-panorama').waitFor();
    }
  }
  check('M1及事件页三宽度配置入口实际往返');
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  await writeFile(join(output, 'results.json'), JSON.stringify({ status: 'passed', checks, measurements, pageErrors: errors, unexpectedRequests: unexpected, browser: 'independent Chrome for Testing / Chromium', graphNodes: 115 }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, nodes: 115, pageErrors: errors.length, unexpectedRequests: unexpected.length }));
} finally {
  await browser?.close(); await app?.close(); await fixture.dispose(); await rm(profile, { recursive: true, force: true });
}
