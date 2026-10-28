# F01/F02 Fact 模型实施与验收

> 2026-10-27 · main 原工作区 · 本机运行库 schema4。

## 输入与交付范围

依据已确认的 F01、F02 功能设计及[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计|F02 数据模型与存储设计]]实施。[[tools/RiskHot/docs/superpowers/plans/2026-10-27-F01-F02-Fact模型实施|实施计划]]记录顺序。代码、SQL、测试及验证脚本均在 src；保留其他任务的未提交修改。

本轮改造既有 F01 接入、标准化与交付，以及 F02 抽取、归组、关系、增量、评价、保存和交付链路。并非补齐整个 L0 的所有规划能力。

## 实现结果

- Fact 从已校验候选保存，与 Information 多对多，通过独立证据关系固定资料版本和 Unicode 码点位置。运行候选通过 candidate_fact 连接 Fact。
- Event 仅保留九项当前属性；通过 event_fact 关联一到多个 Fact，同一 Fact 不得属于两个 Event。主体、变量、定义依据、评价与事实使用关系表。
- F02 不再读写 EventUpdate/EventRevision。纠正更新当前标题、描述、主体、行动、阶段及发生时间；保留原 Fact、资料和操作审计。
- 同处理重试及同资料、同核心内容、同证据集合的重新抽取复用 Fact。新资料版本不在抽取阶段擅自扩大已批准事件的证据范围。
- 正式保存复核绑定内容摘要；并发变化使旧建议失效并回到身份匹配。单纯重复不新增事件、评级或交付；来源佐证与实质变化分别处理。
- 交付消息固定当次内容，前序依赖维护应用顺序。文件丢失、损坏和重复投递独立恢复；页面区分已接收与已采用。
- 事件页展示当前事件、关联 Fact、资料证据、关系、评价和交付。M1 资料结果提供候选事实及事件归属入口，旧修订入口退出。

## 文件、接口与兼容边界

| 对象 | 格式或位置 |
| --- | --- |
| F01 资料交付 | information-handoff.v1；handoffs/f01-f02/消息ID/information.json，保持资料版本语义 |
| 新 F01 候选导出 | candidate-result.v2；原 candidates.json 路径，增加 fact_id，payload 使用 subject/action/event_time |
| 新完整候选文件 | full-event-candidates.v2；events/processings/处理ID/candidates.json |
| 当前事件查询及下载 | GET /api/v1/l0/events/:id 及 /file，event-facts.v2 |
| Fact 与资料关联查询 | GET /api/v1/l0/facts/:id；GET /api/v1/l0/versions/:id/facts |
| 当次固定交付 | handoffs/f02-events/消息ID/event.json、message.json、receipts/接收方.json |
| 消息与接收格式 | event-message.v2、event-commit.v2、event-receipt.v2 |
| 原始模型工件及审核 | 仍以原运行身份和代次保留，不改写历史字节 |

F01 既有模型传输字段通过 legacy-candidate 转换边界进入新 Fact；这不是新 Event 的表结构。历史 v1 候选文件保留原格式，新导出使用 v2；验收工具分别验证。新 F02 使用 f02-fact-draft-v2 任务包。

## 测试与审查

类型检查通过，最终自动化回归 **194 项全部通过**。完整日志见本机 `.riskhot/fact-suite-final.log`；浏览器 24 项检查通过，覆盖身份和关系复核、列表分页、零候选、当前事件、Fact、资料入口和下载，并检查 1440、390、320 像素宽度。真实运行页面验证通过，无页面脚本异常。Impeccable 检测无输出问题，已人工查看桌面与窄屏截图。

本轮按事务、权限、迁移、并发、恢复、工件一致性和页面进行了自审，未调用额外审查代理。修复的具体问题包括证据越界、旧分析恢复未重新匹配、迁移后父任务状态、交付列表排序缺少字段、候选验收漏比较 Fact 标识，以及旧资料回填误处理事件消息。迁移验证最终使用与正式升级相同的完整入口和权限授予，重复运行两次。

数据库约束与测试覆盖：多资料/多 Fact、唯一事件归属、无证据事件阻断、空时间与部分日期、闰日/时区、不回退较新事实、纠正、重复提交、权限撤回、过期审批、文件损坏/丢失、乱序接收、失败整体回滚及旧库迁移。

