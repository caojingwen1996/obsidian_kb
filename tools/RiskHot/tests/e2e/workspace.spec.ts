import { test, expect, type Page, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { blankAnalysis } from '../../packages/domains/analysis/index.js';
import type { Data, RecordRow } from '../../packages/platform/core/types.js';

const password = 'RiskHot-browser-fixture-2026!';
const dialog = (page: Page) => page.locator('dialog[open]').last();
async function closePanels(page: Page) {
  while (await page.locator('dialog[open]').count())
    await dialog(page).getByRole('button', { name: '关闭面板', exact: true }).click();
}
async function submit(page: Page, command: string, title: string) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/commands/' + command) && r.request().method() === 'POST',
  );
  await dialog(page).getByRole('button', { name: title, exact: true }).click();
  const r = await response;
  const data = await r.json();
  expect(r.status(), JSON.stringify(data)).toBe(200);
  await expect(dialog(page).getByRole('heading', { name: '操作已保存' })).toBeVisible();
  await dialog(page).getByRole('button', { name: '完成', exact: true }).click();
  return data;
}
async function field(panel: Locator, name: string, value: string) {
  await panel.getByLabel(name, { exact: false }).first().fill(value);
}
async function openRow(page: Page, title: string) {
  await page.getByRole('button', { name: title, exact: false }).first().click();
}

