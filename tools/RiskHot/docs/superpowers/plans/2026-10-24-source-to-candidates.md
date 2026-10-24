# Source to Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 从 src/data 中的中国人民银行信源获取真实公告，保存标准化资料与 AI-01 候选，并提供可恢复的阶段查询。

**Architecture:** 沿用 TypeScript/Fastify、PostgreSQL、Temporal 和不可变工件存储。API 持久受理后由中继启动流程，IO 与模型活动分进程；候选抽取与完整事件处理分开计数。

**Tech Stack:** Node.js 22、TypeScript、Fastify 5、pg、Temporal TypeScript SDK、Ajv2020、Cheerio、jose、node:test。

**Spec:** [[tools/RiskHot/docs/superpowers/specs/2026-10-24-source-to-candidates-design|已批准实施设计]]。

## Global Constraints

- 用户已于2026-10-24确认“先接中国人民银行公告，完成 AI-01 候选抽取、持久化和 API/命令式状态监测”。模型服务及模型名等待补充。
- 只导入 source-catalog.js 的参考元数据，不将 source-demo.js 的演示状态用于业务准入。
- 资料正文≤20,000码点、原件≤1MiB、候选≤50；超限明确拒绝，不截断。
- 固定版本证据使用码点区间；模型故障不能计为0候选。
- 初始模型预算最多3次、10分钟；授权追加窗口保留累计次数并推进代次。
- 不自动导入旧.data，不修改其他会话中的原型；所有服务仅绑定回环地址。

## Review Focus

- 站点返回200但正文区域为空或是登录页：不得进入模型。
- Unicode非BMP字符与表格中的零值：引用区间和数值必须保留。
- 重复请求与模型迟到响应：不得新增资料版本或候选集合。
- 进程在工件发布和数据库提交之间停止：恢复仍能读取固定输入。
- OIDC未授权身份、源停用或模型缺配置：必须区分拒绝、待配置和成功。

---

### Task 1: Source acquisition, normalization and evidence

**Files:** `package.json`、`tsconfig.json`、`src/m1/catalog.ts`、`src/l0/pbc.ts`、`src/l0/extraction.ts`、`src/platform/types.ts`、`tests/content.test.ts`。

**Interfaces:** `readCatalog(path): CatalogEntry[]`；`discoverPbc(html, baseUrl, limit): SourceItem[]`；`parsePbc(raw, url): NormalizedMaterial`；`validateExtraction(response, material): ExtractionResult`。NormalizedMaterial含标题、发布时间文本、正文段落、raw定位及normalizer版本；候选证据含segment_id/start_cp/end_cp/quote。

- [x] 写测试：40条清单读取、非执行式JSON解包、同域详情发现、数字0/表格/emoji保留、正文缺失拒绝、伪引文/错区间/超限拒绝、完整空数组与不完整响应分流。
- [x] 运行 `npm test -- tests/content.test.ts`，观察缺实现失败。
- [x] 实现上述接口，解析仅取已实测的#zoom，标题/日期读取实际meta。
- [x] 运行同一测试及类型检查，预期全部通过。
- [x] 记录结果并提交本任务明确拥有的文件。

### Task 2: Durable commands, artifacts and idempotent storage

**Files:** `src/platform/artifacts.ts`、`src/platform/db.ts`、`src/l0/repository.ts`、`db/001-init.sql`、`tests/storage.test.ts`、`compose.yaml`、`.env.example`、`scripts/init-env.ts`、`scripts/setup.ts`。

**Interfaces:** `ArtifactStore.put(bytes, kind): ArtifactRef`、`read(ref): Buffer`；`Repository.submit(command, actor, key): Operation`、`acquire/normalize/save/acceptSet`按操作身份及代次条件写入；`getOperation(id)`返回数据库派生状态。

- [x] 写真实文件/PG测试：同摘要不可覆盖、工件损坏报错；同键同体复用/异体冲突；并发同源同版保存一次；完整集合只接纳一次；故障保留未知计数。
- [x] 运行对应测试，观察缺实现失败。
- [x] 实现参数化事务、不可变工件、来源/资料/处理/候选/尝试/窗口/意图/消息及审计表，配置独立PG持久卷；生成本地随机凭据，不打印值。
- [x] 启动隔离数据库，执行迁移与信源初始化，运行测试；预期业务记录不重复。
- [x] 记录结果并提交本任务明确拥有的文件。

