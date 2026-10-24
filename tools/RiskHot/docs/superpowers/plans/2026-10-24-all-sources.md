# All Sources Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; continue the existing isolated worktree.

**Goal:** 将来源清单全部纳入可执行连接器或带明确原因的待接入状态，逐源保存真实内容与运行证据。

**Architecture:** 来源配置注册表、HTML/RSS/JSON 格式适配器，复用现有 F01→AI-01 持久管线。配置随来源版本冻结；来源状态与一次运行结果分别返回。

**Tech Stack:** 现有 Node22/TypeScript/Cheerio/Fastify/PG/Temporal/node:test，无新依赖。

**Spec:** [[tools/RiskHot/docs/superpowers/specs/2026-10-24-all-sources-design|全部信源扩展设计]]。

## Global Constraints

- 不删除/覆盖历史原件；原件1MiB、正文20,000码点、每源1～5条。
- 只采集实测正文或明确日期化数据范围；缺地址/登录/反爬单独记录，不假报成功。
- 逐源URL白名单、每跳重定向检查；专用浏览器隔离不变。
- 模型配置缺失不阻断资料接入，抽取保持waiting_config。

## Review Focus

- 编码、合并表头、统计日期与0值被改变。
- RSS摘要或首页导航被误当全文。
- 不同来源URL越权、重定向到未授权主机或参数。
- 初始化重开人工停用来源或旧操作读新配置。
- 批量单源失败遮蔽其他来源结果，或待接入状态被统计为成功。

### Task 1: Connector contracts and format adapters

Files: `src/m1/connectors.ts`、`src/l0/source-html.ts`、`src/l0/sources.ts`、`tests/sources.test.ts`。

Interfaces: `SourceConnector` describes immutable discovery/parse/url rules; `assertSourceUrl` validates resource URLs; `discoverSource` yields fixed items; `parseSource` yields existing NormalizedMaterial; `fetchSource` returns bounded bytes.

- [x] Write failing tests for real-format HTML/RSS/JSON, zero/encoding/evidence, login and empty data, URL and redirect guards.
- [x] Run `npm test -- tests/sources.test.ts`, observe missing implementation failures, implement adapters and verified per-source profiles.
- [x] Run targeted tests and typecheck; commit this unit.

### Task 2: Versioned source execution and operational commands

Files: `src/l0/repository.ts`、`src/runtime/activities.ts`、`src/runtime/server.ts`、`scripts/run.ts`、new `scripts/run-sources.ts`、`package.json`、`tests/source-execution.test.ts`。

Interfaces: frozen source-version connector consumed by repository and activities; source query returns readiness and last operation; CLI selects source or invokes all independently.

- [x] Write failing PG/API tests for multiple source execution, legacy PBC, blocked source error, frozen configuration, safe seed/activation and identity separation.
- [x] Run tests RED, replace hardcoded PBC routing with registered/frozen connector selection and implement batch runner.
- [x] Run complete tests and typecheck; commit this unit.

### Task 3: Real per-source acceptance and delivery

Files: `docs/verification/all-sources.md`、README、implementation contract、index/log at project and vault.

- [x] Run actual source ingestion for each configured source, record fixed version/segments/status; record concrete blockers for every other source.
- [x] Independent whole-change review, one consolidated fix pass if needed; rerun relevant/full tests for code fixes.
- [x] Run Markdown tables, added links/encoding, diff checks; commit delivery. Keep incomplete source requirements explicit for resume.

## Execution ruling

用户的继续实施要求扩展了已批准管线的来源覆盖；沿用此前 Native 执行及独立工作树，不重复请求管线实施许可。缺失 URL 的提问仅影响对应来源，其他核验与实现持续进行。注册表的最终范围以真实内容证据为准。

工程与逐源核验已交付：26条真实入库，6条待补地址、8条访问/登录受阻；41/41测试及类型检查通过。受阻14条没有实际接通，真实模型验收也未完成，详见[[tools/RiskHot/docs/verification/all-sources|逐源验证记录]]。保留工作树用于续接。
