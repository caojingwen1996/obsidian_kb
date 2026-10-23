import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(dir, 'AI任务内嵌截图');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const checks = [], errors = [], network = [], captures = [];
const tabs = ['definition', 'schema', 'constraints', 'usage'];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  if (route.request().url().startsWith('file:')) return route.continue();
  network.push(route.request().url()); return route.abort();
});
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const load = () => page.goto(pathToFileURL(path.join(dir, '../M3策略管理中心交互原型.html')).href);
const select = id => page.locator(`[data-node="${id}"]`).click();
const snapshot = async name => {
  await page.locator('.node-detail').evaluate(el => { el.scrollTop = 0; el.scrollIntoView({ block: 'start' }); });
  await page.screenshot({ path: path.join(shots, name + '.png'), animations: 'disabled' });
  captures.push(name + '.png');
};
try {
  await mkdir(shots, { recursive: true });
  await load();
  await page.locator('[data-action=open][data-id="STR-L2-01"]').click();
  const before = await page.evaluate(() => JSON.stringify({ strategies, tasks, flows: DOMAIN_FLOWS }));
  await select('A1');
  check('AI 节点原地展示四标签', await page.locator('[data-node-task-tab]').count() === 4);
  const position = await page.evaluate(() => ({ y: scrollY, left: document.querySelector('.flow-area').scrollTop }));
  await select('A2');
  check('相邻 AI 节点切换保留左侧与页面滚动', await page.evaluate(before => scrollY === before.y && document.querySelector('.flow-area').scrollTop === before.left, position));
  await select('A1');
  check('默认任务定义且固定 @1.0', await page.locator('[data-node-task-tab=definition]').getAttribute('aria-selected') === 'true' && (await page.locator('.embedded-task').innerText()).includes('AI-L2-01 @1.0'));
  check('精简重复标题与职责说明', await page.locator('.embedded-task-head h3, .node-detail.AI .executor-fact, .node-detail.AI .step-kicker').count() === 0);
  check('移除来源解释和技术提示', !(await page.locator('.node-detail').innerText()).includes('来自 AI 智能分析管理') && !(await page.locator('#node-task-content').innerText()).includes('逻辑任务不等同于一次模型调用'));
  check('任务定义保留三个有效信息字段', await page.locator('#node-task-content dt').allTextContents().then(text => text.join('|') === '完成标准|分析步骤|后续处理'));
  check('保留只读状态并提高正文可读性', (await page.locator('.embedded-task-head').innerText()).includes('只读') && await page.locator('.embedded-task .meta').evaluate(el => getComputedStyle(el).fontSize === '14px'));
  check('节点配置与流向独立于任务标签且默认收起', await page.locator('.node-detail>.node-routing').count() === 1 && await page.locator('.node-routing').getAttribute('open') === null && !(await page.locator('.mapping-list').isVisible()));
  check('不再重复显示输入输出定义', await page.locator('.node-detail.AI .node-facts').count() === 0 && !(await page.locator('.node-routing').textContent()).includes('需要什么输入'));
  check('内嵌任务没有维护或跳转按钮', await page.locator('.embedded-task [data-action], .node-detail [data-action=task-link]').count() === 0);
  await page.evaluate(() => { window.retainedFlow = document.querySelector('.flow-area'); });
  for (const tab of tabs) {
    await page.locator(`[data-node-task-tab=${tab}]`).scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => ({ y: scrollY, top: document.querySelector('.flow-area').getBoundingClientRect().top }));
    await page.locator(`[data-node-task-tab=${tab}]`).click();
    check(`${tab} 切换不改变页面与左侧位置`, await page.evaluate(before => scrollY === before.y && document.querySelector('.flow-area').getBoundingClientRect().top === before.top, position));
    check(`${tab} 内容与 C02 共用`, await page.locator('#node-task-content').textContent().then(async text => {
      const expected = await page.evaluate(tab => {
        const container = document.createElement('div');
        container.innerHTML = taskContent(tasks.find(t => t.id === 'AI-L2-01'), tab, { embedded: true });
        return container.textContent.replace(/\s+/g, ' ').trim();
      }, tab);
      return text.replace(/\s+/g, ' ').trim() === expected;
    }));
    check(`${tab} 保留独立折叠区且不复制到正文`, await page.locator('.node-routing').count() === 1 && await page.locator('.node-routing').getAttribute('open') === null && await page.locator('#node-task-content .node-routing').count() === 0);
    check(`${tab} 保留画布与选中`, await page.evaluate(() => retainedFlow === document.querySelector('.flow-area') && document.querySelector('[data-node=A1]').getAttribute('aria-pressed') === 'true' && state.view === 'detail'));
    await snapshot('1440-' + tab);
  }
  await page.locator('[data-node-task-tab=definition]').focus();
  await page.keyboard.press('ArrowRight');
  check('标签支持方向键及焦点', await page.locator('[data-node-task-tab=schema]').evaluate(el => el === document.activeElement && el.getAttribute('aria-selected') === 'true'));
  await page.keyboard.press('End');
  check('End 定位最后标签', await page.locator('[data-node-task-tab=usage]').getAttribute('aria-selected') === 'true');
  check('浏览不改蓝图策略与共享任务', before === await page.evaluate(() => JSON.stringify({ strategies, tasks, flows: DOMAIN_FLOWS })));
  await page.locator('.node-config summary').click();
  check('展开后可见上下游映射与全部分支', await page.locator('.mapping-list').isVisible() && await page.locator('.route-row').count() === await page.evaluate(() => record().flow.find(n => n.id === state.node).next.length));
  check('上游映射引用真实前驱与已配置参数', await page.locator('.mapping-list').textContent().then(async text => {
    const expected = await page.evaluate(() => { const n=record().flow.find(n=>n.id===state.node); return record().flow.filter(source=>source.next.some(edge=>edge.to===n.id)).map(source=>[source.name,source.output,n.input]); });
    return expected.every(values=>values.every(value=>text.includes(value)));
  }));
  check('规则引用与编辑表单仍可访问', await page.locator('.node-routing [name=rule]').isVisible() && await page.locator('.node-routing #node-form').count() === 1);

  await page.locator('#node-form [name=input]').fill('尚未应用的节点映射');
  await page.locator('[data-node-task-tab=schema]').click();
  check('切换任务标签保留未提交节点配置', await page.locator('#node-form [name=input]').inputValue() === '尚未应用的节点映射');
  await select('A2');
  check('切换AI节点时配置区重新默认收起', await page.locator('.node-routing').getAttribute('open') === null);
  await page.locator('.node-routing>summary').click();
  check('切换节点默认任务定义并更新引用', await page.locator('[data-node-task-tab=definition]').getAttribute('aria-selected') === 'true' && (await page.locator('.embedded-task').innerText()).includes('AI-L2-02 @1.0'));
  const scroll = await page.evaluate(() => {
    const panel = document.querySelector('.node-detail'); panel.scrollTop = 0;
    const before = { window: scrollY, left: document.querySelector('.flow-area').getBoundingClientRect().top };
    panel.scrollTop = 150;
    return { moved: panel.scrollTop > 0, stable: before.window === scrollY && before.left === document.querySelector('.flow-area').getBoundingClientRect().top };
  });
  check('右侧独立滚动不移动左侧', scroll.moved && scroll.stable);
  for (const id of ['P1', 'C', 'H', 'E']) {
    await select(id);
    check(`${id} 保留原职责和路径且无 AI 标签`, await page.locator('[data-node-task-tab]').count() === 0 && (await page.locator('.node-detail').innerText()).includes('流向与处理结果'));
  }
  await select('A1');
  await page.locator('#version').selectOption('V1.2');
  check('历史版本节点配置只读', await page.locator('#node-form [name=input]').isDisabled());
  await page.locator('#role').selectOption('授权阅读者');
  await page.locator('#version').selectOption('V2.0');
  check('阅读者草稿配置只读且可看任务', await page.locator('#node-form [name=input]').isDisabled() && await page.locator('[data-node-task-tab]').count() === 4);
  await page.locator('#role').selectOption('系统管理员');
  await page.locator('[data-view=ai]').click();
  await page.locator('[data-task="AI-L2-01"]').click();
  await page.locator('[data-action=edit-task]').click();
  await page.locator('#task-form [name=schema]').fill('{"draftOnly":true}');
  await page.locator('#task-form [name=reason]').fill('验证固定版本');
  await page.locator('button[form=task-form][type=submit]').click();
  await page.locator('[data-view=catalog]').click();
  await page.locator('[data-action=open][data-id="STR-L2-01"]').click();
  await select('A1'); await page.locator('[data-node-task-tab=schema]').click();
  check('C02 草稿不覆盖内嵌固定 Schema', !(await page.locator('#node-task-content').innerText()).includes('draftOnly'));
  await page.locator('[data-node-task-tab=usage]').click();
  check('引用与版本保留草稿提示', (await page.locator('#node-task-content').innerText()).includes('@1.1 草稿'));
  await page.evaluate(() => { record().flow.find(n => n.id === 'A1').taskVersion = '9.9'; render(); });
  check('缺失版本明确显示且不回退', (await page.locator('.embedded-task').innerText()).includes('引用版本不可用') && await page.locator('[data-node-task-tab]').count() === 0);
  await load(); await page.locator('[data-action=panorama]').click();
  for(const header of await page.locator('.module-card:not([open])>summary').all())await header.click();
  for (const id of ['STR-L0-01', 'STR-L0-02', 'STR-L1-01', 'STR-L2-01', 'STR-L2-02', 'STR-L3-01']) {
    const prefix = {'STR-L0-01':'EV','STR-L0-02':'RATE','STR-L1-01':'RISK','STR-L2-01':'STATE','STR-L2-02':'CHANGE','STR-L3-01':'REPORT'}[id];
    const nodes = await page.locator('.node.AI').evaluateAll((nodes,prefix)=>nodes.filter(node=>node.dataset.node.startsWith(prefix+'-')).map(node=>node.dataset.node),prefix);
    for (const node of nodes) {
      await select(node);
      check(`${id}/${node} 固定任务与只读配置`, await page.locator('[data-node-task-tab]').count() === 4 && await page.locator('#node-form [name=input]').isDisabled());
    }
  }
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 });
    for (const tab of tabs) {
      await page.locator(`[data-node-task-tab=${tab}]`).click();
      check(`${width}/${tab} 无横向溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.node-detail').scrollWidth <= document.querySelector('.node-detail').clientWidth));
    }
    await page.locator('[data-node-task-tab=schema]').click(); await snapshot(width + '-responsive');
  }
  await page.setViewportSize({width:1440,height:1050});await load();
  await page.locator('[data-action=open][data-id="STR-L0-01"]').click();await select('A1');
  await snapshot('节点配置-收起-1440');
  await page.locator('[data-node-task-tab=schema]').click();
  check('输入输出定义集中在Tab且配置区仍收起', (await page.locator('#node-task-content').innerText()).includes('输出 Schema') && await page.locator('.node-routing').getAttribute('open') === null);
  check('原输入输出说明只在输入输出Tab展示', await page.locator('#node-task-content').innerText().then(async text=>{const n=await page.evaluate(()=>record().flow.find(n=>n.id===state.node));return text.includes(n.inputDescription)&&text.includes(n.outputDescription); }));
  await snapshot('输入输出Tab-1440');
  await page.locator('.node-routing>summary').click();await snapshot('节点配置-展开-1440');
  await load();await page.locator('[data-action=open][data-id="STR-L2-01"]').click();await select('A1');
  await page.locator('.node-routing>summary').click();
  await page.locator('#node-form [name=input]').fill('upstream_context');
  await page.locator('#node-form [name=output]').fill('extraction_result');
  await page.locator('#node-form button[type=submit]').click();
  check('应用映射后上下游展示同步', (await page.locator('.mapping-list').innerText()).includes('upstream_context') && (await page.locator('.route-list').innerText()).includes('extraction_result'));
  await page.setViewportSize({width:390,height:844});await load();
  await page.locator('[data-action=open][data-id="STR-L0-01"]').click();await select('A1');
  await snapshot('节点配置-收起-390');
  await page.locator('.node-routing>summary').click();await snapshot('节点配置-展开-390');
  check('窄屏展开后无横向溢出', await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.node-detail').scrollWidth<=document.querySelector('.node-detail').clientWidth));
  check('无 JS 错误', errors.length === 0); check('无外网请求', network.length === 0);
  const result = { date: '2026-10-16', passed: checks.length, checks, errors, network, captures };
  await writeFile(path.join(dir, 'AI任务内嵌验证结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
