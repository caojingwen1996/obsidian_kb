# F01资料与单信源任务迁移验收

> 2026-10-29 · 本机已完成schema5切换。保留40条信源原字段及ID，其余应用表按用户授权重建。真实央行资料已保存并抽取2个候选；正式事件仍待人工复核。

## 输入依据

- [[tools/RiskHot/docs/superpowers/specs/2026-10-29-f01-material-migration|实施规格]]与用户“数据库除了信源表，其余都可以删除”的明确授权。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F01信息接入模块数据模型与存储设计|F01数据模型]]及[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计|F02数据模型]]。

## 实现与边界

- F01业务表为 `infomation.ingestion_schedules`、`ingestion_tasks`、`ingestion_material`、`ingestion_task_material`、`ingestion_material_segments`。一源一计划、一任务一信源；手动多选分别受理。任务资料关联仅存身份，未建立逐资料处理状态表。
- material只存当前正文及当前片段；内容变化原子递增version字段，无独立版本表、原件或四类记录。内容摘要排除规则版本、片段ID等技术字段。旧依据版本／摘要不符则拒绝，不以当前正文冒充旧版。
- 任务冻结发现集合并保存入口检查点；暂停继续递增代际，旧执行不能写入。资料保存和下游可读确认后采集完成，抽取错误另行显示。可读确认与抽取投递核对同一资料版本。
- F02沿用候选、Fact、归组、关系、增量、文字评价、人工复核、正式保存与可靠事件交付，不恢复分析总记录。模型审计只保存资料引用，调用时临时读取正文；预算按资料依据隔离，同版恢复不自动刷新额度。
- 页面支持来源任务过滤、历史分页、当前正文、候选重准备／复核／恢复。正式事件复用既有主体、观测对象、直接变量、维度评价及下载交付组件，证据链接明确核对当前资料版本；不再展示旧六步采集进度。
- 信源只按当前档案及updated_at校验。原信源表历史version物理列保留但新接口不使用，source_versions及通用config历史已退出；连接器运行参数仍来自已确认范围。
- setup仅初始化应用库，schema5重复运行不重置新资料；共享测试库与Temporal依赖由独立显式命令准备。登记此前确认的本地正式定义范围，明确外部M2尚未接入，不伪造外部空字典。
- schema4路径保留供旧隔离回归，schema5应用不读取被取消表、不建立兼容视图。旧ID入口明确退出。共享文件和Temporal自身数据库未清理。

## 审查与工程验证

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| 类型检查 | 通过 | npm run typecheck |
| 新模型集成 | 23/23通过 | 重建回滚、信源保护、权限、幂等、内容版本、真实关系复核、预算、并发、检查点、两周期调度、暂停继续、终止恢复、定义登记、CLI及交付下载 |
| 独立浏览器 | 10/10组通过，无页面错误 | 真实点击丢响应重放、重准备、关系复核、过期恢复、最终审批、非事件重新确认、历史分页及同页资料导航；1440和390视口 |
| 真实Temporal隔离链路 | 通过，6次受控模型调用 | 独立应用库／命名空间，实际API/IO/model/relay角色，HTTP503后Worker重启恢复，审批、正式保存及交付 |
| 完整回归 | 276/279通过 | 3项既有失败如下，总耗时155.16秒，无挂起测试 |
| 切换后实际角色权限 | 1/1通过 | API/model不能自授权限或制造候选，模型不能直接读资料表 |

三层独立审查的每条发现及判定均记录在实施规格。关系约束、旧预算复用、连接池等待、恢复入口、丢响应幂等、分页、健康检查等已局部修复并复验。Impeccable检查覆盖实际页面，采用独立Chrome for Testing及任务专用临时目录，结束后关闭和清理。

## 实际切换与结果

1. 停止当前工作树专属后台服务；预检确认无应用角色连接、无活动Temporal应用工作流，无信源profile差异。
2. 导出信源与旧表计数，显式重建事务完成。旧165份资料、1479个Fact、1个Event及其任务／审批数据按授权退出；没有将旧ID映射为新业务对象。
3. 40条信源全部原字段和ID逐项一致；仅新增updated_at用于当前档案并发控制。40份计划均86400秒且停用，下次时点为2026-10-30 15:45:53（上海时间）；未来新建仍3600秒且停用。
4. 普通setup成功后恢复后台服务；健康、session、任务和计划接口均200，新库schema5可读。
5. 使用新采集命令抓取央行《公开市场业务交易公告 [2026]第209号》：任务完成、1份资料可读，真实AI-01尝试accepted并抽取2个候选；当前2个Fact、0个正式Event。没有代替用户执行正式业务审批，所有工作流已结束。

实际任务为 `f3fd5de2-a6a4-47ca-a565-c5447beec065`，资料为 `f542e5c0-b4c0-418c-88e4-c3f613b68755`。[打开当前资料](http://localhost:18081/m1#material/f542e5c0-b4c0-418c-88e4-c3f613b68755)。具体计数、旧表退出、服务检查及摘要见[[tools/RiskHot/docs/verification/ingestion-migration/deployment.json|实际部署证据]]。

备份 `.riskhot/backups/ingestion-preflight-2026-10-29T07-45-53.656Z.json` 权限0600，SHA-256为 `e781b7e6af26e841796925db6237cfc641bfb8c5c79aac1f0ffb3e532e64e79e`；原信源备份未覆盖。未操作Temporal自身数据库、其他数据库或共享工件文件，未暂存／提交代码。

## 遗留事项与限制

完整回归3项失败来自此前提示词文档重组，保留原断言和日志：

1. event-ratings.test.ts仍读取已删除的AI-05 V0.1文档，报ENOENT。
2. pipeline-data.test.js读取当前AI-03增量文档时，没有找到展示解析器要求的text／markdown正文块。
3. 旧schema4 temporal.test.ts等待MODEL_HTTP_503超时，旧prepareExtraction仍依赖已删除AI-01 V0.1文档。新schema5真实Temporal链路通过，不能据此将旧测试标为通过。

未恢复用户已删除文档，未改断言掩盖失败。事件展示时间全量内存投影分页是既有性能问题，另记延后工作；跨来源Fact人工合并、全部公共能力和完整设计场景并未因表重建而自动完成。历史IO_UNAVAILABLE个案根因未证明，关联专题及旧原型仍需按适用版本整理，见[[tools/RiskHot/docs/system-design/03-系统功能架构/F01修改清单-2026-10-29|剩余清单]]。

## 文件与证据

- [[tools/RiskHot/docs/verification/ingestion-migration/changed-files.json|本轮修改文件清单]]。
- [[tools/RiskHot/docs/verification/ingestion-migration/logs/final-integration.log|23项集成输出]]、[[tools/RiskHot/docs/verification/ingestion-migration/logs/final-full.log|完整279项回归输出]]。
- [[tools/RiskHot/docs/verification/ingestion-migration/logs/final-temporal.log|真实Temporal输出]]及[[tools/RiskHot/docs/verification/ingestion-migration/logs/temporal-results.json|结构化结果]]。
- [[tools/RiskHot/docs/verification/ingestion-migration/logs/final-browser.log|浏览器输出]]及[[tools/RiskHot/docs/verification/ingestion-migration/browser/results.json|10组检查清单]]，桌面／移动截图位于同目录browser下。
