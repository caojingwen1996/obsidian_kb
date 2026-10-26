# M1 信源与接入任务管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户指定的 M1 交互原型接入 `main` 已实现的真实来源、接入、抽取与计划服务。

**Architecture:** 沿用 Fastify、PostgreSQL、Temporal 和既有授权/幂等机制。新增管理接口，页面与 API 同源；任务批次容纳多个信源，原接入操作与固定工件继续复用。页面以原型为视觉和交互依据，查询服务端事实，不能导入演示状态。

**Tech Stack:** TypeScript、现有 Fastify/PostgreSQL/Temporal；浏览器页面沿用原型 HTML/CSS 的组件语言。

**Spec:** [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/02. 交互原型说明|M1 原型说明]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/EXPERIENCE|M1 交互契约]]与 [[tools/RiskHot/docs/system-design/04-系统架构设计/04-公共技术契约/来源候选切片实现契约|已实现接口契约]]。本次用户指令授权按已有原型实现，不重新设计视觉或业务规则。

## Global Constraints

- 工作位置：用户已明确要求全部合并到 main；按 main 最新目录整理并保留既有原型和共享数据调整。
- 信源启停、计划启停、运行暂停分别保存；刷新页面和服务重启不能丢失。
- 使用真实 OIDC 会话、同源校验、权限及来源范围；所有变更使用幂等键和预期版本。
- 不改变现有连接器可信网络范围；新增信源默认停用、未配置连接器，不能假装自动就绪。
- 暂停/继续保留原始计划时间、已保存资料及错误结果；旧执行不能继续提交新阶段结果。
- 查询区分接入、资料保存、模型抽取与正式事件；候选仍为 pending。
- 不读取或展示私有环境值；浏览器验证使用独立 Chrome for Testing 及临时目录。
- 不发起额外真实采集或模型调用作为测试；隔离数据库与受控输入验证实际控制链路。

## Review Focus

- 多信源批次部分就绪、部分失败时按批次统计，异常去重且保存数只计确认结果。
- 重复点击、超时后重投、并发版本变化不得产生重复运行或覆盖新状态。
- 暂停与在途响应竞争时保留固定工件，旧代次不能推动后续阶段。
- 来源受限用户不能通过批次聚合、历史或运行接口读取/修改其他来源。
- 登录过期、服务失败和未知提交保留用户输入，不显示模拟成功或错误的零计数。

## Task 1: 持久管理与 API

**Files:** `src/information-ingestion/sources/management.ts`、`src/runtime/server.ts`、`src/runtime/scheduler.ts`、`src/information-ingestion/processing/repository.ts`、`src/information-ingestion/processing/execution.ts`、`src/platform/grants.ts`、`src/db/001-init.sql`、`src/tests/management.test.ts`。

**Interfaces:**
- `GET /api/v1/session` 返回 `{actor,permissions,source_keys}`。
- `GET /api/v1/m1/sources` 继续返回真实档案；新增/修订/历史接口复用来源版本。
- `POST /api/v1/m1/sources` 创建默认停用档案；`PUT /api/v1/m1/sources/:key` 提交 `{expected_version,profile}`；`GET /api/v1/m1/sources/:key/history` 返回版本和审计。
- `GET /api/v1/l0/task-batches?from&to&status&q` 返回 `{items,metrics,total,limit,timezone}`，批次行含 `{id,scheduled_at,status,sources,saved_count,version}`；信源项含 `{source_key,operation_id,status,stage,reason_code,saved_count,children}`。
- `POST /api/v1/l0/task-batches` 输入 `{source_keys,limit}`，返回已持久受理批次。
- `POST /api/v1/l0/task-batches/:id/control` 输入 `{action:'pause'|'resume',expected_version,reason}`，返回当前批次。
- `PATCH /api/v1/l0/schedules/:key` 输入 `{enabled,interval_seconds,expected_updated_at}`；`GET /api/v1/l0/monitor` 沿用真实计划和告警。

- [x] 先写隔离数据库/真实 API 测试：多来源开启、读写权限、幂等、启停隔离、版本冲突、暂停迟到响应与恢复检查点。
- [x] 执行 `node --env-file=.env --import tsx --test src/tests/management.test.ts`，确认因功能缺失而失败。
- [x] 实现管理接口、事务和恢复，兼容已有运行和计划；以来源固定版本与已有命令回执为事实。
- [x] 执行专项测试与 `npm run typecheck`。

## Task 2: 实际 M1 工作区

**Files:** `src/web/index.html`、`src/web/app.js`、`src/web/styles.css`、`src/web/api.js`、`src/web/model.js`、`src/runtime/web.ts`、`src/tests/web.test.js`。

**Interfaces:** 只消费 Task 1 定义的公开接口及已有 operation/processing/version/retry 接口。`registerWeb(app)` 提供 `/m1` 和固定白名单静态资源；`/` 导向 M1。页面不包含凭据和演示角色。

- [ ] 先写模型/请求层测试：日期与批次汇总、状态映射、错误与幂等键复用，不以源码字符串充当测试。
- [ ] 执行 `node --import tsx --test src/tests/web.test.js` 验证失败。
- [ ] 实现目录搜索、多维筛选、分组视图、详情、表单、版本记录、信源启停；复用原型视觉。
- [ ] 实现任务日期/状态/编号查询、概览、真实详情六步、开启多信源批次、暂停/继续、计划管理及错误恢复。
- [ ] 验证键盘焦点、登录状态、响应未知与窄屏布局；功能测试与浏览器截图一并检查。

## Task 3: 集成验证、审阅与交付

**Files:** `README.md`、`docs/verification/m1-management.md`、`index.md`、项目和知识库 `log.md`。

- [ ] 执行 `npm run typecheck`、`npm test`；记录数量及失败原因。
- [ ] 独立浏览器运行实际页面与受控服务端 API，验证 1440/390/320 宽度、目录操作、开启、暂停、刷新后继续与权限错误。
- [ ] 运行 Impeccable audit，集中修复本轮可见问题；最多两轮视觉检查。
- [ ] 独立代码审阅检查上述 Review Focus，修复影响正确性的问题并重跑相关测试。
- [ ] 更新启动入口、操作说明、实现边界、验证证据及两级日志，运行 Markdown 表格、UTF-8 和差异空白检查。

## 执行记录

- Pre-flight：Task 1 产出 API 字段、Task 2 消费同一字段；后端 agent 只改服务端/数据库/专项测试，主 agent 只改网页/静态路由/网页测试与文档。共享 server.ts 由后端 agent 挂载其接口，主 agent 最后顺序接入静态页面，避免同时编辑。
- 技术决定：本轮使用原型同源 HTML/CSS/模块脚本直连现有 Fastify，避免为已存在原型再增加构建和部署服务；与 ADR 的长期 React/Vite 方向有差异，仅涉及此管理页面交付，不改变后端契约或后续组件化路径。
