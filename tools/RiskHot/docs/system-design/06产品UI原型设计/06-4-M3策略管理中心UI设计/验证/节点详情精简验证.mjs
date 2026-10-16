import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url)), base = path.dirname(dir);
const shots = path.join(dir, '节点详情精简截图');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const checks = [], errors = [], network = [], captures = [], protection = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : (network.push(r.request().url()), r.abort()));
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const load = () => page.goto(pathToFileURL(path.join(base, 'M3策略管理中心交互原型.html')).href);
const open = () => page.locator('[data-action=open][data-id="STR-L2-01"]').click();
async function capture(type) {
  await page.locator('.node-detail').evaluate(el => el.scrollIntoView({ block: 'start' }));
  const name = `${type}-${page.viewportSize().width}.png`;
  await page.locator('.node-detail').screenshot({ path: path.join(shots, name), animations: 'disabled' });
  captures.push(name);
}
try {
  await mkdir(shots, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await load(); await open();
    const before = await page.evaluate(() => JSON.stringify({ strategies, tasks, flows: DOMAIN_FLOWS }));
    for (const [type, id] of [['PROGRAM', 'P1'], ['CONDITION', 'C'], ['START', 'S'], ['END', 'H']]) {
      await page.locator(`[data-node=${id}]`).click();
      const data = await page.evaluate(() => {
        const n = flowRecord().flow.find(n => n.id === state.node);
        return { name: n.name, input: n.input, output: n.output, edges: n.next.map(e => e.label), pending: n.pending };
      });
      check(`${type}/${width} 单标题且无重复职责和阶段小字`, await page.locator('.node-detail h2').innerText() === data.name && await page.locator('.node-detail .executor-fact, .node-detail .step-kicker').count() === 0);
      check(`${type}/${width} 保留所有分支`, await page.locator('.route-row > span:first-child').allTextContents().then(labels => JSON.stringify(labels) === JSON.stringify(data.edges)));
      check(`${type}/${width} 保留输入输出配置`, await page.locator('#node-form [name=input]').inputValue() === data.input && await page.locator('#node-form [name=output]').inputValue() === data.output);
      check(`${type}/${width} 文档按需展开`, await page.locator('.node-source').getAttribute('open') === null && await page.locator('.node-source a').count() === 1);
      check(`${type}/${width} 无横向溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture(type);
    }
    check(`${width} 浏览不改共享数据`, before === await page.evaluate(() => JSON.stringify({ strategies, tasks, flows: DOMAIN_FLOWS })));
    await page.locator('[data-node=C]').click();
    await page.locator('[data-select-node=H]').click();
    check(`${width} 后继仍可定位`, await page.locator('[data-node=H]').getAttribute('aria-pressed') === 'true');
    await page.locator('.node-config summary').click();
    await page.locator('#node-form [name=name]').fill('边界配置验证');
    await page.locator('#node-form button[type=submit]').click();
    check(`${width} 草稿配置可应用`, await page.locator('.node-detail h2').innerText() === '边界配置验证');
    await page.locator('#role').selectOption('授权阅读者');
    check(`${width} 阅读者配置只读`, await page.locator('#node-form [name=name]').isDisabled());
    await load(); await open();
    await page.locator('[data-action=add-node]').click();
    await page.locator('#node-add-form [name=type]').selectOption('HUMAN');
    await page.locator('#node-add-form [name=name]').fill('人工复核');
    await page.locator('button[form=node-add-form][type=submit]').click();
    check(`${width} 人工处理人及三个出口保留`, (await page.locator('.node-actor').innerText()).includes('系统管理员') && await page.locator('.route-row > span:first-child').allTextContents().then(labels => labels.join('|') === '批准|退回|暂缓'));
    await capture('HUMAN');
    await load(); await page.locator('[data-action=panorama]').click();
    await page.locator('[data-node=G-M2]').click();
    check(`${width} 模块详情保留输入输出与流向`, await page.locator('.node-detail.MODULE .node-facts section').count() === 2 && await page.locator('.route-row').count() === 3);
    await capture('MODULE');
    await page.locator('[data-flow-module=F04]>summary').click();
    await page.locator('[data-node=RISK-ADMIT]').click();
    check(`${width} 折叠文档后待确认事项仍可见`, await page.locator('.source-section .callout').isVisible() && (await page.locator('.source-section .callout').innerText()).includes('待确认'));
    await page.locator('.node-source summary').click();
    check(`${width} 可展开来源章节`, await page.locator('.node-source a').isVisible());
  }
  if (process.argv[2]) {
    const baseline = process.argv[2], hash = value => createHash('sha256').update(value).digest('hex');
    for (const name of ['M3策略管理中心交互原型.html', '原型资源/flow-data.js']) {
      const before = hash(await readFile(path.join(baseline, name))), after = hash(await readFile(path.join(base, name)));
      check(name + ' 字节不变', before === after); protection.push({ name, before, after });
    }
    const old = await readFile(path.join(baseline, '原型资源/app.js'), 'utf8'), current = await readFile(path.join(base, '原型资源/app.js'), 'utf8');
    const submit = s => s.slice(s.indexOf("document.addEventListener('submit'"));
    check('全部表单写入与权限处理不变', hash(submit(old)) === hash(submit(current)));
  }
  check('无 JS 错误或外网请求', errors.length === 0 && network.length === 0);
  const result = { date: '2026-10-16', passed: checks.length, checks, errors, network, captures, protection };
  await writeFile(path.join(dir, '节点详情精简验证结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ passed: checks.length, captures: captures.length, errors, network }));
} finally { await browser.close(); }
