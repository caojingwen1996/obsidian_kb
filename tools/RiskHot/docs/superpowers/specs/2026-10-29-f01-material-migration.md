---
title: F01资料与单信源任务工程迁移
type: refactor
created: 2026-10-29
status: done
route: dispatch
review_loop_iteration: 0
baseline_commit: f51689e773558e28a9e9f036c70fa232e9ec9410
context:
  - docs/system-design/04-系统架构设计/01-数据模型与存储设计/F01信息接入模块数据模型与存储设计.md
---

<frozen-after-approval reason="用户确认的实施范围">

## Intent

将已确认主设计落实到表、采集、F02及页面。旧库schema4，资料165、Fact1479、Event1；旧状态含running1209及pending分析2，须核对真实工作流。

## Boundaries & Constraints

保留当前工作区全部已有修改。F01业务表使用infomation.ingestion_*，资料表单数material，版本为字段，无原件和四类独立记录；一源一计划、一任务一信源，手动多选分别受理，触发合入任务。身份关联不承载处理状态。

用户2026-10-29最新授权：应用数据库除信源表外，其余表及旧数据均可删除重建，不再迁移旧Fact/Event、证据或任务。保留m1.sources全部当前档案、标识、启停及分类；来源配置历史退出，必要当前档案先核对到sources。隔离库验证先行，再静默应用运行进程及栅栏旧工作流，重建应用库。先导出信源及计数清单，不操作Temporal自身数据库或其他数据库，不删除共享文件。新写入只走新模型，不建旧表兼容视图。

## I/O & Edge-Case Matrix

| 场景 | 输入 | 行为 | 失败处理 |
| --- | --- | --- | --- |
| 手动多选 | N个信源及原幂等键 | N个独立任务，重放复用 | 逐任务反馈 |
| 自动触发 | 同计划时点重复到期 | 唯一任务 | 先建任务后投递 |
| 内容修订 | 同material内容变化 | 版本字段递增 | 旧依据待核验 |
| 抽取零候选 | 完整有效输出 | material保存最小结果 | 不建分析表 |
| 清库切换 | 实际活动执行 | 静默进程并栅栏旧执行后重建 | 禁止旧进程向新模型写入 |

</frozen-after-approval>

## Code Map

- `src/scripts/setup.ts`、`src/platform/event-migration.ts`：旧初始化链；需schema5分流，防重建旧表。
- `src/information-ingestion/processing/repository.ts`、`tasks.ts`、`execution.ts`、`task-results.ts`：旧三种身份及统计。
- `src/information-ingestion/sources/management.ts`：档案版本；保留连接器注册表及解析器。
- `src/runtime/server.ts`、`management.ts`、`scheduler.ts`、`relay.ts`、`activities.ts`、`workflows.ts`：接口及三层工作流。
- `src/event-management/processing.ts`、`store.ts`、`contracts.ts`、`facts.ts`、`commit.ts`、`task-executor.ts`：旧分析总记录依赖。
- `src/runtime/event-activities.ts`、`event-workflows.ts`、`events.ts`及`src/event-management/candidate-steps.ts`、`reviews.ts`、`control.ts`：候选执行、复核及恢复引用同步。
- `src/web/app.js`、`tasks.js`、`reader.js`、`sources.js`：旧ID与结果读取；保留其他页面修改。

## Tasks & Acceptance

- [x] `src/db/005-ingestion.sql`、`src/platform/ingestion-migration.ts`：新增受控重建，保留信源当前档案，其余应用表按目标重建。
- [x] `src/scripts/setup.ts`、`src/platform/grants.ts`、`src/scripts/migrate-ingestion.ts`：初始化、权限、预检与切换命令。
- [x] `src/information-ingestion/processing/repository.ts`、`src/information-ingestion/processing/tasks.ts`、`src/information-ingestion/processing/execution.ts`、`src/information-ingestion/processing/task-results.ts`、`src/information-ingestion/sources/management.ts`：新任务及material存储，来源改当前字段与更新时间校验。
- [x] 上述Code Map中的运行层、事件模块和页面文件：同步接口、执行、证据及页面；连同事件候选、复核与恢复调用点一起调整。
- [x] `src/tests/ingestion-migration.test.ts`及现有采集、事件测试：新建隔离fixture、信源保留、重建回滚、权限与旧依据失效测试。
- [x] `docs/verification/ingestion-migration.md`、`README.md`、`log.md`：记录验证、迁移及剩余项。

验收：给定旧schema4，执行清库重建后信源逐字段和ID不变，旧非信源数据不保留；重复启动／setup不得再次清空新数据，只有显式重建命令允许重置。注入失败则重建事务回滚。给定来源撤权或material更新，提交旧候选则拒绝。给定原部署，切换新代码后采集、正文读取、复核与事件保存均可用，运行应用不再读取被取消表。

## Implementation Notes

实施前只读导出：.riskhot/backups/sources-before-schema5-2026-10-29.json，40条m1.sources，文件权限0600，sha256=f20353e954b1fbbf1b2e053d3a88fe13d3de140179e66c1ea7d1204e438c49d4；根代理已创建，不覆盖。

2026-10-29用户新授权已覆盖旧数据保留约束，本轮改为保留信源、重建其余应用表。此为用户对实施意图的明确修订。

