# 正式事件列表时间线验证

> 2026-10-27 · 工程实现与本机验证完成；无提交、推送或真实业务数据写入。依据[[tools/RiskHot/docs/superpowers/specs/2026-10-27-event-timeline|批准规格]]与[[tools/RiskHot/docs/superpowers/plans/2026-10-27-事件列表时间线重构|上下文计划]]。

## 本轮结果与范围

正式事件列表已改为日期分组时间线，展示真实信源、标题、完整 description 与阶段，保留详情与证据阅读入口。服务端以同一证据原文版本的发布时间P与首次成功收录C计算展示时间；0～72小时（含）采用C，超过72小时采用P。整事件权限先行，全局排序后偏移分页；来源按ID去重，多Fact/修订不重复事件。

读者可展开日期、其他来源与时间说明；详情显式返回及浏览器后退恢复原分页、可见阅读锚点、焦点和展开项。相同内容刷新不重建DOM；数据更新恢复阅读状态；刷新失败保留内容，使用已有“刷新状态”重试。分页按钮定位新页顶部，区别于返回恢复。

本轮基线副本及清单在 `.riskhot/event-timeline/baseline/manifest.json`，记录已有文件指纹及新文件不存在状态。差异逐一与副本比较，未重置工作区已有改动。`events.html`、数据库迁移、业务发生时间及私有配置均未修改。实际代码位于 `src/`，历史原型未重构。

## 时间与版本口径

- 只取 EventFact → FactInformation → FactEvidence 实际关联的版本；从其成功收录记录读取C、同版本读取P，不向旧的无该事件证据版本借时间。多原文选最早成功收录者，同刻以资料/版本ID稳定裁定。
- 原始全文未用于逐事件工件读取；一次批量查询读取可见事件及时间依据，分页后才组装该页来源摘要。无N+1、无迁移。
- 完整时刻须带明确时区并通过日历校验；无时区不猜测。日/月/年保留精度，按上海日历范围计算，成功收录可把低精度范围上界收紧到C。全范围近期/迟到才分别采用C/P；跨阈值、非法值、缺失或完整未来时刻使用C并说明待核实。无C可用可解析P；两项皆无明确归组。
- 完整日期组在前；月/年在独立的不完整日期区域中按范围起点、原值及ID稳定倒序；未知时间最后。内部排序范围不对外伪装午夜，业务 `event_time` 不变。
- 来源依据信源在前，其余按最早关联时间与ID稳定排序；同名不同ID保留。任一关联来源无权则整事件排除，与详情一致。

