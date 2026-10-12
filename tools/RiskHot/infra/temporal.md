# Temporal 开发运行与边界

本文件对应实际可运行的开发环境。`start-dev` 使用本地 SQLite 保存执行历史，不代表生产高可用或已部署生产 Temporal。

## 启动

先按项目说明启动 PostgreSQL 并执行迁移，再分别运行：

```bash
pnpm exec tsx tooling/temporal-dev.ts
pnpm exec tsx apps/worker/src/main.ts
pnpm exec tsx apps/outbox-relay/src/main.ts
```

服务监听 `127.0.0.1:7233`，开发 UI 为 `http://127.0.0.1:8233`。CLI 首次由已安装的 Temporal SDK 下载到 `.data/bin`；数据库保存在 `.data/temporal/temporal.sqlite`。可通过 `TEMPORAL_CLI_PATH` 使用已安装的官方 CLI。不使用全局安装，不修改其他容器。

`TEMPORAL_ADDRESS`、`TEMPORAL_NAMESPACE`、`TEMPORAL_TASK_QUEUE` 可以隔离部署。生产 TLS、身份认证、区域冗余、备份恢复和容量尚未部署，不能直接将本地监听暴露到公网。

## 实际执行语义

- `task.start` 使用任务 UUID 与业务重试次数构成稳定 Workflow ID。PG 的 `workflow_dispatch` 与 claims 是长期启动账本，Temporal 设置拒绝复用已完成身份。
- Outbox 使用短事务领取租约，网络调用在事务外；确认按领取次数 CAS。已开始但超过一天仍无法确认历史的启动进入人工对账，不能盲目重启。
- `task.retry` 对应显式递增的 attempt；旧开始事件不能触发新尝试。任务模型配置已固定，运行环境改变时要求显式重算。
- `manual` 任务进入 `awaiting_input`，Workflow 持久等待，不填入假模型答案。真实模型建议保存到 `task.data.proposal` 并进入 `awaiting_review`，不直接修改正式风险或批准结果。
- 正式业务由 API 的领域命令完成；`task.completed` 只唤醒等待。`analysis.approved` 再次核对批准快照和任务代次。取消通过 PG 行锁、代次和 `commit_eligible` 阻止迟到结果提交。
- Relay 只领取 `task.start/task.retry/task.cancel/task.completed/analysis.approved/schedule.changed`。其余领域事件保留给相应消费者，不静默标记已交付。

## 计划

`schedule.changed` 同步真实 Temporal Schedule，时区、间隔、首次时间、暂停状态可追踪，采用 `SKIP` 重叠策略及一分钟补触发窗口。每次执行按计划窗口在 PG 去重，并核对最新启用状态与计划版本。

计划统一调用应用命令总线，并在同一数据库事务里校验发起人当前权限、计划任务代次和提交资格：分析计划执行 `analysis.start` 受理子研究任务；报告计划执行 `publication.generate` 生成草稿，绝不调用批准/发布；采集计划有合法 `source_id/url/content/published_at` 时执行 `information.ingest`，缺少原文及抓取适配器时进入 `awaiting_input`。不支持的输入或失效权限会真实失败，Schedule 按策略暂停。

报告计划输入可提供固定周期，也可以只给 `type: daily/weekly/monthly` 与 `scope`，系统根据计划时区选择上一个完整自然日/周/月。对无法确定的时区边界明确报错，不猜测时间。分析计划省略 `snapshot_time` 时使用本次固定触发时间。计划拥有者必须仍具有所调用业务命令要求的角色。

## 发布版本

开发默认不启用 Worker Deployment Versioning。生产或预发布可同时设置 `TEMPORAL_DEPLOYMENT_NAME`、`WORKER_BUILD_ID`，Worker 将使用新式 Deployment Versioning 与 `PINNED`。还必须在 Temporal 控制面设置当前/灰度版本并保留旧 Worker；本仓库不自动提升部署版本。不要使用旧 `buildId/useVersioning` API 冒充新版本治理。

## 真实集成烟测

```bash
pnpm exec tsx apps/worker/test/smoke.ts
```

该脚本连接已启动的真实 Temporal，创建独立临时 PostgreSQL 数据库及任务队列，测试人工等待、重复启动、Worker 重启、取消门禁、结构化建议、重复完成信号、批准对账和真实计划生成草稿。模型分支使用明确标识的注入测试适配器，不调用付费模型；成功不代表真实供应商模型已验证。临时数据库和测试 Schedule 在结束时清理。
