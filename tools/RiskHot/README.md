# RiskHot

前后端分离的宏观风险研究工作区。当前开发版将原文、事件增量、风险候选、纳管、观察分析、人工审核、周期报告和运行管理连成一条可执行流程。

这是一套可运行并有场景测试的开发实现。生产 OIDC、真实来源采集连接器、供应商模型语义评测、容量与灾备验收尚未完成；不把本地功能测试等同于全系统上线验收。

## 启动

环境：Node.js ≥ 22.12、pnpm 10、Docker / OrbStack。已锁定依赖版本；本机验证使用 Node 22.22.1、PostgreSQL 18.6。首次启动 Temporal 会下载官方本机 CLI，后续复用 `.data/bin`。

```bash
pnpm install --frozen-lockfile
pnpm infra:up
pnpm dev
```

打开 <http://127.0.0.1:4311>，创建首位管理员。没有共享账号或默认密码。`pnpm dev` 应用迁移并启动 API、Vite、Temporal Worker、Outbox Relay；Temporal 服务已启动时复用，否则启动持久化的本地开发服务。

- Web：`127.0.0.1:4311`
- API：`127.0.0.1:4310`，业务接口前缀 `/api/v1`
- PostgreSQL：`127.0.0.1:55432`，开发库 `riskhot`
- Temporal：`127.0.0.1:7233`；开发 UI `127.0.0.1:8233`

本机 Compose 配置的口令仅是隔离开发默认值。生产连接、TLS、身份提供者及凭据通过部署环境提供，不应直接对公网暴露开发服务。

创建管理员后，可选执行：

```bash
pnpm db:seed
```

此命令幂等加入带 `【演示】` 标记的虚构配置、原文、事件及一条未评估风险，不创建账号、不调用网络、不生成真实市场判断。

## 操作流程

1. 在配置中心维护并批准宏观观察对象、变量、风险源及风险类型；在信息与事件中登记并准入信源。
2. 录入原文及可核实发布时间，确认事件和增量。公告与实际实施分别记录，原文修改保留旧版本。
3. 保存完整风险候选，复核同一性后纳管。关闭再恢复沿用原风险 ID 和首次纳管时间。
4. 在风险详情发起观察，固定截止时间、风险定义、基准与证据包。未配置模型时，任务真实等待人工录入。
5. 在任务中录入研究草稿、载入本轮分析模板，完成八个分析阶段后提交。首次观察保留“变化待判断”。审核员核验后批准。
6. 生成周期报告草稿，复核固定快照引用，提交并发布。撤回后列表、直达、历史正文和导出均受服务端限制。
7. 在运行中心检查失败阶段、重试或重算、取消、运行计划及异常。退回与驳回同步推进领域状态，不能仅写一条审核日志。

## 模型接入

默认 `MODEL_PROVIDER=manual`，无需供应商凭据。按 `.env.example` 设置本机 `.env`，或由进程环境提供 `MODEL_PROVIDER`、`MODEL_ID`、`MODEL_API_KEY`。适配层包含 OpenAI Responses 与 Anthropic Messages 两种协议；实际模型 ID 必须由部署方指定，不假设未来模型已经存在或开放。

模型只能生成建议。API 校验角色、引用、固定输入和业务规则；批准与发布仍是显式人工命令。取消和撤权会关闭提交资格。测试中的模型适配器是明确标记的夹具，不能作为真实模型效果证明。

采集计划在没有已接通连接器或原文输入时进入待补充；现阶段主要入口是人工录入与结构化指标导入。报告计划只生成草稿，观察计划只受理子研究任务。

## 验证

```bash
pnpm generate
pnpm typecheck
pnpm verify:boundaries
pnpm report:scenarios
pnpm build
pnpm test:e2e
# 另一个终端先启动 pnpm dev:temporal，或已在运行 pnpm dev
pnpm test:temporal
```

- 数据库 / HTTP 场景：专用本机 `riskhot_test`，双重校验数据库名称后清理，不操作开发库。
- 浏览器：Playwright + 本机 Chrome，专用本机 `riskhot_e2e`，端口 4312 / 4313。配置字典是显式夹具，主业务链通过可见表单操作。
- Temporal：真实本机服务、真实 Worker 和 Relay、随机命名专用数据库；包含重复交付、重启、取消、批准事件及计划出刊。模型响应只使用注入测试适配器。
- `pnpm verify:all` 是日常契约、类型、边界、业务场景和构建检查；浏览器与 Temporal 独立执行。

[场景案例与真实执行结果](05-场景验证/RiskHot_场景验证测试案例_V1.0.md) · [综合验证报告](05-场景验证/RiskHot_测试执行报告_V1.0.md)

## 工程边界

```text
apps/web               React + Vite；只通过 HTTP 契约访问后端
apps/api               Fastify；Cookie 会话、CSRF、查询权限及导出
packages/application   跨领域命令编排、角色复核、幂等回执、审计
packages/domains       八个领域模块；不相互导入实现
packages/contracts     命令 JSON Schema 与生成的 OpenAPI
packages/generated     从契约生成的 TypeScript 类型与客户端
packages/platform      PostgreSQL、核心类型、模型协议、Workflow 契约
apps/worker            Temporal Workflow / Activity
apps/outbox-relay      PostgreSQL Outbox → Temporal 的可靠交接
```

[业务功能需求](03-业务功能需求/RiskHot_系统业务功能需求规格说明书_V1.0.md) · [系统架构设计](04-系统架构设计/RiskHot_系统架构设计_V1.0.md) · [当前实现与架构决策](04-系统架构设计/ADR-016-开发版落地与验收边界.md)