权威字段及边界见[[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F02-事件管理/事件数据与状态设计#8.1 正式事件时间线查询契约|时间线查询契约]]；页面规则见[[tools/RiskHot/docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0#5.2 正式事件列表|F02 功能设计]]与[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/F02事件处理实际页面设计#现行正式事件时间线（2026-10-27）|实际页面设计]]。

## 执行命令与结果

以下命令在 RiskHot 根目录执行，仅测试命令加载既有环境，不打印凭据：

```sh
node --import tsx --test src/tests/event-ui.test.js src/tests/event-timeline.test.ts
node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/event-api.test.ts
npm run typecheck
npm test
```

| 检查 | 实际结果 |
| --- | --- |
| 页面与时间规则 | 最终17/17通过，覆盖阈值、日历/时区、混合精度、缺失、负延迟、证据版本配对、同名来源、转义与返回上下文 |
| 查询/API | 最终7/7通过；新增专项使用25条隔离事件验证全局分页、迟到旧闻、更新不置顶、多Fact/修订去重、同名不同ID与整事件权限 |
| TypeScript | `npm run typecheck`通过 |
| 必要回归 | 审查修正后 `npm test`215/215通过，0失败0跳过，约133.2秒 |
| 隔离浏览器 | 最终18组场景通过，0页面错误；原有详情与历史入口检查亦通过 |
| 真实页面 | 1条正式事件、1真实信源、first_collected；1440/390/320无横向溢出，0页面错误；所有请求只读 |
| 运行服务 | 按既有`npm run service -- restart`加载查询修改，最终GET返回200及派生字段 |
| 设计扫描 | Impeccable对本轮JS/CSS扫描0发现；见同目录扫描结果 |
| 文档 | 本轮全部Markdown表格与UTF-8检查通过 |

首次单位测试发现预期时间未规范化为ISO毫秒后缀，修正测试预期后通过。首次隔离API测试的临时信源键不在连接器允许目录内，改用既有目录键 `wiki-source-002`，所有改动仅发生于隔离fixture。首次浏览器追加数据后仍读旧DOM，测试改为等待刷新完成后断言。以上均已修复并重跑相应检查。

浏览器运行使用明确的独立 Chrome for Testing / Chromium 应用与临时任务目录，`finally` 关闭浏览器、测试服务并清理目录；不启动日常Chrome、不复用日常登录数据：

```sh
PLAYWRIGHT_MODULE=/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node --env-file-if-exists=.env --import tsx src/tests/events.e2e.ts
NODE_OPTIONS=--dns-result-order=ipv4first PLAYWRIGHT_MODULE=/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node --env-file-if-exists=.env --import tsx src/tests/events-real.e2e.ts
```

真实页面首次运行因 Node 将localhost解析为IPv6而连接`::1:18081`失败；现有服务监听IPv4。使用本次进程的 `NODE_OPTIONS=--dns-result-order=ipv4first` 后通过，未更改私有配置。无截图行为复验使用 `SKIP_SCREENSHOTS=true`，避免重复视觉检查。

## 关键验收覆盖

| 规格场景 | 证据与结果 |
| --- | --- |
| TL-01～04 多日、内容、多来源与上海归日 | 时间单测、页面渲染、隔离API及浏览器；日期组、真实来源、完整正文正确 |
| TL-05 / TL-13 异常精度及72小时±1ms | 7组时间规则测试含0、72h−1ms、72h、72h+1ms，边界按规格 |
| TL-06 全局分页 | 25条隔离事件，20+5；原有已保存事件加入浏览器后20+6；静态数据唯一且无遗漏 |
| TL-07 返回阅读状态 | 第二页非首项进入详情，显式返回及浏览器后退恢复原页、原可见事件偏移、展开与焦点 |
| TL-08 / TL-10 刷新与故障 | 相同内容DOM身份不变；数据更新保留阅读状态；503注入保留已读列表、重试恢复；日期折叠保持 |
| TL-09 权限 | 隔离API关联部分不可见信源，列表整事件排除，详情403，不返回其来源名称/数量 |
| TL-11 / TL-12 长内容与窄屏 | 特殊字符正确转义、长URL自然换行；三宽截图、焦点和44px展开控件检查通过 |
| TL-14～16 重复/修订与旧闻 | 依据版本C/P配对；同原文修订及多Fact不重置首次时间，普通更新时间不置顶；迟到旧闻位于旧日期 |

## Impeccable检查与截图

使用 Operate 模式，保留现有深绿、浅底、系统字体、按钮及焦点规范；按 craft floor 检查阅读层级、正文换行、原生展开、加载/空/失败状态与窄屏。一次修改目标扫描未报告确定性问题；视觉检查分批完成，真实页为确认批次。未运行屏幕阅读器或物理触屏测试，不将该结果声明为完整WCAG认证。

| 宽度 | 隔离多日/多来源 | 真实页面 |
| --- | --- | --- |
| 1440 | [[tools/RiskHot/docs/verification/event-timeline/controlled-1440.png\|受控桌面截图]] | [[tools/RiskHot/docs/verification/event-timeline/real-1440.png\|真实桌面截图]] |
| 390 | [[tools/RiskHot/docs/verification/event-timeline/controlled-390.png\|受控390截图]] | [[tools/RiskHot/docs/verification/event-timeline/real-390.png\|真实390截图]] |
| 320 | [[tools/RiskHot/docs/verification/event-timeline/controlled-320.png\|受控320截图]] | [[tools/RiskHot/docs/verification/event-timeline/real-320.png\|真实320截图]] |

机器结果：[[tools/RiskHot/docs/verification/event-timeline/controlled-result.json|隔离浏览器结果]]、[[tools/RiskHot/docs/verification/event-timeline/real-result.json|真实只读结果]]、[[tools/RiskHot/docs/verification/event-timeline/design-scan.json|设计扫描结果]]。最终全套测试输出在本机 `.riskhot/event-timeline/final-regression.log`；首轮输出保留于 `.riskhot/event-timeline/regression.log`。

## 涉及文件与保留边界

- 查询：新增 `src/event-management/timeline.ts`，修改 `queries.ts`。
- 页面：修改 `src/web/events.js`、`styles.css`，保留原HTML外壳。
- 测试：新增时间规则与隔离样本辅助文件；扩展页面/API及两套浏览器测试。
- 文档：同步F02功能、实际页面及查询契约，更新批准计划、项目索引与日志；本报告与截图作为当前证据。

当前排序需一次加载全部可见事件与证据。应用层时间成本为 O(E + Σ(Ve×logVe) + N×logN + Σ页内(Ee×logEe + Se×logSe))：N为可见事件数，E为批量证据行总数，Ve为每事件去重后版本数，Ee为该事件证据行数，Se为去重信源数。包括全量证据整理、每事件依据版本排序、全局事件排序以及当前页证据/来源排序；空间为O(E+N)。数据库联结与jsonb去重聚合的执行计划和成本需另行评估。只验证25条受控事件与当前真实单事件，未做大规模性能测试；扩大规模前须评估规范化日期/读模型及回填。偏移分页在并发新增或更正时间时可能改变跨页位置，不保证快照一致性。真实库没有多来源/超过20条样本，这些行为由隔离库验证，不向真实库注入测试数据。

## 审查修正与本次专项（2026-10-27）

首轮210项回归和截图保留为初次验证证据。审查修正后，主审另行运行完整回归215/215、全项目类型检查并通过；最终服务重启后真实接口200，独立Chrome for Testing只读复验1440/390/320宽度和详情返回，0页面错误。本机最终记录为 `.riskhot/event-timeline/final-real-smoke.json`。没有重复截图或设计扫描。

- `src/web/events.js`：401/403清空受限内容，仅临时故障保留；状态改为替换DOM前捕获；恢复summary焦点、全折叠日期位置及滚动；仅有效列表DOM可更新快照，详情失败与重试不会污染它；日精度补星期，仍不输出虚构时分。
- `queries.ts`：采集链增加 `acquisition.operation_id = origin.operation_id`；来源缺失或工件/时间/操作不一致时保留同版本可用P并明确C待核实。
- 专项新增真实接口的无关旧版本隔离、完整日期/较新年月/未知的分层分页、三来源同刻ID及重复关系的稳定顺序；复杂度补计每事件证据版本及页内来源排序。

```sh
node --import tsx --test src/tests/event-ui.test.js src/tests/event-timeline.test.ts
node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/event-api.test.ts
SKIP_SCREENSHOTS=true PLAYWRIGHT_MODULE=/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node --env-file-if-exists=.env --import tsx src/tests/events.e2e.ts
```

实际结果：页面/时间17项、API7项、隔离浏览器18组全部通过，0页面错误。浏览器新增延迟响应反例，验证请求期间的新滚动、日期/来源折叠与summary焦点；验证全日期折叠更新不跳顶、详情失败后重复失败/成功重试的返回状态，以及401/403内容移除与原503保留行为。本次无截图重拍；现存截图为首次视觉验证证据。

最终类型检查曾发现新增分页测试的TS7022响应推断问题，已给分页结果和响应添加显式结构类型，重新检查通过。三层审查的14条记录均已逐项处理，记录见批准规格的Review Triage Log，无待修阻断项。
