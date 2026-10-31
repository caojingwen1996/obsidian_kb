---
title: AI-07 Target 同一性判断运行闭环
type: feature
created: 2026-10-30
status: done
route: dispatch
review_loop_iteration: 0
baseline_commit: f51689e773558e28a9e9f036c70fa232e9ec9410
context:
  - AGENTS.md
  - docs/system-design/03-系统功能架构/AI任务与提示词/AI-07 Target同一性判断.md
  - docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计.md
---

<frozen-after-approval reason="用户已明确授权完成Schema、运行接入与真实样本评测">

## Intent

完成 AI-07 的可运行闭环：以一个 Object 为单位召回、比较 Target，输出 NEW/REUSE/UNRESOLVED，经校验与授权核定后供事件流程使用，并取得真实模型评测证据。用户已明确选择完整实现，非仅移动文档状态说明。

## Boundaries & Constraints

遵循 AI-07 第2～5节及 F02 当前身份边界。Event 与 Target 独立判断；多个 Object 独立保存；不得把名称相同作为确定性跳过依据；NEW 缺身份、范围或分类条件须待确认。只有可靠已批准映射且依据版本有效时才能跳过AI。没有此类映射的普通调用不得虚构跳过依据。没有对象与输入缺失分别处理。

人工核定不得由模型代替；允许可复核建议，未决不得直接批准；补证后重跑。每个对象须保留输入摘要、资料版本、Fact、候选定义版本、规则/任务版本及合法证据引用。重试幂等，旧输入/批准失效时不得保存，建档前并发复查。错误、超时和截断不转成NEW或有效UNRESOLVED。

Target 按当前主表字段落地：UUID、target_name、aliases、categories、jurisdiction、scope_definition、is_active、definition_version、时间戳；不恢复业务编码、别名表、范围关系表。分类使用已确认6类33项配对配置与校验。不删除现有资料、事件或定义；迁移在隔离数据库验证，正式本机库只允许可重复、无数据删除的新增迁移。禁止用重建命令部署本功能。

复用已有模型传输/权限/审计与流程机制。现有流程仍使用旧AI-03变量和AI-04增量编号，应通过显式适配接入AI-07，不能谎称已完成整条F02编号迁移或pg-boss替换。旧资料只有target_clues时保留缺口，不能把不完整抽取伪装成规范Object。提供有权限的补证/核定入口及操作说明；本轮不做UI重设计。

真实评测调用当前环境已配置模型，不变更模型/账户、不输出密钥。使用库内可追溯真实材料，记录固定样本、依据来源、预期、模型原始结果与校验/语义比对；可以受控构造检索候选来测试歧义，但必须明确标注，不能称真实库已有定义。不得把模拟响应或模型自己的输出当金标；技术失败与语义不通过分别统计。

## I/O & Edge-Case Matrix

| 场景 | 输入/状态 | 预期 | 异常处理 |
| --- | --- | --- | --- |
| 同一对象 | 唯一true且其他false，双方证据完整、候选有效 | REUSE建议，人工核定后复用ID | 拒绝未召回ID和错对象证据 |
| 新对象 | 完整空召回或全部false，定义与原文足够 | NEW建议，核定后建档 | 缺范围/分类则待确认 |
| 身份歧义 | 多个true、任一null或定义停用 | UNRESOLVED，不建档 | 补证重跑 |
| 不完整检索 | 检索失败、截断、无权限 | 不调用模型形成有效结果 | 可恢复失败 |
| 多对象与重试 | 部分已核定，部分未决；重复调用 | 各对象结果独立、复用有效结果 | 不重复建档，不静默跳过未决 |
| 并发与失效 | 定义或输入变化，新对象同时建档 | 拒绝旧批准，重查身份 | 不重复创建、不部分写入 |
| 无对象 | 明确无适用Object | 跳过AI07，记录理由 | 缺失输入不得解释为无对象 |
| 模型异常 | 拒答、截断、非法引用或结构 | 执行失败或拒绝结果 | 有界重试/恢复，不伪装业务结论 |

