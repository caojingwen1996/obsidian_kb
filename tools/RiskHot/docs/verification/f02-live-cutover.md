# F02 实际部署与真实事件验收

> 2026-11-01 · 本机部署及一条真实新事件“采集→Event入库”验收通过。保存后的AI-04关联未通过，见限制。依据[[tools/RiskHot/docs/superpowers/plans/2026-11-01-F02实际部署与真实事件验收|部署与验收计划]]，先保存计划，再执行部署。

## 输入依据与范围

- 上游依据：[[tools/RiskHot/docs/superpowers/specs/2026-11-01-F02八步闭环-design|八步实施规格]]、[[tools/RiskHot/docs/superpowers/plans/2026-11-01-F02分批实施|分批实施计划]]及[[tools/RiskHot/docs/verification/f02-eight-step|首批工程验证]]。
- 原目录 `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot`，本机服务 `http://localhost:18081`；复用实际PostgreSQL、40条信源及已有工件。
- 用户明确要求“先写计划 再完成”。本次由执行代理按用户授权比对原文并调用身份/最终保存复核API，保留复核理由；不是声称用户在页面逐项点击。未发布自动审批政策，未批准存量其他候选。
- 当前运行方式为真实采集、真实模型、显式发起F02、逐项复核后保存；不代表无人值守全自动处理。

## 保全、部署与计划恢复

- 原运行库schema5：40信源、1资料、2Fact、2待处理候选、0Event；已有采集任务均完成。先保全项目未提交差异和7份未追踪文档，再停原LaunchAgent，未处理其他Wiki改动。
- 私有备份位于 `.riskhot/backups/f02-cutover-2026-11-01T05-26-59-609Z/`，包含配置、服务plist、工作区差异、工件及数据库备份；私有配置不提交。
- PostgreSQL18.6 custom备份174208字节，SHA256 `50720ed089245f58a7200449f69ff41c85cc538a6afeba0338bdab417d63540f`。在唯一随机校验库恢复，五类数量一致，随后仅删除该校验库。备份保留。
- 原目录fast-forward部署至 `51d6f669` 后应用本轮必要修复；`npm ci`完成，008增量迁移无异常、原数据数量不变；009已建立业务运行账本与pg-boss队列。`platform.schema_versions`实际记录为5、8，009不写该版本表，不虚称版本表已有9。
- 当前私有配置选择 `EXECUTION_ENGINE=pg-boss`，固定业务handler、同库业务运行角色及隔离模型认证。模型子进程不继承数据库凭据。
- API、Worker均可写新队列，但无队列DDL权限；仅Worker可执行受控模型认领/资料读取函数，API无该执行权。Worker无信源表UPDATE权限。
- 常驻标签 `local.riskhot.source-candidates.8bb6087669`；原目录运行API与一个业务Worker，18081仅一个监听。旧Worker/Relay不再由本服务启动；共享Temporal容器未删除。
- 验收期间关闭计划扫描，完成后恢复原 `SCHEDULE_ENABLED=true`，每源计划40条与备份逐项一致，原先全部 `enabled=false`，未擅自启用。三个周期任务已登记。证据：`f02-live-cutover/service-results.json`。

## 真实业务结果

| 对象 | 实际结果 |
| --- | --- |
| 信源 | `wiki-source-001` 中国人民银行，ACTIVE |
| 官方原文 | [公开市场业务交易公告［2026］第210号](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026103008462393538/index.html) |
| 采集任务 | `c961b408-2f76-475b-95eb-53fa981c6e18`，真实网络采集完成，幂等键 `f02-live-20261101-pbc-1` |
| 资料 | `0508c16e-30f7-4812-ad0b-06e60da7412d`，version=1 |
| 资料摘要 | `06e27fa1c2cfd1bb3fedec70613053e0da065d9a9f2025c8fc11b136726a21a0` |
| 验收候选 | `eb9470f8-64c5-4f47-bbc0-e0292aaca545`，completed，执行代次4 |
| 初始Fact | `add2e0c2-2308-4a01-aa8f-ca699e176729`，已唯一归属本Event |
| 正式Event | `fc613f1d-c901-4aec-91fb-2382ffd27325`，中国人民银行开展150亿元7天期逆回购操作 |
| 入库时间 | 2026-11-01 13:57:15（北京时间） |
| 提交回执 | `e1979f19-97fe-402b-8759-b096f15094a6`，COMMITTED |
| 结果消息 | `39313495-2f8c-4c41-aa0d-ba80f674be70` |
| 审计接收端 | event-audit：received、files ready、applied=true |
| 评价 | `520fe0c6-1b27-4118-81e7-eaede04dbf01`，text-draft-v1，draft，M与五维分值均为空 |
| 变量提取 | `5c2694c9-d646-4005-b56a-d753073c7257`，6项候选，待治理/待对象，正式观测0项 |

真实链路经过AI-01提取、AI-08对象识别、AI-02身份建议、身份复核、AI-05变量提取、AI-09文字评价、最终复核及队列保存；不是直接插入Event，也不是以健康检查代替业务验收。定义清单使用现有本机登记 `riskhot-local-formal-inventory-20261027-v1`；其正式Target/变量集合为空，没有虚构定义。

两段采用证据分别支持2026-10-30、150亿元、7天期和1.40%操作利率；不将同文10000亿元隔夜操作混入本Fact，不推断净投放或政策方向。AI-08完整检查后返回无适用Target；Subject不自动创建为Target。

