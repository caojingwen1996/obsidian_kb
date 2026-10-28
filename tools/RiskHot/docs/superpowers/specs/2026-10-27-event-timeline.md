---
title: 事件列表时间线
type: feature
created: 2026-10-27
status: done
route: dispatch
baseline_commit: ed36a39665471d6afb8647f67de39ce7135f8eb3
review_loop_iteration: 0
context:
  - docs/superpowers/plans/2026-10-27-事件列表时间线重构.md
---

<frozen-after-approval reason="用户已要求按计划实施">

## Intent

将正式事件列表改为参考图的日期分组时间线，每条展示信源、标题、完整description和阶段，点击标题进入详情。用户已经批准执行上下文计划，未授权提交、推送或变更真实业务数据。

## Boundaries & Constraints

- 展示时间：原文发布至系统首次收录的延迟在0～72小时（含）时用首次收录时间，超过72小时用原文发布时间，倒序且先全局排序后分页。不使用当前时间或Event建档时间替代。发生时间event_time不变。
- 采用计划中多来源与异常时间建议：最早成功收录且确有本事件证据的原文版本为依据，同篇C/P成对；低精度通过范围判断，跨阈值/无效/缺失发布时间回退首次收录并说明原因；无收录证据可用原文时间；两项皆无明确归组。
- 多信源按ID去重，来源聚合不得重复事件或泄露越权来源。保留现有整事件权限规则及cursor偏移分页。
- 日期标题、窄时间列/节点/细线、白卡片。复用现有绿色、字体、焦点和按钮规范。完整description自然换行，不生成推荐理由或新摘要。
- 保留详情返回入口；从列表进入详情后恢复分页、锚点、展开。刷新无变化不重建，刷新失败保留已读取列表。
- 当前工作区已有大量用户授权的未提交修改，必须保留；不调用Superpowers。主设计为Impeccable，已在父会话读取，UI编辑前读取其craft-floor。

## I/O & Edge-Case Matrix

| 场景 | 输入 | 预期 |
| --- | --- | --- |
| 阈值 | 0、72h−1ms、72h、72h+1ms | 前三取收录，最后取发布 |
| 迟到新闻 | 旧发布时间、新收录 | 归于旧发布日期，重复抓取不置顶 |
| 精度异常 | 日/月/年、空值、负延迟、非法日历 | 不补造时刻，范围判定或明确降级 |
| 多来源 | 多Fact、同名不同ID、版本修订 | C/P同版本依据、来源去重、事件唯一 |
| 权限分页 | 部分来源无权、超过20条 | 权限一致、全局排序后分页 |
| 浏览状态 | 第二页详情返回、来源展开、刷新失败 | 恢复阅读状态，失败保留列表 |

</frozen-after-approval>

## Code Map

- src/event-management/queries.ts：list当前按updated_at排序，详情权限规则可复用。
- src/db/002-information-handoff.sql、src/information-ingestion/processing/repository.ts：material_version_origins.collected_at绑定acquisitions.acquired_at，重复版本不覆写。
- src/event-management/snapshot.ts、src/db/004-facts.sql：event_fact、fact_information、fact_evidence关联及约束。
- src/web/events.js、styles.css：列表渲染、5秒轮询、详情返回；保留旧链接兼容。
- src/tests/event-fixture.ts、fixture.ts：独立数据库fixture及合法正式事件保存辅助。
- src/tests/events.e2e.ts、events-real.e2e.ts：隔离及真实页面验证，测试浏览器必须Chrome for Testing/Chromium，finally关闭清理。

## Tasks & Acceptance

- [x] 修改前为本轮可能变更文件保存当前副本至.riskhot/event-timeline/baseline，含清单；本轮diff与副本比较，避免把既有改动当作本轮成果。
- [x] 新增src/event-management/timeline.ts（如需）并修改queries.ts，实现展示时间、批量来源读取、全局排序后分页。优先无迁移实现；不得逐事件读原文工件。记录规模边界。
- [x] 修改events.js、styles.css实现时间线、日期/来源折叠、时间说明、分页返回、焦点锚点及刷新失败保留。无需外壳变更时保留events.html。
- [x] 增补event-timeline.test.ts、event-ui.test.js、event-api.test.ts及浏览器测试，覆盖上表；使用隔离数据库构造多日、多来源与分页，真实库仅只读。
- [x] 同步F02功能设计的展示规则、F02实际页面设计及相关查询契约（选择现有合适文档，不做无关重构）；更新批准计划状态。新增docs/verification/event-timeline.md并登记index.md、log.md。
- [x] 页面专项、查询/API专项、npm run typecheck通过，再执行必要回归与隔离/真实浏览器验证。不得用已有旧测试结果替代。文档运行../../rules/check_markdown_tables.py并检查UTF-8。
- [x] Impeccable设计扫描一次；1440/390/320截图批量检查、必要修正后至多再确认一次。报告实际结果和未覆盖项。

