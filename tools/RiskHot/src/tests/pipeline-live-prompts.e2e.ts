import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registerWeb } from '../runtime/web.js';
import { promptDirectory } from '../platform/pipeline-prompt.js';

const executable = process.env.SOURCE_BROWSER_EXECUTABLE ?? '';
if (!/Chrome for Testing|Chromium/.test(executable) || /\/Google Chrome\.app\//.test(executable)) throw new Error('Independent testing browser required');
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const root = await mkdtemp(join(tmpdir(), 'riskhot-live-prompt-browser-'));
const app = Fastify(); registerWeb(app, { pipelineRoot: root });
let browser: any;
try {
  await mkdir(join(root, promptDirectory), { recursive: true });
  await mkdir(join(root, 'src/web'), { recursive: true });
  const generated = await readFile('src/web/pipeline-tasks.js', 'utf8');
  const data = JSON.parse(generated.slice(generated.indexOf('export default ') + 15).replace(/;\s*$/, ''));
  await writeFile(join(root, 'src/web/pipeline-tasks.js'), generated);
  for (const ref of Object.values(data.prompts) as { sourcePath: string }[]) {
    await writeFile(join(root, ref.sourcePath), await readFile(ref.sourcePath, 'utf8'));
  }
  await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launchPersistentContext(join(root, 'profile'), { executablePath: executable, headless: true, viewport: { width: 1440, height: 1000 } });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/*', (route: any) => {
    const request = route.request();
    if (!request.url().startsWith(app.listeningOrigin + '/') || !['GET', 'HEAD'].includes(request.method())) throw new Error('Unexpected browser request');
    return route.continue();
  });
  const visit = async () => {
    await page.goto(app.listeningOrigin + '/pipeline');
    await page.locator('[data-flow-module="F02"] > summary').click();
    await page.locator('[data-node="EV-A1"]').click();
    await page.locator('.task-prompt-disclosure > summary').click();
  };
  await visit();
  assert.match(await page.locator('.task-prompt-reference .pre').textContent(), /第四层：输出契约/);
  const path = join(root, data.prompts['AI-01'].sourcePath);
  const prompt = '浏览器自动读取验证\n## 第一层\n<script>window.promptInjected = true</script>\n```json\n{"new":true}\n```\n## 第四层\n最新正文结束';
  const updated = `---\ntask_id: AI-01\ntitle: 自动读取测试\nversion: V0.9-test\nstatus: 测试草案\n---\n## 3. 提示词正文\n\`\`\`\`markdown\n${prompt}\n\`\`\`\`\n`;
  await writeFile(path, updated);
  await visit();
  assert.equal(await page.locator('.task-prompt-reference .pre').textContent(), prompt);
  assert.match(await page.locator('.task-prompt-reference h3').textContent(), /V0.9-test/);
  assert.match(await page.locator('.task-prompt-reference .meta').textContent(), /测试草案/);
  assert.equal(await page.evaluate(() => (window as any).promptInjected), undefined);
  assert.equal(await page.locator('[data-node]').count(), 115);
  await page.locator('.task-catalog-link').click();
  await page.locator('[data-task-tab="prompt"]').click();
  assert.equal(await page.locator('.task-prompt-reference .pre').textContent(), prompt);
  await writeFile(path, '损坏文档');
  await visit();
  assert.match(await page.locator('.task-prompt-reference .pre').textContent(), /无法读取/);
  assert.doesNotMatch(await page.locator('.task-prompt-reference .pre').textContent(), /最新正文结束/);
  await writeFile(path, updated); await visit();
  assert.equal(await page.locator('.task-prompt-reference .pre').textContent(), prompt);
  assert.equal(await readFile(join(root, 'src/web/pipeline-tasks.js'), 'utf8'), generated);
  assert.deepEqual(errors, []);
  const output = resolve('docs/verification/pipeline-live-prompts');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, 'latest-prompt.png') });
  await writeFile(join(output, 'results.json'), JSON.stringify({ status: 'passed', checks: ['当前文档展示', '修改后刷新自动读取正文及元数据', '文本安全转义', '115节点保留', 'AI任务提示词标签读取相同正文', '损坏文档不回退旧正文', '修复后恢复', '未改生成文件或任务定义'], errors, isolatedFixture: true }, null, 2) + '\n');
  console.log('PASS: 8 browser checks, no page errors, isolated document fixture.');
} finally {
  await browser?.close(); await app.close(); await rm(root, { recursive: true, force: true });
}