</frozen-after-approval>

## Code Map

- `src/event-management/candidate-steps.ts`、`src/runtime/event-activities.ts`：现有事件步骤准备/接纳及Worker驱动；目前step2身份、step3关系、step4增量。
- `src/event-management/task-packages.ts`、`contracts.ts`、`current-contracts.ts`：任务注册、Schema及material证据适配。
- `src/event-management/current-model.ts`、`task-executor.ts`：调用预算与输入引用，注意不同对象不可共享一个3次预算导致漏处理。
- `src/event-management/reviews.ts`、`commit.ts`、`definitions.ts`：复核、提交及旧定义快照；适配Target结果，保存前再次核定。
- `src/runtime/current-events.ts`、`current-relay.ts`、`worker.ts`：接口、可靠调度和Worker注册。
- `src/platform/ingestion-migration.ts`、`ingestion-grants.ts`、`src/db/005-ingestion.sql`：schema5迁移与角色；新增迁移不得改为重建。
- `src/information-ingestion/processing/codex.ts`：复用CodexModelClient隔离工具禁用的真实调用；model.ts提供统一解析与HTTP传输。
- `src/tests/fixture.ts`、`ingestion-temporal.e2e.ts`：独立测试数据库和实际Worker验证样式。
- `docs/system-design/05-场景验证/EventTarget关系简化评测集/informations.json`：已有真实原文快照，可选定样本并保留版本/哈希。

## Tasks & Acceptance

**Execution:**
- [x] `src/event-management/target-identity*.ts`及必要任务注册文件：完整输入输出Schema、跨字段/证据/覆盖校验、任务版本与逐对象处理。
- [x] `src/db/007-target-identity.sql`及迁移、角色、分类配置：Target主表和必要运行/复核持久化，非破坏迁移。
- [x] 现有候选、模型、复核、运行接口及关系/提交链：接通AI07；必要新文件按职责归入src；不造只被测试调用的孤立实现。
- [x] `src/tests/ai07*.test.ts`：矩阵、权限、幂等、并发、失效、恢复和真实API/数据库集成；运行类型检查及相关回归。
- [x] `src/scripts/evaluate-ai07.ts`、`docs/verification/ai07-target-identity.md` 与 `docs/verification/ai07/`：可复现真实模型评测（至少覆盖复用、新建、范围差异、歧义及注入），真实原文样本与金标依据分开；脚本不写业务库。
- [x] AI07/F02/数据模型/技术说明、README、index.md、log.md：按实际证据更新版本/状态，保留已知限制。

**Acceptance Criteria:**
- Given schema5与合法资料/候选，When运行AI07并核定，Then真实任务登记、模型调用、结果保存、Target新建/复用及后续消费可以连通，不只验证纯函数。
- Given失败、歧义及过期依据，When重试或批准，Then按矩阵拒绝不合法推进并保留来源；新建前并发复查。
- Given固定真实原文样本与预先设定预期，When使用已配置真实模型评测，Then保存逐项响应、实际统计及失败，不把待执行场景标为通过。

## Design Notes

采用旧 Step 3 前的逐 Object 子任务，单独结果表，不新增 candidate_step_results 第7行（commit要求恰好2/3/4/5四条步骤）。advanceEvent/consumeEvent显式分流AI-07，不按task_id末位当step。保留候选owner_id并新增object_ref预算范围，claim校验窗口/attempt范围一致；call_key仅防重不是预算隔离。原提取target_clues不足以建档，需有证据的Object适配/补证入口；空数组不能默认明确无对象。旧任务包保留，采用明确的新包/开关绑定AI07，当前设置入口可提供新版；不能让旧运行结果被静默套用新契约。