## 真实运行验收

真实证据分为两部分：**此前已批准的人民银行事件迁移、重新交付和实际读取**，以及**服务恢复后既有调度计划自动完成的新资料接入与真实模型抽取**。没有新增正式业务批准，没有将迁移基线冒充新建事件。下表是切换时基线，持续运行后资料数量会增加。

| 检查 | 结果 |
| --- | --- |
| Information / 资料版本 | 111 / 111，均保留 |
| 原候选运行记录 / candidate_fact | 1026 / 1026，无丢失 |
| Fact | 1026 |
| 正式 Event / event_fact | 1 / 1，原事件身份不变 |
| 事件 ID | 153a896a-2a29-4904-bb2b-cd31371a8ee4 |
| 事件 | 中国人民银行开展560亿元7天期逆回购操作 |
| 关联 Fact | 14b34d66-cd3b-4832-aae0-ace2b5da1dd2 |
| 新消息 ID | 97b3bf56-47fd-4421-860b-acd3fd275a43 |
| 下游 | event-audit，received / applied，文件 ready |
| 未完成分支 | 1 条，Step 2，MODEL_CHANGED_REVIEW_REQUIRED；父任务 partial |
| 当前页面 | /events#event=153a896a-2a29-4904-bb2b-cd31371a8ee4 |

只读验证将磁盘文件与 HTTP 下载逐字节比对，核对摘要、正式事件、Fact 和持久接收/应用回执。本机证据：`.riskhot/fact-runtime/report.json`、`.riskhot/fact-migration-validation/report.json`、`.riskhot/f02-events/real-page/result.json`。

真实结果文件位于 `.riskhot/artifacts/handoffs/f02-events/97b3bf56-47fd-4421-860b-acd3fd275a43/`，包括 event.json、message.json、receipts/event-audit.json。历史交付文件没有改写。

### 新代码下的真实调度任务

恢复服务后，既有计划自动采集披露易公开公告列表（5条列表记录，非 PDF 正文），于北京时间 2026-10-27 16:51 开始处理；真实 Codex 尝试被接纳，保存2条候选及Fact。只读验收在16:56通过，逐字节核对资料、接收回执及 candidate-result.v2 文件，确认真实固定输入读取审计、模型尝试及Fact标识一致。

- 接入操作：a6218173-9772-45a1-ae74-8cde9e514f46。
- 资料版本：ae4c4c7f-887b-47da-8684-6d391dce0175。
- 处理：fc6f2163-61d3-4eeb-87b2-0cb11735264e。
- Fact：df402736-c5c5-4d87-b8fa-09beaea5eb29、20a07017-3f70-4ab0-82f0-c67ed58d263d。
- 页面入口：/events#information=ae4c4c7f-887b-47da-8684-6d391dce0175。
- 候选文件：.riskhot/artifacts/handoffs/f01-f02/e7308d29-362a-49ba-a8d6-0973eac618a6/analyses/fc6f2163-61d3-4eeb-87b2-0cb11735264e/candidates.json。
- 范围：完成获取、标准化、交付、真实抽取及 Fact 保存；这两条仍为候选，尚未经过 F02 正式事件复核与提交。

结构化证据见[[tools/RiskHot/docs/verification/fact-model.json|本轮验证记录]]。运行库16:55快照为114份资料、1028个Fact，正式Event仍为1个；其余自动任务仍按原计划运行。

## 切换与恢复

停本机 LaunchAgent后确认无运行库连接，生成 `.riskhot/backups/before-fact-cutover-20261027.dump`，在隔离数据库验证，再迁移运行库并恢复服务。首次升级在旧资料回填阶段失败，事务已回滚；修复消息范围过滤后，完整入口验证及实际迁移成功。原 F02 业务表迁到 f02_legacy，旧候选载荷、消息、交付和接收记录单独归档；运行应用不查询归档表。

只读复验：

```sh
node --env-file=.env --import tsx src/scripts/verify-fact-runtime.ts
```

回退须停止新服务，用备份恢复至另一个数据库，结合迁移后新增数据核对，再切换匹配旧 schema 的应用；不能让旧应用直接连接 schema4，也不能直接覆盖已有新增业务。保留备份及新工件供核对。