### Task 3: Persistent workflows and model execution

**Files:** `src/runtime/workflows.ts`、`src/runtime/activities.ts`、`src/runtime/worker.ts`、`src/runtime/relay.ts`、`src/l0/model.ts`、`tests/pipeline.test.ts`。

**Interfaces:** `SourceFetchWorkflow(operationId,generation)`发现并持久固定条目；`MaterialIngestionWorkflow`推进F01；`EventExtractionWorkflow`准备/调用/验证/固定集合；`ModelClient.execute(input): ModelResponse`由实际服务适配；Relay持久租约领取意图与消息。

- [x] 写集成测试：重启从检查点续接、Outbox/Inbox重复、模型超时/截断/无效JSON不固定集合、预算耗尽、授权窗口与迟到响应拒绝。
- [x] 运行测试观察缺实现失败。
- [x] 实现持久流程与Activity隔离，模型调用120秒超时、每窗口3次/10分钟、30秒/120秒退避；缺模型配置记待配置，不调用替身冒充真实模型。
- [x] 用真实PG/Temporal及受控模型服务器运行集成测试；预期故障可见，集合只提交一次。
- [x] 记录结果并提交本任务明确拥有的文件。

### Task 4: Authorization, API and time-batch monitoring

**Files:** `src/platform/auth.ts`、`src/runtime/server.ts`、`scripts/setup-identity.ts`、`scripts/run.ts`、`tests/api.test.ts`。

**Interfaces:** 授权身份来自OIDC令牌或服务端会话；来源GET/PATCH、POST `/api/v1/l0/source-fetches`、GET `/api/v1/l0/operations/:id`、GET `/api/v1/l0/runs`、资料/候选/证据查询及授权retry。写请求要求Idempotency-Key，run查询用from/to/status。

- [x] 写API测试：无身份401、无权限403、停用信源拒绝、同键异体409、超限413、日期筛选与跨来源批次身份、原文查询权限。
- [x] 运行测试观察缺实现失败。
- [x] 实现专用测试身份域、显式操作员授权、严格Ajv校验、阶段查询与5秒轮询命令；敏感值不进入日志。
- [x] 用真实身份域及数据库运行测试，预期隔离权限与状态均正确。
- [x] 记录结果并提交本任务明确拥有的文件。

### Task 5: Real run, recovery evidence and delivery

**Files:** `scripts/dev.ts`、`README.md`、`docs/verification/source-candidates.md`、相关T01/T02/T03/T04/T05/F01/F02契约增补、`index.md`、`log.md`。

**Interfaces:** `npm run dev`启动独立进程；`npm run run:real`提交PBC获取并轮询；真实模型配置由环境注入。

- [x] 运行 `npm test`、`npm run typecheck` 和真实数据库/Temporal集成测试，检查全部结果。
- [x] 获取真实PBC公告并检查原件、正文表格和定位；重复提交与重启后同版复用。
- [ ] 模型配置到位后调用真实服务，逐候选人工核对，记录实际结果和限制（等待模型服务/模型名/端点及私有环境配置）。
- [x] 执行进程重启、重复提交及预算恢复实验；不把已完成抽取当作完整事件提交。
- [x] 更新启动说明、架构契约增补、索引、日志与执行证据；20份Markdown表格、54处新增Wiki链接、UTF-8和差异检查通过。
- [x] 发起一次独立整体代码审阅，修复重要问题并运行完整测试，报告仍待输入或未通过项。

## Execution ruling

用户已明确确认“按此设计实施”，据此在本会话直接执行，不重复请求实施授权。采用Native执行，最终安排一次独立整体审阅；关键配置缺失只阻断依赖该配置的真实验收。工作在独立分支，提交只包含本次拥有的文件，不合并或推送。

2026-10-24：Task 1～4 已完成并提交；Task 5 工程测试21/21及真实信源重复运行通过，整体审查6项重要修复已验证。Task 5保持未完成，唯一必需剩余输入为真实模型配置及相应真实调用/人工核对验收，详见[[tools/RiskHot/docs/verification/source-candidates|执行验证记录]]。
