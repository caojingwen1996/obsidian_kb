import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const output = process.env.RISKHOT_TEST_OUTPUT || path.join(dir, 'AI01提示词截图');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const checks = [], errors = [], network = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  if (route.request().url().startsWith('file:')) return route.continue();
  network.push(route.request().url()); return route.abort();
});
const load = () => page.goto(pathToFileURL(path.join(dir, '../M3策略管理中心交互原型.html')).href);
const openTask = async id => {
  await page.locator('[data-view=ai]').click();
  await page.locator(`[data-task="${id}"]`).click();
  await page.locator('[data-task-tab=prompt]').click();
};
const openNode = async () => {
  await page.locator('[data-view=panorama]').click();
  for(const header of await page.locator('.module-card:not([open])>summary').all())await header.click();
  await page.locator('[data-node=EV-A1]').click();
  await page.locator('[data-node-task-tab=prompt]').click();
};
try {
  await mkdir(output, { recursive: true });
  await load(); await openTask('AI-01');
  check('任务目录保留原五标签', (await page.locator('[data-task-tab]').allTextContents()).join('|') === '任务定义|Prompt / Skill|输入输出|工具与约束|引用与版本');
  check('AI-01 展示用途与文档依据', (await page.locator('#content').innerText()).includes('Prompt 用途') && (await page.locator('#content').innerText()).includes('§6.1.1'));
  const prompt = await page.locator('pre.pre').innerText();
  check('输入包含资料身份、时间、定位及事件类型字典', ['information_id', 'source_id', 'title', 'content', 'published_at', 'collected_at', 'canonical_url', 'raw_metadata', '事件类型字典'].every(value => prompt.includes(value)));
  check('指令明确多事件、重复段落与无事件', ['多个独立事件', '重复段落只形成一个候选', '返回空候选集合'].every(value => prompt.includes(value)));
  check('时间语义与未知时间约束完整', ['宣布、预计发生、实施和实际发生', '未知日期不得用采集时间替代', '精度不足时可空并说明'].every(value => prompt.includes(value)));
  check('观测主体不越界创建身份', ['区分行为主体与观测主体', '供 AI-03 复核', '不创建 Target 或变量正式身份'].every(value => prompt.includes(value)));
  check('证据定位和交付边界完整', ['information_id 必须透传', '原文段落、页码或数据区块', '0..N', '交 AI-02', 'event_id、first_seen_at、updated_at', '待详细设计'].every(value => prompt.includes(value)));
  check('明确保留 Schema 待定限制', (await page.locator('.callout').allTextContents()).some(text => text.includes('未确定的字段、枚举和包装')));
  check('其余任务均有独立用途和专属Prompt', await page.evaluate(() => tasks.filter(t => t.id !== 'AI-01').every(t => t.promptPurpose && t.prompt.startsWith('任务：' + t.id + ' ')) && new Set(tasks.map(t => t.prompt)).size === 16));
  if (process.env.RISKHOT_BASELINE) {
    const before = await browser.newPage();
    await before.goto(pathToFileURL(path.join(process.env.RISKHOT_BASELINE, 'M3策略管理中心交互原型.html')).href);
    const snapshot = target => target.evaluate(() => JSON.stringify({ task: (({schema,contract,prompt,...task}) => task)(tasks.find(t => t.id === 'AI-01')), strategies, flows: DOMAIN_FLOWS }));
    check('AI-01任务身份与用途、策略及流水线和修改前完全一致', await snapshot(before) === await snapshot(page));
    await before.close();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await openTask('AI-01');
    check(`${width} 任务目录无横向溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `AI01任务-${width}.png`), fullPage: true });
    await openNode();
    check(`${width} 内嵌保留五标签和相同Prompt`, await page.locator('[data-node-task-tab]').count() === 5 && await page.locator('#node-task-content pre').innerText() === prompt);
    check(`${width} 内嵌显示用途并保持只读`, (await page.locator('#node-task-content').innerText()).includes('Prompt 用途') && await page.locator('.embedded-task input, .embedded-task textarea, .embedded-task [data-action]').count() === 0);
    check(`${width} 内嵌无横向溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.node-detail').scrollWidth <= document.querySelector('.node-detail').clientWidth));
    await page.locator('.node-detail').evaluate(el => { el.scrollTop = 0; el.scrollIntoView({ block: 'start' }); });
    await page.screenshot({ path: path.join(output, `AI01内嵌-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openTask('AI-01');
  await page.locator('[data-action=edit-task]').click();
  check('修订表单带入事件抽取专属Prompt', await page.locator('[name=prompt]').inputValue() === prompt);
  await page.locator('[name=prompt]').fill('AI-01 新草稿验证');
  await page.locator('[name=reason]').fill('验证草稿隔离');
  await page.locator('button[form=task-form][type=submit]').click();
  await openNode();
  check('保存草稿后固定版本内容和用途不变', await page.locator('#node-task-content pre').innerText() === prompt && (await page.locator('#node-task-content').innerText()).includes('Prompt 用途'));
  await openTask('AI-01'); await page.locator('[data-action=edit-task]').click();
  check('再次编辑能取回草稿', await page.locator('[name=prompt]').inputValue() === 'AI-01 新草稿验证');
  await page.keyboard.press('Escape'); await load();
  await page.locator('#role').selectOption('授权阅读者'); await openTask('AI-01');
  check('阅读者可浏览用途且不能修订', await page.locator('[data-action=edit-task]').isDisabled() && (await page.locator('#content').innerText()).includes('Prompt 用途'));
  await openTask('AI-02');
  check('切换任务显示AI-02用途和指令', (await page.locator('#content').innerText()).includes('Prompt 用途') && (await page.locator('pre.pre').innerText()).startsWith('任务：AI-02 事件匹配与归组') && (await page.locator('#content').innerText()).includes('§6.1.2'));
  check('无脚本错误及外网请求', errors.length === 0 && network.length === 0);
  const result = { date: '2026-10-16', passed: checks.length, checks, errors, network };
  await writeFile(path.join(output, '验证结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
