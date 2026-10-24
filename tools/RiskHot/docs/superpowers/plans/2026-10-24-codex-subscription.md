# Codex Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 订阅执行、持久定时接入、安静异常提醒及一次真实候选闭环。

**Architecture:** 在现有模型 Worker 增加 Codex 子进程适配；独立 scheduler 复用 Repository 命令与恢复契约。PostgreSQL 保存计划/提醒，macOS LaunchAgent 承载当前 supervisor。

**Tech Stack:** TypeScript、Node 22、PostgreSQL、Temporal、Codex CLI、macOS 原生通知。

**Spec:** [[tools/RiskHot/docs/superpowers/specs/2026-10-24-codex-subscription-design|订阅设计]]。

## Global Constraints

- 保留 EXTRACTION_ONLY、固定输入与集合证据校验；不自动绕过 review。
- 每小时最新 1 条、30 秒推进、最多 2 条在途；模型串行，3 次/10 分钟。
- 订阅子进程独立临时目录，只读、非交互、关闭工具；不接收业务密钥。
- 正常运行不通知，同一异常每次持续期只通知一次；恢复后再发生可通知。
- 自动预算恢复仅订阅临时故障、每 processing 每 24 小时最多 1 窗口，审计保留。

## Review Focus

- 子进程异常退出或有 completed 事件却没有唯一有效最终消息：拒绝接纳。
- 重启/并发/长任务跨计划时间：同一时刻不重复，不堆积补采。
- 额度/登录失效：停止新模型工作，保留资料与预算，不循环刷通知。
- 来源停用或权限撤销与恢复竞争：沿用执行时资格检查。
- 通知系统不可用或常驻程序退出：保留交付失败及可见状态。

### Task 1: Codex 订阅适配

**Files:** 新增 src/l0/codex.ts、tests/codex.test.ts；修改 model.ts、activities.ts、environment.ts、worker.ts、policy.ts。

**Interfaces:** CodexModelClient.execute(TaskInput, deadline) 返回现有 TransportResponse；modelConfig 支持 codex-exec；decodeModelResponse 接纳明确 codex 完成信封。

- [ ] 先写受控子进程测试：真实 spawn、stdin/schema、环境无数据库/API密钥、唯一消息、额度/登录/失败/超时；运行 `node --env-file-if-exists=.env --import tsx --test tests/codex.test.ts`，Expected: FAIL（功能未实现）。
- [ ] 实现最小适配与 Worker 集成，固定输入及调用许可保持有效。
- [ ] 同命令 Expected: PASS；`npm run typecheck` Expected: PASS；提交本任务。

### Task 2: 持久调度与异常提醒

**Files:** 新增 src/runtime/scheduler.ts、src/platform/notifications.ts、scripts/service.ts、scripts/monitor.ts、tests/scheduler.test.ts；修改 SQL/grants/setup/dev/server/environment、package.json、环境示例。

**Interfaces:** Scheduler.tick(now) 幂等推进计划/恢复/异常；通知适配接收安全固定文案；计划与异常可查询。消费 Task 1 的模型错误码及订阅就绪配置。

- [ ] 先写真实 PG 测试：并发同槽去重、重启恢复、停用跳过、在途上限、成功零提醒、持续异常去重/关闭/复发、通知失败、有限预算恢复；运行 `node --env-file-if-exists=.env --import tsx --test tests/scheduler.test.ts`，Expected: FAIL。
- [ ] 实现计划/运行/提醒表、限定权限和调度身份、调度进程/通知、状态 API/命令及当前工作树专属常驻安装/卸载。
- [ ] 同命令 Expected: PASS；`npm run typecheck` Expected: PASS；提交本任务。

### Task 3: 真实闭环与交付

**Files:** 新增 docs/verification/codex-subscription.md/json；修改 README、公共实现契约、索引/日志和本计划。

- [ ] 私有环境配置订阅协议和真实可用模型；启动更新后服务，先调度央行一次，检查模型响应、完成状态、候选、证据、固定工件和幂等复投。Expected: 真实完成，未知数不冒充 0。
- [ ] 启动每小时常驻计划，记录身份登录、下一计划和异常状态；正常完成无通知。Expected: 常驻就绪，可查询。
- [ ] `npm test`、`npm run typecheck`、本次 Markdown 表格/UTF-8/链接及 `git diff --check` Expected: 全通过。
- [ ] 一次整体独立审查，重要问题 RED→GREEN 修复并全量复验；更新真实证据、范围与遗留项，提交交付。