验收：给定不同时间/来源/权限事件，当打开列表，则得到72小时规则决定的全局倒序、去重日期组及真实来源内容；给定第二页阅读状态，当进入详情并返回，则恢复原页和锚点；给定读取失败，当刷新，则保留原列表并提供重试。

## Implementation Notes

已按计划实施，基线差异及三层审查完成。14条审查记录逐项核验并以小幅修正和反例测试关闭，无遗留阻断项。最终215项完整回归、类型检查、18组隔离浏览器及真实三宽/返回只读复验通过；原截图和设计扫描保留。没有提交或推送。

参考图路径：/var/folders/hh/5jrmgmsx377fsl_56cz7q13w0000gn/T/codex-clipboard-3b2c7d90-798e-45a2-99ea-b6b45f51c380.png。

浏览器运行库：/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs。独立浏览器位置由私有环境SOURCE_BROWSER_EXECUTABLE提供，只读取所需配置，不输出凭据。

## Spec Change Log

## Review Triage Log

| 编号 | 判定 | 依据与处理 |
| --- | --- | --- |
| B1 | high / patch | 刷新401/403走retained分支仍保留受限内容，区别临时故障并清空；补浏览器反例。 |
| B2 | medium / patch | state在事件查询await前捕获，慢请求会覆盖请求中发生的滚动与折叠；移至替换DOM前。 |
| B3 | medium / patch | 全部日期折叠后无事件锚点，restore退到标题，已保存scroll未使用；增加无卡片时的滚动恢复。 |
| B4 | medium / patch | capture只记录标题焦点，summary聚焦时数据变化会失焦；补稳定展开控件焦点标识。 |
| B5 | low / patch | day分支未生成星期，日期分组显示不一致；直接按已知日期计算星期，不补时刻。 |
| B6 | medium / patch | 采集来源的两个独立外键未在列表查询核对operation_id一致；补相等条件和不一致降级反例。 |
| B7 | medium / patch | 缺失origin/工件或时间不一致只在计算函数降级，SQL来源链缺接口反例；补接口验证。 |
| B8 | low / patch | 三个以上信源、并列及重复关联排序缺覆盖，现实现经排序后Map首次插入序可保留最早次序；补行为用例。 |
| B9 | low / patch | 文档复杂度未计每事件证据排序及分页来源排序；准确记录成本与规模边界。 |
| B10 | low / patch | 计划状态已完成但实施建议/拟新增措辞未全部收敛；明确最终采用规则和已生成证据。 |
| E1 | medium / patch | 详情读取失败后renderedRoute仍指旧列表，重试saveList会把错误DOM覆盖阅读快照；仅保存真实已渲染内容。 |
| E2 | medium / patch | 与B2同一慢请求状态根因，保留本条审查记录并合并修复。 |
| V1 | medium / patch | 接口测试未区分同篇早期无事件证据版本；补仅后版有事件证据的SQL版本隔离断言。 |
| V2 | medium / patch | 分层排序只验证rank函数，未执行混合精度接口分页；补完整日期、较新月/年及未知的实际顺序。 |

## Verification

- `npm test`：215/215，0失败0跳过，133.2秒；本机输出 `.riskhot/event-timeline/final-regression.log`。
- `npm run typecheck`：通过；新分页API测试的TS7022以显式响应及分页结构类型修正。
- 页面/时间17项、API7项均包含在完整回归中；隔离浏览器18组通过。
- 最终真实只读验证：1440/390/320无横向溢出，真实信源与描述正确，详情返回通过，页面错误为0；本机记录 `.riskhot/event-timeline/final-real-smoke.json`。
- 本轮文档表格、UTF-8、双链目标及差异检查通过。

运行命令和证据写入验证报告；真实页面服务为http://localhost:18081，静态资源每次读取无需重启，API修改需通过项目既有service命令重启或使用独立临时server验证，不能自行修改私有配置。