实施前基线npm run typecheck通过；当时尚未修改业务代码或执行迁移。当前分支main，基线f51689e773558e28a9e9f036c70fa232e9ec9410；用户已允许保留未提交修改继续。

## Spec Change Log

- 2026-10-29：用户允许除信源表外全部删除，取消旧业务数据逐项迁移；保持新模型、权限、幂等和隔离验证要求。

## Review Triage Log

三层审查全部返回后逐项核验；以下修复均维持已确认业务与接口能力，采用局部补正，不撤销用户既有工作区修改。

| 编号 | 判定 | 处理 | 核验依据 |
| --- | --- | --- | --- |
| B1 | high | patch | SQL遗漏relations；Reviews真实INSERT此scope，关系复核会违反约束。 |
| B2 | high | patch | send无pending键保护，新确认每次生成随机键，丢响应后可覆盖原命令。 |
| B3 | high | patch | ingestCurrent每次重新discover，无原入口检查点；A失败后最新列表B会改变恢复目标。 |
| B4 | high | patch | saveMaterial事务结束后确认事务未校验version/digest，确有并发修订间隙。 |
| B5 | high | patch | UI缺REPREPARE和允许的review恢复入口，而后端明确阻止UNRESOLVED批准。 |
| B6 | medium | patch | data-source-tasks虽携带key，click分支直接丢弃；恢复已有来源过滤能力。 |
| B7 | medium | patch | 当前接口LIMIT100且无后续页，旧任务无法导航；恢复历史分页。 |
| B8 | medium | defer | 原EventQueries.list也全量投影日期后内存分页，问题早于本轮；需独立做时间投影索引。 |
| B9 | medium | patch | schema5 health/ready固定true，失去原数据库及工件依赖检查。 |
| B10 | high | patch | definition_sets重建为空且setup未登记；现库已确认的本地正式定义范围可作为固定初始化输入。 |
| B11 | low | patch | 事件页只有next，offset未重置；直接补分页导航。 |
| B12 | medium | patch | hashchange仅render，material路由靠15秒轮询；直接刷新目标并栅栏旧请求。 |
| E1 | high | patch | 同B1，relations约束遗漏已核实，保留独立审查行。 |
| E2 | high | patch | reserveCurrentModel按owner/task取最新窗口，未隔离material依据；旧窗口到期会阻止新内容。 |
| E3 | high | patch | submitMany外层action持有连接再submit取连接，达到池上限的并发会等待至超时。 |
| E4 | high | patch | 同B2，pending没有新键保护。 |
| E5 | medium | patch | 同B7，超过100项确被截断。 |
| E6 | high | patch | 同B5，UNRESOLVED及特定review原因缺可继续入口。 |
| E7 | high | patch | 同B10，普通迁移初始化不能启动事件处理。 |
| V1 | medium | patch | 预验证缺口：现测试直接submit，未调用schema5 Scheduler.tick核对两周期和next_run_at。 |
| V2 | medium | patch | 预验证缺口：未经真实control API测试暂停继续及旧代际拒绝写入。 |
| V3 | medium | patch | 预验证缺口：仅直接markFailure，未测reconcile closed/missing/running/unknown。 |
| P1 | high | patch | setup曾串联旧共享测试库，可能在主库完成初始化前失败；现已分离，重复setup测试通过。 |
| P2 | medium | patch | run/run-sources/monitor命令仍调用旧API，迁移后404/410；同步现行命令和文档。 |

合并处理：B1/E1、B2/E4、B5/E6、B7/E5、B10/E7分别同根因；其余独立处理。B8记录到延后事项，其余由原实现代理及主代理局部修复并复验。

审查修复已复验：23项新模型集成与10组浏览器全部通过；真实Temporal链路通过。B8性能事项及完整回归3项既有失败单独延后，不恢复已删除提示词文档。实际库已完成重建、原信源字段核对与真实采集抽取。

## Design Notes

material保存最小抽取结果及版本摘要；候选承接既有业务状态。公共执行只保存运行控制与不透明引用，不复制旧processing整行。输入临时读取，模型审计不以整份正文快照恢复原件／版本表。清库后旧链接明确返回不存在或已重置，不能把旧UUID当新对象；普通启动只确保schema版本，破坏性重置必须显式调用。

## Verification

- `npm run typecheck`：通过。
- 新模型集成23/23通过，见final-integration.log；覆盖20项核心修复及定义登记、CLI、正式事件文件与交付权限。
- 独立浏览器10/10组通过，无页面错误；实际点击重准备、关系复核、恢复、最终审批、历史分页与同页资料导航。
- 真实Temporal隔离库/命名空间链路通过，6次受控模型调用，Worker重启恢复、人工审批、事件保存和交付通过。
- `npm test`：279项中276项通过，3项既有提示词引用／旧链路失败；未通过项见final-full.log与验收报告。
- 本机重建完成，40条信源原字段及ID一致，40份86400秒停用计划，旧表退出。真实央行任务完成，1份资料、2个候选，真实模型尝试accepted；真实事件没有代替用户审批。
- 切换后真实API/model角色权限测试1/1通过，健康与session接口200。数据库、备份摘要及部署证据见deployment.json。