Target用主表并适配旧DefinitionSnapshot，下游仅允许本次已核定Target；提交前复核主表状态、版本及批准。旧JSON定义缺分类/范围不得自动推断迁入。实现同时支持明确无对象与多对象，未决保留且禁止未授权下游越过。

真实评测优先使用央行 INF-cb0b75e9-58e2-44d3-99fd-4bb0117effc5、国债拍卖 INF-11349503-bc62-43d3-9008-457e73aca14a 的短原文，补充Fed不同机构。快照共160份无人工金标；报告应称真实原文＋受控候选定义的逐例语义评测，不能宣称泛化准确率。

## Implementation Notes

- 本轮已有大量未提交修改，必须原位小步增量修改并保留；不回滚、不自动提交或暂存其他工作。
- 使用现有Task/API入口的合理扩展，具体函数拆分由实施者决定。用户已授权完整落实，无需重复申请实施许可；若实际外部依赖不可用，记录阻断并完成其余可验证工作。
- 所有说明和日志中文；执行命令需说明目的；每60秒以内给主线程提供实质进度。

## Spec Change Log

## Review Triage Log

| 来源/编号 | 判定 | 核实依据与处理 |
| --- | --- | --- |
| blind-1 | high | event-settings默认v3但现有页面无Object接口操作；恢复旧默认，新包显式启用，补回归。 |
| blind-2 | high | event-workflows仅20次，Object允许50；与edge-1同根因，扩大有界容量并明确退出失败，补真实工作流验证。 |
| blind-3 | high | 空target表不能覆盖旧definition_sets及历史引用；增加缺失迁移状态门槛，不猜迁身份，不将其当完整空目录。 |
| blind-4 | high | 100项目录允许NEW写第101项后全局不可读；写前容量校验，保留100项目录的复用能力。 |
| edge-1 | high | 与blind-2同根因，合法多对象可达静默退出，合并实施但独立保留本条。 |
| edge-2 | high | step3已prepare后重批AI07仍保留旧context；重新准备受影响下游，验证可以恢复。 |
| edge-3 | high | 原批准人撤权使旧approved分支无法由新reviewer接管；基于现有Target重批，禁止重复NEW建档。 |
| verification-1 | medium | 缺遗漏全部已核定Target的拒绝测试；补错误码与不推进断言。 |
| verification-2 | medium | 缺耗尽/过期AI07预算经重试恢复测试；补真实API及实际reserve，旧窗口仍保留。 |
| verification-3 | medium | 缺最终批准后Target变化的提交拒绝测试；补状态失效及无正式写入断言。 |

上述均属于既定兼容、恢复、完整召回与验证要求，按已授权范围修复。保留本轮前快照及用户已有改动，不对整个脏树执行回滚或重新生成。

## Verification

- `npm run typecheck`：类型检查通过。
- `node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/ai07*.test.ts`：专项通过，隔离数据库。
- `npm test`：检查回归；区分既有失败与本轮引入，避免反复全量运行。
- `node --env-file-if-exists=.env --import tsx src/scripts/evaluate-ai07.ts`：当前真实模型评测产出。
- `python3 ../../rules/check_markdown_tables.py <本轮全部Markdown>`：表格、UTF-8及双链检查。

### 最终验证记录

- 真实模型最终任务包10/10通过，2026-10-31重跑并保留首轮；来源、受控预期及原始响应见验证报告。
- 全量299项中295通过，4失败与本轮前基线一致；本轮新增15项均通过。最后并发锁内执行/提案代际修正另补2项竞态测试并通过。
- 三层审查的10条记录已逐项处理，同根因实施合并但保留独立记录；最后并发代际检查在锁内重验，防止恢复覆盖新的候选状态。
- 文档9份表格、UTF-8及新增链接检查通过；正式库未部署、任务包仍draft。未自动暂存/提交混合脏树。

- 最终专项13/13通过（含真实Temporal Worker），另5项契约通过；类型检查通过。
