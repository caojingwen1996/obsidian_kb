# 航天电子每日跟踪面板与盘中行情 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将头部静态 KPI 合并进每日跟踪面板，并为航天电子增加通过本地代理刷新的盘中实时行情位置。

**Architecture:** HTML 内嵌每日正式快照，离线始终可读；本地代理新增唯一允许的航天电子行情路由，页面在 HTTP 模式下每 60 秒刷新盘中卡。失败状态与每日值隔离。

**Tech Stack:** 静态 HTML/CSS/JavaScript、Python `ThreadingHTTPServer`、`unittest`、Node 大盘构建测试。

---

### Task 1: 固定股票行情代理契约

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/test_local_proxy.py`
- Modify: `tools/a-share-market-dashboard/scripts/local_proxy.py`

- [ ] 在 `RouteTests` 增加测试：`/api/stock-quote?secid=1.600879` 生成 `push2.eastmoney.com/api/qt/stock/get` 固定 URL，其他代码抛出 `RouteError`。
- [ ] 运行该测试并确认因路由不存在而失败。
- [ ] 最小实现白名单 URL 和标准化行情响应。
- [ ] 增加服务测试，验证价格、昨收、涨跌幅、时间以及非法代码 400。
- [ ] 运行代理测试并确认通过。

### Task 2: 合并头部 KPI 与每日面板

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs`
- Modify: `sources/automations/新兴产业/商业航天/2026-07-17-航天电子机构级决策研报.html`

- [ ] 增加构建测试：航天电子研报不得再含 `class="kpis"`，必须含 `daily-quote`、`intraday-quote`、`action-confidence` 和 `/api/stock-quote?secid=1.600879`。
- [ ] 运行测试并确认因旧头部 KPI 与缺失实时卡而失败。
- [ ] 删除头部 verdict/KPI，扩展每日面板为两行六卡。
- [ ] 增加盘中请求、字段校验、60 秒刷新和 `file://` 降级提示。
- [ ] 运行页面结构测试并确认通过。

### Task 3: 文档、日志与构建

**Files:**
- Modify: `tools/a-share-market-dashboard/README.md`
- Modify: `log.md`
- Generated/Modify: `tools/a-share-market-dashboard/a-share-market-dashboard.html`

- [ ] 记录盘中行情仅在大盘本地服务下启用，直接打开文件时使用每日值。
- [ ] 追加 2026-07-21 维护日志。
- [ ] 重新构建大盘并运行 Python、Node 全部测试。

### Task 4: 运行态与视觉验收

- [ ] 通过本地服务访问研报，确认股票行情接口 200 且盘中卡存在。
- [ ] 直接以 `file://` 渲染，确认显示每日快照和实时连接提示。
- [ ] 检查原 16 章、动态区标记、资金报告链接、UTF-8 和 `git diff --check`。

## 自检

- 已覆盖每日同步、盘中位置、面板合并、失败降级和完整验证。
- 无待定占位符或未定义接口。