## 剩余能力与验收边界

- 当前跨来源语义去重仍依赖模型及复核；数据层支持同 Fact 多资料并已验证，自动接入仅做同资料精确复用。其他来源可保存佐证 Fact 并归入同一 Event，尚未提供跨来源 Fact 人工合并操作入口，不宣称 AC-F02-31 已端到端覆盖。
- 现有第二条隔夜逆回购尚未完成身份与后续复核；不能因为模型升级而替用户批准。
- F01 复杂附件、多媒体、资料版本顺序的人工裁决，以及受登录/风控限制来源沿用原有边界，本轮未扩展。
- M2/M3 完整定义治理和正式量化方法未完成；没有有效正式定义时保留缺口，不生成虚构关系或分数。
- F03/F05 风险分析未接入，event-audit 只证明可靠读取与采用；不代表后续风险分析已完成。

## 改动文件定位

- src/db/004-facts.sql 与 src/platform/fact-migration.ts：表结构、约束、迁移与归档；002-information-handoff.sql限定资料消息回填范围。
- src/event-management/：Fact、当前事件、归组/增量/评价/复核、固定交付及查询；legacy-candidate.ts仅承担旧传输兼容。
- src/information-ingestion/processing/repository.ts、handoff.ts、handoff-contract.ts：F01接收、候选保存与v2导出。
- src/runtime/events.ts、server.ts、relay.ts：接口、schema就绪检查与后台恢复。
- src/web/events.js、model.js：实际页面与M1结果入口。
- src/scripts/verify-fact-migration.ts、verify-fact-runtime.ts及现有验收脚本：迁移、真实落盘/下载/回执一致性验证。
- src/tests/：新关联/迁移测试及原流程、API、浏览器回归适配。

## 正式事件页面审查：标题摘要与业务重点

2026-10-27 按用户要求，以既有560亿元7天期逆回购事件审查正式事件页。第一版块为标题、摘要及辅助的时间/阶段；第二版块为主体Subject、观测对象Target、金融意义。金融意义补展示已经保存的维度说明及研究用途，保留评价状态和限制。Fact/原文、交付与下载移到可展开追溯区；自动刷新保持同事件展开状态。

本事件Subject为中国人民银行，没有已确认的Target；界面明确显示尚未确认，不将行为主体充当观测对象。金融意义沿用原有文字草案与空M，没有生成新分析、补造关系或修改正式记录。

涉及src/web/events.js、styles.css、event-ui.test.js、events.e2e.ts及events-real.e2e.ts。16项界面单元测试和类型检查通过；24项原流程浏览器检查通过；真实页面在1440/390/320像素下通过溢出、关键内容及刷新保持展开检查。截图在.riskhot/f02-events/real-page/正式事件重点-1440.png及对应窄屏文件。

## 正式事件内查看关联候选

2026-10-27 按用户要求移除独立候选处理工作区、逐项处理页面及资料处理配置页面。事件管理默认显示正式事件；详情在标题摘要与业务分析之后直接列出关联候选，候选详情和各自原文就地展开，交付仍单独收起。M1 保留只读的候选事实与归属入口；旧候选地址按实际关联转到正式事件或未归组候选，旧处理地址转到资料抽取结果。

业务数据、人工复核规则和后台处理接口保留。本次没有提供新的页面审批入口；需要人工复核的候选仍保持待复核，由现有受控处理流程承接，不能因页面删除自动批准或绑定事件。

验收：15 项界面单元检查、类型检查、8 组隔离浏览器场景通过；真实事件153a896a-2a29-4904-bb2b-cd31371a8ee4显示1条关联Fact，原文和导出读取成功，1440/390/320像素无横向溢出，控制台无页面异常。Impeccable布局检查无发现。浏览器结果记录在.riskhot/f02-browser/result.json和.riskhot/f02-events/real-page/related-candidates-result.json，截图为同目录正式事件关联候选-1440.png及对应窄屏文件。

测试过程修正了候选数量的模板渲染问题；旧地址测试补等待实际跳转完成，页面切换增加读取状态，避免短暂展示上一个页面内容。此后单元及浏览器回归通过。
