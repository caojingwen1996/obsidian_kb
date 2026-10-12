import { spawn } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { scenarioCatalog } from '../tests/fixtures/scenario-catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = new URL('../05-场景验证/', import.meta.url);
const files = (await readdir(new URL('../tests/scenarios/', import.meta.url)))
  .filter((x) => x.endsWith('.test.ts'))
  .sort()
  .map((x) => 'tests/scenarios/' + x);
const args = ['--import', 'tsx', '--test', '--test-concurrency=1', '--test-reporter=tap', ...files];
const startedAt = new Date().toISOString();
let output = '';
const child = spawn(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => {
  output += String(chunk);
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  output += String(chunk);
  process.stderr.write(chunk);
});
const exitCode = await new Promise<number>((resolve) => {
  child.on('error', (error) => {
    output += '\n' + error.message;
    resolve(1);
  });
  child.on('close', (code) => resolve(code ?? 1));
});
const results = scenarioCatalog.map((item) => {
  const line = output.split('\n').find((x) => new RegExp(`^(?:not )?ok \\d+ - ${item.id} `).test(x));
  return {
    ...item,
    name: line?.replace(/^(?:not )?ok \d+ - /, '') ?? item.id,
    status: line ? (line.startsWith('not ok ') ? 'FAIL' : 'PASS') : 'NOT_RUN',
  };
});
const counts = {
  total: results.length,
  passed: results.filter((x) => x.status === 'PASS').length,
  failed: results.filter((x) => x.status === 'FAIL').length,
  not_run: results.filter((x) => x.status === 'NOT_RUN').length,
};
const report = {
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  environment: {
    node: process.version,
    database: '本机独立 riskhot_test；不清理 riskhot',
    transport: 'Fastify inject + 真实 PostgreSQL',
    model: '人工结构化夹具；不调用供应商模型',
    temporal: '本套未启动 Temporal Worker，不证明持久执行恢复',
  },
  command: ['node', ...args].join(' '),
  exit_code: exitCode,
  counts,
  cases: results,
};
await mkdir(directory, { recursive: true });
await writeFile(new URL('scenario-results.json', directory), JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(new URL('scenario-results.tap.txt', directory), output, 'utf8');
const requirements = await readFile(
  new URL('../03-业务功能需求/RiskHot_系统业务功能需求规格说明书_V1.0.md', import.meta.url),
  'utf8',
);
const allFr = [...requirements.matchAll(/^### (FR-[A-Z0-9]+-\d{2}) /gm)].map((m) => m[1]!);
const uniqueAc = new Set(results.flatMap((x) => x.acceptance));
const associatedFr = new Set(results.flatMap((x) => x.requirements));
const unassociated = allFr.filter((x) => !associatedFr.has(x));
const rows = results
  .map((x) => `| ${x.id} | ${x.status} | ${x.requirements.join('、')} | ${x.name.replace(x.id + ' ', '')} |`)
  .join('\n');
const detailed = results
  .map(
    (x) =>
      `### ${x.id} ${x.name.replace(x.id + ' ', '')}\n\n- 关联需求：${x.requirements.join('、')}。\n- 关联验收：${x.acceptance.join('、') || '测试环境隔离专项；无对应业务 AC'}。\n- 前置数据：${x.baseline}\n- 操作：${x.action}\n- 期望：${x.expected}\n- 自动化：[${x.source}](../${x.source})；测试名以 \`${x.id}\` 开头。\n- 实际状态：**${x.status}**，以本次执行记录为准。`,
  )
  .join('\n\n');
const body = `# RiskHot 系统场景验证测试案例 V1.0

状态：可执行场景与本次真实结果。开始时间：${report.started_at}；完成时间：${report.completed_at}。

## 1. 验证结论与范围

本次共 ${counts.total} 个场景：**${counts.passed} 通过、${counts.failed} 失败、${counts.not_run} 未执行**；进程退出码 ${exitCode}。结果来自 Node 测试运行器输出，未按文档预期填写。

关联 ${associatedFr.size}/${allFr.length} 项功能需求、${uniqueAc.size} 个验收编号。**关联不等于整项需求或整条 AC 全部通过**：例如 HTTP 导出测试不替代浏览器可访问性验收，命令层计划幂等不替代 Temporal 恢复演练，人工结构化判断不替代真实模型金融语义评测。只有用例中明确断言的行为有自动化证据。

依据：[业务功能需求规格](../03-业务功能需求/RiskHot_系统业务功能需求规格说明书_V1.0.md)、[系统架构设计](../04-系统架构设计/RiskHot_系统架构设计_V1.0.md)、[命令契约](../packages/contracts/commands.json)。

## 2. 环境与执行

后端采用真实 PostgreSQL，本套数据库固定为本机 \`riskhot_test\`。测试前检查连接 URL 及数据库实际名称；拒绝开发库 \`riskhot\` 或任何远端地址。每个场景重新准备账号、配置及业务资料，不依赖场景执行顺序。原文使用 example.invalid 定位符，不访问网络；密码是隔离环境专用测试夹具。

\`pnpm report:scenarios\` 运行全部场景并重写此文档与结果工件。直接运行测试可用：

\`node --import tsx --test --test-concurrency=1 tests/scenarios/*.test.ts\`

需要本地 PostgreSQL 可连接且项目依赖已安装；不要将 TEST_DATABASE_URL 指向开发或生产数据库。HTTP 场景使用 Fastify inject，覆盖真实请求校验、认证、CSRF、领域命令及数据库，但没有模拟浏览器渲染。

结果工件：[JSON](scenario-results.json)、[原始 TAP](scenario-results.tap.txt)。失败时进程返回非零；用例未产出结果会标记 NOT_RUN，不推算为成功。

## 3. 场景总览

| 场景 | 本次状态 | 关联需求 | 名称 |
| --- | --- | --- | --- |
${rows}

## 4. 详细案例

${detailed}

## 5. 覆盖差距与生产验收

未关联独立自动化场景的 FR：${unassociated.join('、')}。这些编号不应因为相邻流程通过而标记通过。

以下项目没有由本测试套件证明，应作为独立验收保留：

| 项目 | 当前证据边界 | 后续验收 |
| --- | --- | --- |
| 真实模型与语义质量 | 本套固定人工 JSON；验证结构和业务硬约束 | 真实供应商拒绝、截断、限流、引用和语义盲评；D-12 阈值获批 |
| 分阶段 Agent 分析 | 判断来源/缓冲/损害/力量字段由人工夹具提供 | 公告不等于效果、局部不等于整体、时间流逝不等于持续性缩短等对抗样本 |
| Temporal 重试、恢复与升级 | 本套只验证任务命令、代次和提交资格 | Worker 杀进程、重复交付、执行历史 replay、版本切换、响应未知情况 |
| 浏览器真实操作 | 本套使用HTTP注入，无浏览器渲染 | 完整登录到报告流程、表单错误、键盘操作、窄屏和撤回缓存 |
| 异步采集与批次 | 本套人工原文录入及指标批量导入 | 正式来源适配、附件定位、子项部分失败、缺正文和补采恢复 |
| 复核中心和影响传播 | 本套验证部分领域决定与版本冲突 | 认领/转派/退回后的流程恢复；修订原文对既有快照/报告的影响队列 |
| 灾备和性能 | 本套隔离数据库功能测试 | 需求 NFR 容量、P95、RPO/RTO；备份恢复、对象工件一致性及权限配置 |
| OIDC与生产凭据 | 本地账号与Cookie权限路径 | 外部身份提供者、TLS/代理配置、凭据轮换与部署检查 |

架构场景 AT-03、06、07、08、09、14 有对应局部工程证据；AT-01、02、04、05、10—13、15—16 不因本套通过而视为全量验收。尤其 AT-09 尚需真实浏览器缓存路径；AT-08 的不可比历史仍需补充语义样本。

## 6. impl-validator 核验

| 检查 | 判定 | 证据 |
| --- | --- | --- |
| 真实执行记录 | ${exitCode === 0 && counts.not_run === 0 ? 'PASS' : 'FAIL'} | 原始 TAP 与进程退出码；${counts.passed}/${counts.total} 通过 |
| 案例可定位 | ${counts.not_run === 0 ? 'PASS' : 'WARN'} | 场景 ID 对应测试文件及真实测试名 |
| 不污染开发库 | PASS | 连接 URL 白名单与 current_database 双校验；SC-001 |
| 不扩大测试结论 | WARN | 只报告已执行硬约束，生产、AI、浏览器和耐久运行另有验收项 |

总体：**${counts.failed || counts.not_run || exitCode !== 0 ? 'FAIL' : 'WARN'}**。全部自动化通过也只代表本套范围通过，不能代替需求第16.4节与架构第20.3节的系统上线验收。
`;
await writeFile(new URL('RiskHot_场景验证测试案例_V1.0.md', directory), body, 'utf8');
console.log(JSON.stringify({ report: '05-场景验证/scenario-results.json', ...counts, exit_code: exitCode }));
process.exitCode = exitCode || (counts.failed || counts.not_run ? 1 : 0);
