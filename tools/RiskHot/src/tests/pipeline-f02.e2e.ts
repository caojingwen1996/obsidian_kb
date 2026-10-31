import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registerWeb } from '../runtime/web.js';
import { pipelineGraph as graph } from './pipeline-fixture.js';

const executable = process.env.SOURCE_BROWSER_EXECUTABLE ?? '';
if (!/Chrome for Testing|Chromium/.test(executable) || /\/Google Chrome\.app\//.test(executable)) throw new Error('Independent testing browser required');
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const app = Fastify(); registerWeb(app);
const profile = await mkdtemp(join(tmpdir(), 'riskhot-f02-reviewed-'));
const output = resolve('docs/verification/pipeline-f02-20261031'); await mkdir(output, { recursive: true });
let browser: any;
const errors: string[] = [], unexpected: string[] = [], checks: string[] = [];
try {
  await app.listen({ host: '127.0.0.1', port: 0 });
  const origin = process.env.PIPELINE_VERIFY_ORIGIN ?? app.listeningOrigin;
  if (!['127.0.0.1','localhost'].includes(new URL(origin).hostname)) throw new Error('Local verification only');
  browser = await chromium.launchPersistentContext(profile, { executablePath: executable, headless: true, reducedMotion: 'reduce' });
  const page = await browser.newPage();
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/*', (route: any) => {
    const request = route.request();
    if (!request.url().startsWith(origin + '/') || !['GET','HEAD'].includes(request.method())) {
      unexpected.push(request.method() + ' ' + request.url()); return route.abort();
    }
    return route.continue();
  });
  const nodes = graph.system.nodes.filter(n => n.module === 'F02');
  for (const width of [1440,390,320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/pipeline');
    await page.locator('.system-panorama').waitFor();
    await page.locator('[data-flow-module="F02"] > summary').click();
    assert.equal(await page.locator('[data-node]').count(), graph.system.nodes.length);
    assert.match(await page.locator('[data-flow-module="F02"] .module-step-range').innerText(), /Step 1～8/);
    for (const n of nodes) {
      await page.locator(`[data-node="${n.id}"]`).click();
      assert.ok((await page.locator('.node-detail h2').innerText()).includes(n.name), n.id);
      assert.ok(!/引用版本不可用|未配置 · 将阻止审核/.test(await page.locator('.node-detail').innerText()),n.id);
      if (n.type === 'AI' && n.task) {
        for (const tab of ['definition','schema','constraints','usage']) {
          await page.locator(`[data-node-task-tab="${tab}"]`).click();
          assert.ok((await page.locator('#node-task-content').innerText()).trim());
        }
        if (await page.locator('.task-prompt-disclosure').count()) {
          await page.locator('.task-prompt-disclosure > summary').click();
          assert.notEqual(await page.locator('.task-prompt-reference .meta dd').first().innerText(), '读取失败', n.id);
          assert.ok((await page.locator('.task-prompt-reference .pre').innerText()).length > 100,n.id);
        }
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${n.id}页面溢出`);
    }
    checks.push(`${width}px：${nodes.length}个F02节点、AI四标签、已登记实时提示词及无页面横向溢出`);
    await page.locator('[data-node="EV-P2"]').click();
    await page.locator('.node-detail [data-select-node="EV-ASSOC-PREP"]').click();
    assert.match(await page.locator('.node-detail h2').innerText(), /Step 8/);
    await page.locator('[data-node="EV-VARIABLE"]').click();
    await page.locator('[data-node-task-tab="schema"]').click();
    if (!process.env.PIPELINE_VERIFY_ORIGIN) await page.screenshot({ path: join(output, `f02-${width}.png`) });
    await page.locator('.task-catalog-link').click(); await page.locator('.task-page').waitFor();
    assert.match(await page.locator('.task-page h2').innerText(), /风险变量/);
    await page.getByRole('link', { name:'← 返回流水线全景', exact:true }).click();
    await page.locator('.system-panorama').waitFor();
    checks.push(`${width}px：保存后独立进入Step 8、已审核任务详情及返回`);
  }
  const source = graph.sources.FINANCIAL; assert.ok(source);
  const response = await page.request.get(origin + source.path);
  assert.equal(response.status(),200); assert.match(await response.text(), /金融意义/);
  checks.push('独立金融意义文档可读');
  assert.deepEqual(errors,[]); assert.deepEqual(unexpected,[]);
  const result={ status:'passed', origin, nodes:nodes.length, checks, errors, unexpectedRequests:unexpected };
  await writeFile(join(output,process.env.PIPELINE_VERIFY_ORIGIN?'live-results.json':'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} catch (error) { console.error(JSON.stringify({errors,unexpectedRequests:unexpected})); throw error; } finally { await browser?.close(); await app.close(); await rm(profile,{recursive:true,force:true}); }
