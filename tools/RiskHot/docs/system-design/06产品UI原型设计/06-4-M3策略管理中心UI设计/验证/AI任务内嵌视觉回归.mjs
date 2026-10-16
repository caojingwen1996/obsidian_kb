import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url)), base = path.dirname(dir);
const baseline = process.argv[2];
assert.ok(baseline, '请传入修改前原型目录，包含 HTML 及原型资源');
const shots = path.join(dir, 'AI任务内嵌截图', '非AI回归');
await mkdir(shots, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const protection = [];
for (const name of ['M3策略管理中心交互原型.html', '原型资源/flow-data.js']) {
  const before = hash(await readFile(path.join(baseline, name))), after = hash(await readFile(path.join(base, name)));
  assert.equal(after, before, name + ' 不应改变'); protection.push({ name, before, after });
}
const oldScript = await readFile(path.join(baseline, '原型资源/app.js'), 'utf8');
const newScript = await readFile(path.join(base, '原型资源/app.js'), 'utf8');
for (const [name, extract] of [
  ['全部写入处理与权限检查', source => source.slice(source.indexOf("document.addEventListener('submit'"))],
  ['完整性校验', source => source.slice(source.indexOf('function validate()'), source.indexOf('function validationView()'))],
  ['角色与草稿编辑条件', source => source.split('\n').filter(line => /^const (isAdmin|editable)=/.test(line)).join('\n')],
  ['AI 任务定义及策略数据', source => source.slice(source.indexOf('const taskNames'), source.indexOf('let state='))],
]) {
  const before = hash(extract(oldScript)), after = hash(extract(newScript));
  assert.equal(after, before, name); protection.push({ name, before, after });
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const pages = await Promise.all([baseline, base].map(async root => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
  await page.goto(pathToFileURL(path.join(root, 'M3策略管理中心交互原型.html')).href); return page;
}));
const checks = [];
async function compare(name, act) {
  const images = [];
  for (const [i, page] of pages.entries()) {
    if (act) await act(page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    images.push(await page.screenshot({ path: path.join(shots, `${name}-${i ? 'after' : 'before'}.png`), animations: 'disabled' }));
  }
  checks.push({ name, identical: images[0].equals(images[1]), before: hash(images[0]), after: hash(images[1]) });
}
try {
  await compare('策略目录');
  await compare('系统全景', page => page.locator('[data-action=panorama]').click());
  await compare('条件节点', async page => { await page.locator('[data-view=catalog]').click(); await page.locator('[data-action=open][data-id="STR-L2-01"]').click(); });
  await compare('程序节点', page => page.locator('[data-node=P1]').click());
  await compare('边界节点', page => page.locator('[data-node=H]').click());
  for (const key of ['basic', 'dependencies', 'history']) await compare('策略-' + key, page => page.locator(`[data-detail=${key}]`).click());
  await compare('人工节点', async page => {
    await page.locator('[data-detail=flow]').click();
    await page.locator('[data-action=add-node]').click();
    await page.locator('#node-add-form [name=type]').selectOption('HUMAN');
    await page.locator('#node-add-form [name=name]').fill('人工复核回归样例');
    await page.locator('button[form=node-add-form][type=submit]').click();
    await page.locator('#toast').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.node-detail.HUMAN').count(), 1);
    assert.equal(await page.locator('.node-detail .route-row').count(), 3);
  });
  await compare('C02-Prompt', async page => { await page.locator('[data-view=ai]').click(); await page.locator('[data-task-tab=prompt]').click(); });
  await compare('评估', page => page.locator('[data-view=evaluation]').click());
  const result = { date: '2026-10-16', protection, checks, passed: checks.filter(x => x.identical).length, total: checks.length };
  await writeFile(path.join(dir, 'AI任务内嵌视觉回归结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result));
  assert.ok(checks.every(x => x.identical), '非 AI 页面截图有变化，请检查 before/after');
} finally { await browser.close(); }
