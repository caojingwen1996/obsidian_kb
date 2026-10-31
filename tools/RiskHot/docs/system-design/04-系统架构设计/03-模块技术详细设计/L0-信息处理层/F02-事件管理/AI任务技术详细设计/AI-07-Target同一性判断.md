# AI-07 Target 同一性判断技术实现

> V0.1 · 2026-10-30 · 工程实现与小样本评测；任务包仍为 draft，正式库尚未部署本迁移。

## 1. 依据与边界

依据[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-07 Target同一性判断|AI-07 功能与提示词设计]]及[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计|F02 数据模型]]实现。验证范围与原始结果见[[tools/RiskHot/docs/verification/ai07-target-identity|AI-07 验证记录]]。

新包 `f02-target-identity-v3` 在现有运行 Step 3（旧 AI-03 关系识别）之前增加逐 Object 子任务。逻辑上属于知识实例融合；当前代码仍保留 AI-02 身份、AI-03 关系、AI-04 增量、AI-05 文字评价的旧编号。本实现不代表 F02 全部目标步骤或 pg-boss 调度迁移完成。旧包 `f02-fact-draft-v2` 保持原行为。

## 2. 机器契约

权威实现为 `src/event-management/target-identity-contracts.ts`，导出 `targetInputSchema`、`targetOutputSchema`、`targetObjectSchema`、`targetEvidenceSchema` 和 `targetDefinitionSchema`。AJV 校验结构后，程序继续检查引用、覆盖与决定一致性。任务登记在 `contracts.ts`、`task-packages.ts`；运行提示词为 `targetIdentityPrompt`，完整设计提示词在功能文档，两者不宣称逐字相同。任务摘要覆盖运行提示词、Schema、策略与版本。

| 输入字段 | 实际内容 |
| --- | --- |
| rule_version / category_version | target-identity-v1 / financial-target-categories-v1，固定6类33项分类配对 |
| object_ref / object | 单个对象、名称、分类、辖区、范围、限制、不确定性、原文引文 |
| fact_context | 当前 candidate 陈述、candidate_fact 的 Fact ID、资料 ID/版本/摘要 |
| retrieval | complete、truncated、完整目录快照摘要；不将失败当空目录 |
| candidates | Target 主表的名称、别名、分类、辖区、范围、状态和定义版本 |
| basis_catalog | 当前对象引文与每个候选的定义快照；引用限定当前输入及所属对象 |

`output_schema` 位于 TaskInput.manifest；不重复放入 context。原文依据必须通过 material_id、version、content_digest、segment_id 与 Unicode 码点区间逐字核对。候选定义使用 definition_version，不套用原文位置。

输出固定为 object_ref、decision、matched_target_id、comparisons、reason、basis_refs、unresolved_issues。每个候选恰好一次比较；明确 true/false 必须同时引用对象证据与该候选定义。REUSE 要求唯一 true、其他 false 且目标有效；NEW 要求全部 false 或完整空目录，以及对象名称、范围、分类完整且无身份不确定项。多个 true、任一 null 或同一对象停用应返回 UNRESOLVED，禁止直接核定。

## 3. 运行与核定

1. `TargetIdentity.setObjects` 接收 event_review 授权的对象补证并固定资料证据。明确无对象须显式标记并给理由；没有输入不能当作无对象。
2. `advance` 读取完整 Target 目录，生成一个对象的输入和运行记录。当前最多100个目录对象，超过上限以 TARGET_RETRIEVAL_INCOMPLETE 停止，不截断后继续判断；100项时禁止新增第101项，返回TARGET_CATALOG_CAPACITY_EXCEEDED。旧定义集合或历史关系存在尚未映射到主表的ID时返回TARGET_LEGACY_MIGRATION_REQUIRED，不声明完整空目录。
3. `EventExecutor` 按 candidate、task、material依据及 object_ref 隔离预算，单对象最多3次、10分钟；相同调用键幂等。模型沿用现有受控传输与解析器。
4. `consumeEvent` 显式将 AI-07 分流到 `accept`；结果通过结构、引用和当前依据检查后进入待核定状态，不写 candidate_step_results 的第7行。
5. `approve` 校验 event_review 权限、运行摘要和当前完整目录；以事务内目录写锁串行核定。NEW 建立 Target，REUSE 复用有效 ID；并发目录变化使旧建议失效，必须重新比较。
6. 后续关系只使用本次全部已核定 Target。多个 Object 指向一个 Target 时，保留逐对象记录，下游按 Target ID 去重。最终 Event 提交再次检查批准、权限、资料和定义版本，并保存定义快照。

普通对象均执行 AI。当前没有可靠外部标识映射服务，不虚构确定性跳过规则。AI 的 NEW/REUSE 仅为建议，人工核定不可省略；UNRESOLVED 应补证重跑，不能点击批准绕过。旧批准人撤权后由当前授权人员重新核定，已创建Target保留原ID；批准依据改变时废弃受影响关系上下文并重新准备。工作流有界循环提高到200次，覆盖50对象及逐对象重试，超限显式进入恢复状态。

## 4. 存储与迁移

新增迁移 `src/db/007-target-identity.sql`，由 `applyTargetIdentityMigration` 以事务及迁移锁执行；schema5 初始化/升级路径已接入。表字段、索引及关系的集中定义见[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计#3.3.10 AI-07 实施存储与兼容边界|F02 AI-07 实施存储]]。

不猜测迁移旧 definition_sets 中缺分类、范围的定义。新版读取主表并使用已核定 ID，旧包仍读取旧集合。历史引用尚未逐项迁入，所以本次不全局建立 event_target.target_id 到 target.id 的外键；新版由运行及提交校验维护关联一致性。

## 5. 操作入口

写操作沿用现有登录会话及 `idempotency-key`，不增加绕过鉴权的入口。

| 方法与路径 | 用途与请求 |
| --- | --- |
| GET /api/v1/l0/candidates/:id/targets | 查看当前对象集、逐对象运行与 review_digest；需 read 及资料访问权限 |
| POST /api/v1/l0/candidates/:id/targets/objects | `{generation, objects:{objects:[TargetObject], explicit_no_objects:false, reason}}`；需 event_review |
| POST /api/v1/l0/candidates/:id/targets/approve | `{run_id, review_digest, reason}`；需 event_review；未决和旧依据拒绝 |
| POST /api/v1/l0/candidates/:id/retry | 既有恢复接口；`{resume_token, reason, open_budget}`，重开预算还需 model_budget |

generation 为当前候选 proposal_generation，不是 execution_generation。明确无对象提交空 objects 与 explicit_no_objects=true。修改对象时须更换幂等键；已进入后续分析时按候选重新准备流程处理，不能静默覆盖旧关系。接口返回的错误码应保留用于恢复，不将失败状态转换为无对象。

当前没有 Target 定义编辑界面，也没有自动将旧 target_clues 补全为规范 Object；需授权人员核对原文后使用上述接口。正式服务发布与运行库升级须采用增量迁移，禁止用重建业务库代替部署。
