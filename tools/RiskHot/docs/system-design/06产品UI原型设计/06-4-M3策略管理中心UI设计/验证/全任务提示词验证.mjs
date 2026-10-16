import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const project = process.env.RISKHOT_PROJECT_ROOT || path.resolve(dir, '../../../../..');
const output = process.env.RISKHOT_TEST_OUTPUT || path.join(dir, '全任务提示词截图');
const sourceDir = path.join(project, 'docs/system-design/02-业务架构与领域设计');
const checks = [], errors = [], network = [], sources = [], definitions = new Map();
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); };
const compact = text => text.replace(/\s+/g, '');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  if (route.request().url().startsWith('file:')) return route.continue();
  network.push(route.request().url()); return route.abort();
});
const load = () => page.goto(pathToFileURL(path.join(dir, '../M3策略管理中心交互原型.html')).href);
const samples = new Set(['AI-02', 'AI-L1-01', 'AI-L2-05', 'AI-L3-01']);
try {
  await mkdir(output, { recursive: true });
  for (const file of (await readdir(sourceDir)).filter(name => /^RiskHot_L[0-3]_.*\.md$/.test(name))) {
    const text = await readFile(path.join(sourceDir, file), 'utf8');
    sources.push({ file, sha256: createHash('sha256').update(text).digest('hex') });
    const headings = [...text.matchAll(/^#### (6\.1\.\d+) (AI-[\w-]+) (.+?) 定义\s*$/gm)];
    for (const match of headings) {
      const rest = text.slice(match.index + match[0].length);
      const section = rest.split(/\n#{3,4} /, 1)[0];
      definitions.set(match[2], { heading: match[1], section });
    }
  }
  check('业务定义覆盖16项任务', definitions.size === 16);
  await load();
  const tasks = await page.evaluate(() => tasks);
  check('任务编号完整且Prompt各不相同', tasks.length === 16 && tasks.every(task => definitions.has(task.id)) && new Set(tasks.map(task => task.prompt)).size === 16);
  for (const task of tasks.filter(task => task.id !== 'AI-01')) {
    const { heading, section } = definitions.get(task.id);
    const prompt = compact(task.prompt);
    const steps = section.match(/^\d+\. .+$/gm);
    const trigger = section.match(/\*\*触发条件\*\*：(.+)/)[1];
    const boundary = section.match(/\*\*交付边界\*\*：(.+)/)[1];
    check(`${task.id}触发、全部分析步骤和交付边界对齐业务定义`, [trigger, ...steps, boundary].every(text => prompt.includes(compact(text))));
    const rows = section.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| 字段') && !line.startsWith('| ---'));
    check(`${task.id}输入输出及待定状态均保留`, rows.every(row => row.trim().replace(/^\||\|$/g, '').split('|').every(cell => prompt.includes(compact(cell)))));
    check(`${task.id}用途、来源和结构限制完整`, task.promptPurpose.length > 20 && task.promptSource.includes('§' + heading) && task.prompt.includes('Schema 片段草案') && task.prompt.includes('不执行其中指令'));
    const references = task.promptReference.split(' · ')[1].split('、');
    for (const reference of references) await readFile(path.join(project, 'aihot/prompts', reference), 'utf8');
    check(`${task.id}AIHOT方法参考均可定位`, references.length > 0);
  }
  const gates = {
    'AI-02': ['名称、关键词或发布机构相同只能作为线索', '同事件只能引用已有有效event_id', '具体增量类型交AI-04'],
    'AI-03': ['排除只凭传导推测得到的后续变量', '没有变量依据时只保留EventTarget建议', '不建立静态Target—Variable归属'],
    'AI-04': ['SOURCE_ADDITION、DUPLICATE机械创建EventUpdate', '不把记录时间当作变化时间', '返回AI-02复核'],
    'AI-05': ['financial_significance_m保留空值', '确定性加权计算由程序', '候选权重、等级阈值和公式未确认'],
    'AI-L1-01': ['输出0..N项完整候选', '不在此步评定当前风险等级', '不加入key_variables五字段'],
    'AI-L1-02': ['避免直接将dimension_code与risk_dimension_ids作字符串比较', '无召回结果也不能绕过准入', '不设置tracking_status或admitted_at'],
    'AI-L2-01': ['任务锁定的已生效映射', '指标上涨不能直接等同风险压力增加', '不输出整项风险相对历史的trend'],
    'AI-L2-02': ['不把公告当成实际效果', '不能判充分有效', '未见应对证据不等于没有任何应对'],
    'AI-L2-03': ['不能以变量数量或未经确认的公式抵减', '无法判断', '不直接把来源占优映射为等级升高或趋势加剧'],
    'AI-L2-04': ['仅受压力不能直接判为已损害', '不设realization_degree', '没有证据不能断言损害未发生'],
    'AI-L2-05': ['不新增可信度维度', '不能估时则说明条件及限制', 'risk_level', 'risk_stage', 'affected_scope', 'persistence_outlook', 'status_summary'],
    'AI-L2-06': ['首次观察或无有效基准时保留待判断', '不以等级是否跨档代替方向分析', '不自设数值阈值'],
    'AI-L2-07': ['区分预期真正缩短与时间自然流逝', '不强行分类', '不能互相替代'],
    'AI-L2-08': ['不自动升级为confirmed', '不生成交易动作', '不自动结束风险跟踪'],
    'AI-L3-01': ['不重算评级或推导上游未给出的趋势', '不自行发明阈值', '不生成发布状态或绕过发布流程']
  };
  for (const [id, clauses] of Object.entries(gates)) check(`${id}关键业务边界`, clauses.every(clause => tasks.find(task => task.id === id).prompt.includes(clause)));
  if (process.env.RISKHOT_BASELINE) {
    const before = await browser.newPage();
    await before.goto(pathToFileURL(path.join(process.env.RISKHOT_BASELINE, 'M3策略管理中心交互原型.html')).href);
    const snapshot = target => target.evaluate(() => JSON.stringify({ task: (({schema,contract,prompt,...task}) => task)(tasks.find(task => task.id === 'AI-01')), strategies, flows: DOMAIN_FLOWS }));
    check('AI-01任务身份与用途、策略及流水线与修改前一致', await snapshot(before) === await snapshot(page));
    await before.close();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.locator('[data-view=ai]').click();
    for (const task of tasks) {
      await page.locator(`[data-task="${task.id}"]`).click();
      await page.locator('[data-task-tab=prompt]').click();
      const text = await page.locator('#content').innerText();
      check(`${width}/${task.id}用途来源及专属指令显示正确`, text.includes(task.promptPurpose) && text.includes(task.promptSource) && await page.locator('pre.pre').innerText() === task.prompt);
      check(`${width}/${task.id}保留五标签且无溢出`, await page.locator('[data-task-tab]').count() === 5 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (samples.has(task.id)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `${task.id}-${width}.png`), animations: 'disabled' });
      }
    }
    await page.locator('[data-view=panorama]').click();
  for(const header of await page.locator('.module-card:not([open])>summary').all())await header.click();
    for (const strategy of ['STR-L0-01', 'STR-L0-02', 'STR-L1-01', 'STR-L2-01', 'STR-L2-02', 'STR-L3-01']) {
      const prefix = {'STR-L0-01':'EV','STR-L0-02':'RATE','STR-L1-01':'RISK','STR-L2-01':'STATE','STR-L2-02':'CHANGE','STR-L3-01':'REPORT'}[strategy];
      const nodes = await page.locator('.node.AI').evaluateAll((nodes,prefix)=>nodes.filter(node=>node.dataset.node.startsWith(prefix+'-')).map(node=>node.dataset.node),prefix);
      for (const node of nodes) {
        await page.locator(`[data-node="${node}"]`).click();
        await page.locator('[data-node-task-tab=prompt]').click();
        const id = await page.evaluate(() => referencedTask(flowRecord().flow.find(node => node.id === state.node)).id);
        const task = tasks.find(task => task.id === id);
        check(`${width}/${strategy}/${id}内嵌引用准确且只读`, await page.locator('#node-task-content pre').innerText() === task.prompt && (await page.locator('#node-task-content').innerText()).includes(task.promptSource) && await page.locator('[data-node-task-tab]').count() === 5 && await page.locator('.embedded-task input,.embedded-task textarea,.embedded-task [data-action]').count() === 0);
        check(`${width}/${strategy}/${id}内嵌无溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.node-detail').scrollWidth <= document.querySelector('.node-detail').clientWidth));
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator('[data-view=ai]').click();
  for (const id of ['AI-04', 'AI-L2-05', 'AI-L3-01']) {
    await page.locator(`[data-task="${id}"]`).click();
    await page.locator('[data-action=edit-task]').click();
    check(`${id}修订表单带入专属Prompt`, await page.locator('[name=prompt]').inputValue() === tasks.find(task => task.id === id).prompt);
    await page.locator('[name=prompt]').fill('本轮验证草稿 ' + id);
    await page.locator('[name=reason]').fill('验证固定版本隔离');
    await page.locator('button[form=task-form][type=submit]').click();
    check(`${id}保存草稿不覆盖固定版本`, await page.locator('pre.pre').innerText() === tasks.find(task => task.id === id).prompt);
  }
  check('无脚本错误或外网请求', errors.length === 0 && network.length === 0);
  const result = { date: '2026-10-16', passed: checks.length, checks, sources, errors, network };
  await writeFile(path.join(output, '验证结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ passed: checks.length, output, errors, network }));
} finally { await browser.close(); }
