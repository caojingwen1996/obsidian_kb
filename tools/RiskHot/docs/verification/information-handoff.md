# 标准化资料交付与候选接收闭环验证

日期：2026-10-27。状态：工程、独立审查修复与一次真实端到端验收通过；保持 main。

## 依据与范围

依据 [[tools/RiskHot/docs/superpowers/plans/2026-10-26-标准化资料交付与候选接收闭环|已确认实施计划]]，实现 F01 固定版本交付、F02 接收与当前 EXTRACTION_ONLY 候选文件。F02 Step 2～7及完整 AI-01 分类/初步 Target 字段继续未实现。

## 工程验证

- 类型检查通过。最后完整回归 118/118，通过、0失败、0跳过；日志为本轮私有运行记录。
- 独立浏览器53项通过，无页面异常；包含真实同源下载、1440/390/320宽度、零事件原因及原任务控制回归。使用专用 Chrome for Testing，与日常浏览器隔离。
- 接收、抽取完成与文件发布状态分开；同版并发接收复用消息/处理/候选身份。
- 原件/正文不可读时接收失败，候选数量未知；完整50条导出不受页面分页限制。
- 回执使用规范化JSON字节；候选或回执文件缺失可以独立修复，不重新调用模型。

## 独立审查与修复

[[tools/RiskHot/docs/verification/information-handoff/独立代码审查|原始独立审查报告]]给出0项严重、2项重要、1项较小问题。已完成一轮集中修复，4项反例先失败后通过，相关专项12/12，随后完整118/118通过。

1. 历史来源回填排除保存后才创建/获取的操作；存在多个候选依据时不任意选择。
2. 验收逐项核对候选正文、身份、顺序、状态、固定输入/方法及结果状态。
3. 旧回执发布错误不越过文件执行租约覆盖新恢复状态，避免错误异常提醒；该问题因安静运行要求按重要级别处理。

## 部署与数据保护

运行库增量迁移前后，40条信源、26条计划、10条手动任务、91个资料版本/处理/消息/接收记录、746条候选的身份摘要一致；信源启停与计划设置不变。补齐91份版本来源依据与交付记录。部署重启后再执行一次幂等迁移，覆盖旧服务退出瞬间可能新提交的记录，不重置数据。服务就绪检查通过。

## 真实任务

真实信源为人民银行《公开市场业务交易公告 [2026]第206号》。本轮实际重新获取原公告、复用已保存版本并为其失败处理开启一个有理由的模型执行窗口，沿用原固定输入和方法。2026-10-27 10:26:34～10:26:59（北京时间）完成真实 Codex 尝试，得到2条候选；不是复用既有完成结果冒充本次模型执行。

- 接入操作：`ed396dec-b77a-4d43-9762-66e8367057f8`。
- 资料版本：`cb0b75e9-58e2-44d3-99fd-4bb0117effc5`；接收消息：`78e364d9-5d2e-4442-afab-2b3195742b98`。
- 处理：`d1da7e6f-3499-4afa-a394-c1b4233d97c3`；本次接受的模型尝试：`7c6fcaf1-e359-4465-94c7-6db782c9bc74`。
- F02 固定输入准备的读取审计与交付包SHA-256一致；三类下载与磁盘字节、登记摘要一致。
- 候选分别为560亿元7天期逆回购、3980亿元隔夜逆回购；原文及表格核对时间、金额、期限和1.40%操作利率，程序逐个核对码点区间与引文。候选保持待归组，不创建正式事件。
- 同版向接收服务补发3次，处理/候选身份不变，模型累计尝试仍为3次（2次历史失败加本次1次成功），未新增尝试。
- 服务重启后只读验收再次通过；真实M1页面分别在1440/390宽度验证并实际下载候选文件，页面数量为2，内容与保存结果相同，无页面错误。

文件绝对位置：

- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/.riskhot/artifacts/handoffs/f01-f02/78e364d9-5d2e-4442-afab-2b3195742b98/information.json`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/.riskhot/artifacts/handoffs/f01-f02/78e364d9-5d2e-4442-afab-2b3195742b98/receipt.json`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/.riskhot/artifacts/handoffs/f01-f02/78e364d9-5d2e-4442-afab-2b3195742b98/analyses/d1da7e6f-3499-4afa-a394-c1b4233d97c3/candidates.json`

[[tools/RiskHot/docs/verification/information-handoff.json|完整结构化验收证据]]保留文件大小、摘要、固定身份、读取依据和重投核对。当前运行库迁移前91个版本的原件与正文均可关联，91份交付记录已补齐；历史元数据限制仍按协议显式表达。

## 实施取舍

- 保留中文计划标题；技能脚本只识别英文标题，因此手工提取相同任务简介。影响仅为进度工具的提取方式，产品不依赖它。
- 接收与导出共用同一事务/服务的相邻任务联合提交；行为由独立测试覆盖。影响是提交边界与任务编号不一一对应。
- 页面交付渲染从已存在的model.js导出，兼容静态文件先于旧服务重启的窗口；delivery.js保留重导出。
- 文件异常由持租约的巡检负责投影；已接收回执不因文件失败回滚。真实文件异常的显示可能延迟一次巡检；已健康文件每5分钟复核可读性。

## 尚未实现

F02事件归组、主体/变量关联、增量判定、金融意义、正式事件保存和变化交付；后续风险识别与分析；完整AI-01字段、复杂附件/PDF及全部版本决策/人工版本复核。历史抽取附加元数据无法从原响应恢复时明确标记缺失，不编造原因。


## 实现文件清单

- `src/db/002-information-handoff.sql`
- `src/information-ingestion/processing/handoff-contract.ts`
- `src/information-ingestion/processing/handoff.ts`
- `src/information-ingestion/processing/repository.ts`
- `src/information-ingestion/processing/tasks.ts`
- `src/platform/artifacts.ts`
- `src/platform/grants.ts`
- `src/platform/handoff-files.ts`
- `src/platform/handoff-migration.ts`
- `src/runtime/activities.ts`
- `src/runtime/handoff.ts`
- `src/runtime/scheduler.ts`
- `src/runtime/server.ts`
- `src/runtime/web.ts`
- `src/scripts/migrate-handoff.ts`
- `src/scripts/setup.ts`
- `src/scripts/verify-handoff.ts`
- `src/tests/browser.e2e.ts`
- `src/tests/candidate-export.test.ts`
- `src/tests/fixture.ts`
- `src/tests/handoff-api.test.ts`
- `src/tests/handoff-files.test.ts`
- `src/tests/handoff-fixture.ts`
- `src/tests/handoff-migration.test.ts`
- `src/tests/handoff-real.e2e.ts`
- `src/tests/handoff-verification.test.ts`
- `src/tests/handoff.test.ts`
- `src/tests/storage.test.ts`
- `src/tests/temporal.test.ts`
- `src/tests/workspace.test.js`
- `src/web/app.js`
- `src/web/delivery.js`
- `src/web/model.js`
- `src/web/styles.css`
- `src/web/tasks.js`