验收后数据库快照：40信源、2资料、4Fact、4候选、1Event。原1资料、2Fact、2待处理候选仍在。另一新增候选 `a1ddc997-d22e-4968-bc0c-5d4e11c8073c` 为隔夜操作，仍处于待复核，本篇两条候选不宣称全部完成。

## 本轮发现与最小修复

| 问题与实验 | 修复与验证 |
| --- | --- |
| API与Worker均发布新Job，但迁移只授权Worker | 共用business-grants分别授权两角色队列DML，DDL仍由发布角色负责 |
| 真实AI-01首次未能启动：父Worker无受控模型函数执行权限 | 只向模型能力Worker授权既有受控函数；权限测试先失败后通过；保留失败尝试，同预算恢复后真实提取成功 |
| 精简AI-08运行提示词丢失Subject、工具与事件实例边界 | 复用已确认设计文档完整提示词为运行资产；规则升target-recognition-v2并标注包修订，生成新输入摘要；旧结果留审计不强批，新真实结果为无适用Target |
| 真实保存FOR SHARE信源表要求UPDATE，Worker无此权限 | 复用既有platform.lock_source，保留锁语义；真实riskhot_io角色回归先失败后通过，不扩大信源写权限；失败Job留存并重投同一代次 |
| 保存后同键重发复核请求返回STALE_PROPOSAL | 将摘要校验移至幂等操作首次工作段，命中回执前仍校验全部来源权限；同键同内容202返回原代次4，Event/回执/初始Fact均仅1份，异内容冲突和副来源撤权均拒绝 |

## 验证与证据

- `npm run typecheck`通过；`npm run pipeline:check`通过（120节点、23任务、7提示词、15来源文档）。
- `EXECUTION_ENGINE=temporal SCHEDULE_ENABLED=false npm test`：367/367通过，测试使用独立随机库；进程级覆盖只用于兼容测试，不改变常驻pg-boss配置。第一次并行于修复过程的全量运行366/367，失败正是新增Worker权限回归；修复后的最终全量为367/367。
- 最后专项33/33通过，覆盖队列授权、AI-08契约/运行、Service幂等与真实角色保存；类型检查、5份Markdown表格及差异空白检查通过，结果见 `f02-live-cutover/checks.json`。
- 独立Chrome for Testing、专用临时用户目录：真实页面6项检查通过，无脚本错误或失败接口；任务与Event详情刷新后仍可读，保存后无复核按钮；浏览器在finally关闭并清理临时目录。初次脚本误用历史hash格式后已改为当前页面格式，未修改产品路由。
- 身份、最终保存：`f02-live-cutover/identity-review.json`、`final-review.json`及`commit-review-response.json`，保留授权说明与实际提案摘要。
- 结果：`verification.json`、`database-results.json`、`event-snapshot.json`、`candidate-saved.json`、`idempotency.json`。
- 故障与恢复：`commit-permission-failure.json`、`commit-recovery.json`、`association-rejection.json`。
- 页面：`browser-results.json`、`task-saved.png`、`event-saved.png`，均在本报告同名目录内。
- 实时入口：[正式事件](http://localhost:18081/events#event/fc613f1d-c901-4aec-91fb-2382ffd27325)、[八步任务](http://localhost:18081/events/tasks/eb9470f8-64c5-4f47-bbc0-e0292aaca545)。

## 限制与后续

1. **AI-04关联未完成**：独立真实调用 `ef6c6a71-5014-490a-b70d-d0332421fa06` 将64字符basis_digest回传为60字符，程序以ASSOCIATION_REFERENCE_INVALID严格拒绝；原模型响应保留，未替换摘要强行保存。当前Event及审计交付已保存，关联处于可恢复分支。`verify:f02`因association_saved=false退出1，不能将完整关联验收标为通过。
2. 无适用Target是本次原文语义结果；因此本次实际验收没有覆盖非空Target、正式变量观测链。6项变量提取结果已保存为待治理/待对象，不冒充正式观测。非空路径工程测试见首批报告。
3. 正式M方法、用途规则和外部M2定义服务仍未发布/接入；F03/F05风险分析未接入。本次event-audit采用仅代表验收接收端。
4. 原存量候选与另一隔夜候选仍待复核。B/C批的REUSE增量、多来源归并及治理能力不因本次真实NEW验收而视为完成。
5. 原每源计划全部停用，当前没有开启定时无人值守采集；F02启动和复核仍需显式操作。

## 回退说明

产生正式Event前，可停新服务并按保全的代码、配置和整库备份恢复；本次已产生正式写入，之后回退须先停受理、保全新Event/Fact/回执并对账，优先前向修复，不直接用切换前备份覆盖新结果。原备份、stash、工件与失败尝试继续保留，未清空预算或删除原始资料。

## 本轮变更文件

- 运行授权：`src/platform/business-grants.ts`，对应 `src/tests/business-queue.test.ts`。
- AI-08提示词：`src/prompts/08.target-recognition.md`、`src/event-management/target-recognition-contracts.ts`、`src/event-management/eight-step-packages.ts`，对应 `src/tests/ai08-contract.test.ts`。
- 保存与复核：`src/event-management/eight-step-commit.ts`、`src/event-management/eight-step-service.ts`，对应 `src/tests/f02-eight-step-commit.test.ts`、`src/tests/eight-step-service.test.ts`。
- 文档：部署计划、本报告、`index.md`、`log.md`及 `docs/verification/f02-live-cutover/` 配套结果与截图。