test('B-01 浏览器完成首次登录、资料→事件→纳管→分析审核→报告发布撤回', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '建立研究工作区' })).toBeVisible();
  await page.getByLabel('显示名称', { exact: true }).fill('浏览器场景管理员');
  await page.getByLabel('登录名', { exact: true }).fill('browser-admin');
  await page.getByLabel('密码', { exact: false }).fill(password);
  await page.getByRole('button', { name: '创建并进入工作区' }).click();
  await expect(page.getByRole('heading', { name: '风险总览', exact: true })).toBeVisible();
  const auth = await (await page.request.get('/api/v1/auth/me')).json();
  const cmd = async (name: string, input: Data): Promise<RecordRow> => {
    const r = await page.request.post('/api/v1/commands/' + name, {
      data: input,
      headers: { 'X-CSRF-Token': auth.csrf, 'Idempotency-Key': randomUUID() },
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  };
  const config = async (kind: string, data: Data) => {
    const draft = await cmd('reference.save', { kind, data });
    return cmd('reference.approve', {
      id: draft.id,
      expected_version: draft.version,
      reason: '浏览器测试配置夹具',
    });
  };
  const target = await config('target', {
    name: '浏览器测试经济体',
    code: 'B_ECO',
    type: 'economy',
    jurisdiction: '场景辖区',
    scope: '整体宏观范围',
  });
  const variable = await config('variable', {
    name: '政策利率',
    code: 'B_RATE',
    definition: '政策公布利率',
    boundary: '政策利率',
    unit: '%',
  });
  await config('risk_source', {
    name: '货币条件',
    code: 'B_MONETARY',
    definition: '货币条件带来的压力',
    analysis_level: 'macro',
  });
  await config('dimension', { name: '流动性', code: 'liquidity', definition: '融资与市场流动性压力' });
  const src = await cmd('information.source', {
    data: {
      name: '浏览器场景来源',
      code: 'B_SOURCE',
      url: 'https://example.invalid',
      category: 'official',
      scope: '测试专用',
    },
  });
  await cmd('information.source_status', {
    id: src.id,
    expected_version: src.version,
    status: 'active',
    reason: '本地场景无网络抓取',
  });
  // Only prerequisite dictionaries are API fixtures; business steps below use visible forms.
  await page.goto('/information');
  await page.getByRole('button', { name: '录入原文', exact: true }).first().click();
  let panel = dialog(page);
  await field(panel, '信息来源', src.id);
  await field(panel, '原始地址', 'https://example.invalid/browser/policy');
  const content = '浏览器场景：央行宣布提高政策利率，计划下一周实施。';
  await field(panel, '原文', content);
  await panel.getByLabel('原始发布时间未知').uncheck();
  const info = (await submit(page, 'information.ingest', '录入原文')) as RecordRow;
  await page.getByRole('tab', { name: '宏观事件', exact: true }).click();
  await page.getByRole('button', { name: '确认事件与增量', exact: true }).first().click();
  panel = dialog(page);
  await field(panel, '原文依据', info.id);
  await field(panel, '事件标题', '测试政策利率公告');
  await field(panel, '事件行为主体', '场景央行');
  await field(panel, '行为', '上调政策利率');
  await field(panel, '发生或计划时间', '已公告，计划下一周实施');
  await panel.getByLabel('事件阶段').selectOption('announced');
  await panel.getByLabel('更新类型').selectOption('NEW_EVENT');
  await field(panel, '原文引句', content);
  await field(panel, '事件摘要', '政策调整已公告；实施效果待核验');
  await panel
    .getByRole('textbox', { name: '事件观测主体与变量关系', exact: true })
    .fill(JSON.stringify([{ target_id: target.id, variable_ids: [variable.id] }]));
  const event = await submit(page, 'information.event', '确认事件与增量');
  await page.goto('/analysis');
  await page.getByRole('tab', { name: '风险候选', exact: true }).click();
  await page.getByRole('button', { name: '保存完整风险候选', exact: true }).first().click();
  panel = dialog(page);
  await field(panel, '风险名称', '宏观再融资压力');
  await field(panel, '事件依据', event.event.id);
  await field(panel, '完整风险定义', '货币条件紧缩可能增加整体再融资压力');
  await field(panel, '观察对象', target.id);
  await field(panel, '风险范围与边界', '场景经济体全域');
  await field(panel, '因果机制', '政策利率经融资渠道传导至再融资成本');
  await field(panel, '风险类型代码', 'liquidity');
  await panel.getByRole('textbox', { name: '风险源代码', exact: true }).fill('["B_MONETARY"]');
  await panel.getByRole('textbox', { name: '潜在损害对象', exact: true }).fill('[]');
  await panel.getByRole('textbox', { name: '关键变量与作用机制', exact: true }).fill(
    JSON.stringify([
      {
        variable_id: variable.id,
        name: '政策利率',
        role: 'risk_driver',
        impact_mechanism: '利率上升增加融资压力',
        risk_source_code: 'B_MONETARY',
      },
    ]),
  );
  await submit(page, 'registry.candidate', '保存完整风险候选');
  await openRow(page, '宏观再融资压力');
  await dialog(page).getByRole('button', { name: '复核风险同一性', exact: true }).click();
  panel = dialog(page);
  await panel.getByLabel('决定').selectOption('new');
  await field(panel, '操作理由', '完整定义和范围未命中已有风险');
  await submit(page, 'registry.match', '复核风险同一性');
  await dialog(page).getByRole('button', { name: '正式纳管', exact: true }).click();
  await field(dialog(page), '操作理由', '宏观范围内且已具备明确观察变量');
  const risk = (await submit(page, 'registry.admit', '正式纳管')) as RecordRow;
  await closePanels(page);
  await page.goto('/risks/' + risk.id);
  await expect(page.getByRole('heading', { name: '宏观再融资压力', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发起本轮观察' }).click();
  const task = (await submit(page, 'analysis.start', '发起观察')) as RecordRow;
  await page.goto('/analysis');
  await page.getByRole('tab', { name: '分析快照', exact: true }).click();
  await page.getByRole('button', { name: '保存研究草稿', exact: true }).first().click();
  panel = dialog(page);
  await field(panel, '任务', task.id);
  await panel.getByRole('button', { name: '加载本轮分析模板' }).click();
  await expect(panel.getByRole('button', { name: '加载本轮分析模板' })).toBeEnabled();
  const data = blankAnalysis(task.data.input as Data);
  data.risk_stage = 'accumulating';
  data.persistence_outlook = '后续取决于政策实施和融资数据';
  data.status_summary = {
    source_pressure: '政策调整已公告',
    response_effect: '效果尚未证实',
    force_balance: 'undetermined',
    damage: '尚未证实',
    limitations: ['浏览器人工场景，未调用模型'],
  };
  const manifest = task.data.input as Data;
  data.variable_analysis = (manifest.variables as Data[]).map((v) => ({
    relation_id: v.relation_id!,
    observed_state: '政策已经公告',
    risk_effect: 'pressure',
    source_refs: [(manifest.evidence as Data[])[0]!.id!],
    interpretation: '可能增加融资压力',
    uncertainty: '实施效果待核验',
  }));
  data.stages = Object.fromEntries(
    ['source', 'buffer', 'damage', 'force', 'current', 'trend', 'persistence', 'node'].map((k) => [
      k,
      'completed',
    ]),
  );
  await panel.getByRole('textbox', { name: '业务内容', exact: true }).fill(JSON.stringify(data));
  const snapshot = (await submit(page, 'analysis.draft', '保存研究草稿')) as RecordRow;
  expect((snapshot.data.stages as Data).source).toBe('completed');
  const snapButton = page
    .locator('tr')
    .filter({ hasText: snapshot.id.slice(0, 8) })
    .getByRole('button')
    .first();
  await snapButton.click();
  await dialog(page).getByRole('button', { name: '提交分析审核', exact: true }).click();
  await submit(page, 'analysis.submit', '提交分析审核');
  await dialog(page).getByRole('button', { name: '批准分析', exact: true }).click();
  await field(dialog(page), '操作理由', '核验截止、引用、首次未知和全部分析阶段');
  await submit(page, 'analysis.approve', '批准分析');
  await closePanels(page);
  await page.goto('/reports');
  await page.getByRole('button', { name: '编制报告', exact: true }).first().click();
  const report = (await submit(page, 'publication.generate', '编制周期报告')) as RecordRow;
  await page
    .locator('tr')
    .filter({ hasText: report.id.slice(0, 8) })
    .getByRole('button')
    .first()
    .click();
  await dialog(page).getByRole('button', { name: '提交报告审核', exact: true }).click();
  await submit(page, 'publication.submit', '提交报告审核');
  await dialog(page).getByRole('button', { name: '发布报告', exact: true }).click();
  await field(dialog(page), '操作理由', '固定版本引用与文字一致，人工发布');
  await submit(page, 'publication.publish', '发布报告');
  await expect(dialog(page).getByRole('link', { name: 'Markdown' })).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog(page).getByRole('link', { name: 'Markdown' }).click();
  expect((await download).suggestedFilename()).toContain(report.id);
  await dialog(page).getByRole('button', { name: '撤回报告', exact: true }).click();
  await field(dialog(page), '操作理由', '测试撤回后的访问控制');
  await submit(page, 'publication.withdraw', '撤回报告');
  await expect(dialog(page).getByRole('link', { name: 'Markdown' })).toHaveCount(0);
  expect((await page.request.get(`/api/v1/reports/${report.id}/export?format=markdown`)).status()).toBe(410);
  await closePanels(page);
  await page.goto('/');
  await page.screenshot({
    path: testInfo.outputPath('browser-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('browser-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page
      .locator('.metric-strip, .metric, .overview-banner h2')
      .evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth + 1)),
  ).toBe(true);
  await page.getByRole('button', { name: '展开导航' }).click();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('B-02 登录错误、正常登录退出、手机导航与布局', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '欢迎回到研究现场' })).toBeVisible();
  await page.getByLabel('登录名', { exact: true }).fill('browser-admin');
  await page.getByLabel('密码', { exact: false }).fill('incorrect-test-password');
  await page.getByRole('button', { name: '进入工作区', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('账号或密码错误');
  await page.getByLabel('密码', { exact: false }).fill(password);
  await page.getByRole('button', { name: '进入工作区', exact: true }).click();
  await expect(page.getByRole('heading', { name: '风险总览', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('browser-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '展开导航' }).click();
  await expect(page.getByRole('link', { name: '风险目录', exact: true })).toBeInViewport();
  await page.getByRole('link', { name: '风险目录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '风险目录', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '展开导航' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回到研究现场' })).toBeVisible();
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
});

test('B-03 配置与策略分区、分类表单、规则纠错审核、资料与数据入口', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/config');
  await page.getByLabel('登录名', { exact: true }).fill('browser-admin');
  await page.getByLabel('密码', { exact: false }).fill(password);
  await page.getByRole('button', { name: '进入工作区', exact: true }).click();
  const directory = page.getByRole('navigation', { name: '配置中心目录' });
  await expect(directory.getByRole('link')).toHaveCount(4);
  await expect(directory).not.toContainText('评估规则');
  await expect(directory).not.toContainText('事件的观测主体');
  await expect(page.getByRole('button', { name: '货币条件', exact: true })).toBeVisible();
  await directory.getByRole('link', { name: '风险类型' }).click();
  await expect(page).toHaveURL(/\/config\?view=dimension$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: '风险类型', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '流动性', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新建风险类型', exact: true }).first().click();
  await expect(dialog(page).getByRole('heading', { name: '新建风险类型', exact: true })).toBeVisible();
  await expect(dialog(page).getByRole('combobox')).toHaveCount(0);
  await field(dialog(page), '名称', '页面分区测试类型');
  await field(dialog(page), '唯一编码', 'B_PAGE_DIM');
  await field(dialog(page), '风险类型定义', '仅用于验证配置页面的类别边界');
  const dimension = (await submit(page, 'reference.save', '新建风险类型')) as RecordRow;
  expect(dimension.kind).toBe('dimension');
  await page.screenshot({ path: testInfo.outputPath('config-desktop.png'), fullPage: true });

  await page.getByRole('navigation', { name: '管理工作区' }).getByRole('link', { name: '策略中心' }).click();
  await expect(page.getByRole('heading', { name: '策略中心', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '策略中心目录' }).getByRole('link')).toHaveCount(2);
  await page.getByRole('button', { name: '新建评估规则', exact: true }).first().click();
  let panel = dialog(page);
  await field(panel, '名称', '页面测试等级规则');
  await field(panel, '唯一编码', 'B_PAGE_RULE');
  await panel.getByLabel('规则类别').selectOption('m');
  await panel.getByRole('textbox', { name: 'M 评分权重', exact: true }).fill('{');
  await expect(panel.getByRole('button', { name: '新建评估规则', exact: true })).toBeDisabled();
  await panel.getByLabel('规则类别').selectOption('weakening');
  await expect(panel.getByLabel('减弱节点确认条件')).toBeVisible();
  await expect(panel.getByLabel('校准证据')).toBeVisible();
  await expect(panel.getByRole('textbox', { name: 'M 评分权重', exact: true })).toHaveCount(0);
  await panel.getByLabel('规则类别').selectOption('freshness');
  await expect(panel.getByLabel('最长有效时长')).toHaveAttribute('min', '1');
  await panel.getByLabel('最长有效时长').fill('48');
  await panel.getByLabel('规则类别').selectOption('risk_level');
  await expect(panel.getByLabel('最长有效时长')).toHaveCount(0);
  await field(panel, '规则说明', '按证据严重度定义风险等级');
  await field(panel, '适用范围', '仅用于浏览器场景');
  await panel
    .getByRole('textbox', { name: '风险等级及顺序', exact: true })
    .fill('[{"code":"low","order":1},{"code":"low","order":2}]');
  const rejected = page.waitForResponse((r) => r.url().endsWith('/commands/reference.save'));
  await panel.getByRole('button', { name: '新建评估规则', exact: true }).click();
  expect((await rejected).ok()).toBe(false);
  await expect(panel.getByRole('alert')).toContainText('等级编码重复');
  await panel
    .getByRole('textbox', { name: '风险等级及顺序', exact: true })
    .fill('[{"code":"low","order":1},{"code":"high","order":2}]');
  const rule = (await submit(page, 'reference.save', '新建评估规则')) as RecordRow;
  expect(rule.kind).toBe('rule');
  expect(rule.data).not.toHaveProperty('max_hours');
  expect(rule.data).not.toHaveProperty('weights');
  await openRow(page, '页面测试等级规则');
  await dialog(page).getByRole('button', { name: '编辑评估规则', exact: true }).click();
  await expect(dialog(page).getByLabel('规则类别')).toHaveValue('risk_level');
  await expect(dialog(page).getByRole('textbox', { name: '风险等级及顺序', exact: true })).toContainText(
    'high',
  );
  await dialog(page).getByRole('button', { name: '取消', exact: true }).click();
  await dialog(page).getByRole('button', { name: '批准策略', exact: true }).click();
  await field(dialog(page), '操作理由', '确认规则范围与等级顺序');
  const approved = (await submit(page, 'reference.approve', '批准策略')) as RecordRow;
  expect(approved.id).toBe(rule.id);
  expect(approved.status).toBe('approved');
  await expect(dialog(page).getByRole('button', { name: '编辑评估规则', exact: true })).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: '停用策略', exact: true })).toBeVisible();
  await closePanels(page);
  await page.screenshot({ path: testInfo.outputPath('strategies-desktop.png'), fullPage: true });

  await page
    .getByRole('navigation', { name: '策略中心目录' })
    .getByRole('link', { name: '分析模板' })
    .click();
  await page.getByRole('button', { name: '新建分析模板', exact: true }).first().click();
  panel = dialog(page);
  await expect(panel.getByLabel('规则类别')).toHaveCount(0);
  await field(panel, '名称', '页面测试分析模板');
  await field(panel, '唯一编码', 'B_PAGE_PROMPT');
  await field(panel, '分析用途', '验证分析方法与分类设置分开');
  await field(panel, '模板正文', '区分事实、判断及未决事项，列出证据与时间边界。');
  const prompt = (await submit(page, 'reference.save', '新建分析模板')) as RecordRow;
  expect(prompt.kind).toBe('prompt');
  await page.goBack();
  await expect(page.getByRole('heading', { name: '评估规则', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '页面测试等级规则', exact: true })).toBeVisible();

  await page.goto('/config?view=rule');
  await expect(page.getByRole('heading', { name: '风险源', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '页面测试等级规则', exact: true })).toHaveCount(0);
  await page.goto('/reference?view=target');
  await expect(page.getByRole('heading', { name: '事件的观测主体', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '浏览器测试经济体', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: '基础资料目录' })
    .getByRole('link', { name: '全局变量' })
    .click();
  await expect(page.getByRole('button', { name: '政策利率', exact: true })).toBeVisible();
  await page.goto('/data');
  await expect(page.getByRole('heading', { name: '数据管理', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导入观测数据', exact: true }).first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const section of ['config', 'strategies', 'reference', 'data']) {
    await page.goto('/' + section);
    await expect(page.locator('.management-workspace')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(
      page.getByRole('navigation', { name: '管理工作区' }).getByRole('link', { name: '策略中心' }),
    ).toBeInViewport();
  }
  await page.goto('/strategies');
  await page.screenshot({ path: testInfo.outputPath('strategies-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '展开导航' }).click();
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '策略中心', exact: true }).scrollIntoViewIfNeeded();
  await expect(nav.getByRole('link', { name: '策略中心', exact: true })).toBeInViewport();
  await nav.getByRole('link', { name: '账号与权限', exact: true }).scrollIntoViewIfNeeded();
  await expect(nav.getByRole('link', { name: '账号与权限', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeInViewport();
  expect(errors).toEqual([]);
});
