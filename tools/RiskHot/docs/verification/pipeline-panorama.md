# 流水线全景页面实施与验证

- 日期：2026-10-27（上海时间）。
- 状态：工程实现与本轮验证完成，本机常驻服务已重载。
- 页面：[流水线全景](http://localhost:18081/pipeline)，位于“配置”分组，与信源管理中心同级。
- 实施依据：[[tools/RiskHot/docs/superpowers/plans/2026-10-27-流水线全景页面开发|已确认实施计划]]与[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/流水线全景交互原型.html|现行可执行原型]]。

## 1. 实现结果

新增独立全景页面，沿用原型的画布、配色、字号、布局、分支连线及分型详情。115个稳定节点、全部条件出口、恢复关系、跨层依赖与编号和原型机械比对一致。L0～L3默认展开、F01～F08默认收起，M为独立横向治理区；首次进入没有隐藏的选中节点。

F01保留六步及独立的保存／交付恢复，F02保留七业务步骤和内部程序、AI、校验动作。共享出口只保留一个实体节点；跨模块定位自动展开目标层及模块。桌面6:4布局、详情独立滚动，手机详情与“返回当前步骤”可往返。

AI节点保留四个信息标签及默认收起的提示词区。任务阅读按固定任务编号与版本定位，无效版本明确提示。打开任务再返回保留全景DOM、模块开合、选中节点、提示词开合和滚动位置。

本页面不发送业务写请求，不触发采集、模型调用或流程执行。正式管理入口与文档来源均为同源地址，保留原有CSP和静态资源白名单。文档通过12项明确清单读取，正文转义、章节定位，不开放任意仓库路径。

## 2. 原型适配与内容差异

| 项目 | 工程处理 | 原因与边界 |
| --- | --- | --- |
| 产品导航 | M1、事件页及全景页在“配置”组增加全景；保留“内容／全部” | 用户明确指定配置分组，沿用正式应用已确认导航；不复制原型的未实现模块入口 |
| 外壳 | 移除角色模拟与原型演示页脚，显示正式配置面包屑及只读说明 | 预览角色不是鉴权；页面仍遵循实际应用的同源与身份边界 |
| AI任务跳转 | 本页固定版本只读任务地址，返回保留全景上下文 | M3尚无正式管理页，本轮不开发策略管理或发布 |
| 节点配置 | 描述列表与只读引用 | 不复制原型其他模块中禁用的编辑表单及执行按钮 |
| F02概念 | 从当前F02功能文档引用Event、Fact、Target与直接变量原文 | 原型EventUpdate定义已经过时；只同步概念区，115节点与流向保持原型 |
| 提示词 | 从当前文档生成5项展示副本，保留草案状态与未绑定说明 | 原型副本仅2项且检查未同步；不手改提示词正文、不发布执行版本 |
| AI引用与版本 | 展示对应业务蓝图的固定任务引用 | 不将演示策略的生效／草稿版本当成正式运行版本 |
| 来源文档 | 有限同源文档清单，安全转义原文并保留章节锚点 | 原型本地相对文件链接无法直接用于产品地址 |

原型快照摘要见[[tools/RiskHot/docs/verification/pipeline-panorama/prototype-baseline.json|原型基线清单]]。当前原型文件未修改。开发期间F02功能文档被其他工作更新，已重新生成工程展示副本并再次通过同步与数据检查。

流程定义与下游模块实际运行能力分别验收；保留原型节点中尚未批准的业务规则、Schema和方法说明，不宣称L1～L3已实现运行。全景画布其余文案沿用指定原型，不将原型的表达字段冒充实际运行数据库契约。

## 3. 验证结果

| 检查 | 结果 | 证据与范围 |
| --- | --- | --- |
| 完整自动化回归 | 233项通过，0失败 | [[tools/RiskHot/docs/verification/pipeline-panorama/regression-summary.json\|回归摘要]]，包含新增数据／页面／路由检查 |
| 类型检查 | 通过 | `npm run typecheck`，含同步工具及两项浏览器验证脚本 |
| 工程展示副本同步 | 通过 | `npm run pipeline:check`，115节点、16任务、5提示词、12来源文档 |
| 任务职责原文 | 5项通过 | 现有任务定义引用脚本 `--check`；未修改原型生成文件 |
| 数据与静态页面 | 6项通过 | 全量节点及后继／汇合依赖比对、Fact原文、提示词来源、逐节点详情、配置分组、无编辑与内联样式 |
| 页面与文档路由 | 2项通过 | 全景资源、12文档、安全头、非法路径及原有M1身份检查 |
| 全景浏览器 | 22组检查通过，115节点逐一打开 | [[tools/RiskHot/docs/verification/pipeline-panorama/results.json\|全景专项结果]]；0页面错误、0异常请求 |
| 桌面与手机对照 | 9种宽度通过 | 1440／1024／901／900／768／761／760／390／320；画布位置与宽度差均为0px，F01节点字号／配色／背景／内边距／圆角与原型一致 |
| M1浏览器回归 | 56项通过 | 运行现有 `src/tests/browser.e2e.ts`；未修改其业务断言 |
| 事件页浏览器回归 | 18组通过 | 运行现有 `src/tests/events.e2e.ts`；阅读状态、分页、详情返回与失败恢复均通过 |
| 本机实际页面 | 9组通过 | [[tools/RiskHot/docs/verification/pipeline-panorama/real-results.json\|实际运行验收]]；1440／390／320下直接进入、AI任务往返及M1／事件页配置入口；只读，0错误、0异常请求 |

全景专项包括：层与模块独立折叠、默认状态、全部节点详情、跨模块展开、F01待处理与交付恢复、AI四标签及键盘切换、提示词开合保留、固定任务直达和刷新、无效版本、资料加载失败、12份来源文档、九宽度全模块展开、F01主线/分支两列与连线生成、手机返回焦点，以及三页配置入口往返。

首次专项的桌面用例曾尝试点击仅手机显示的“返回当前步骤”，已将该断言限定至760px及以下。之后隔离测试服务的本机鉴权来源与账号权限配置不完整，已修正测试夹具；未放宽正式鉴权。修正后的专项、既有浏览器回归及实际服务验收均通过。

## 4. 视觉证据与设计检查

- [[tools/RiskHot/docs/verification/pipeline-panorama/product-1440.png|桌面全景]]与[[tools/RiskHot/docs/verification/pipeline-panorama/prototype-1440.png|原型桌面全景]]。
- [[tools/RiskHot/docs/verification/pipeline-panorama/product-390.png|手机全景]]与[[tools/RiskHot/docs/verification/pipeline-panorama/prototype-390.png|原型手机全景]]。
- [[tools/RiskHot/docs/verification/pipeline-panorama/f01-1440.png|桌面F01]]与[[tools/RiskHot/docs/verification/pipeline-panorama/prototype-f01-1440.png|原型桌面F01]]。
- [[tools/RiskHot/docs/verification/pipeline-panorama/f01-390.png|手机F01]]、[[tools/RiskHot/docs/verification/pipeline-panorama/detail-390.png|手机AI详情]]、[[tools/RiskHot/docs/verification/pipeline-panorama/detail-1440.png|桌面AI详情]]。
- [[tools/RiskHot/docs/verification/pipeline-panorama/real-1440.png|本机实际页面]]；320px截图及其他状态位于同一证据目录。

采用Impeccable，实际查看桌面全景、手机全景和手机AI详情截图。机械扫描见[[tools/RiskHot/docs/verification/pipeline-panorama/design-scan.txt|扫描记录]]：提示HTML中的绝对样式地址无法按本地文件映射解析，因而“字号层级不足”不能作为实际计算样式结果；另提示复制样式中的历史页签3px下边框，该规则实际圆角为0且全景未使用该旧页签。保留原型视觉，不为扫描提示改版。实际字号、配色、布局和溢出以浏览器测量及截图为准。

原型与正式侧栏、面包屑、演示页脚、任务引用内容及当前文档正文存在本节已说明的差异；没有宣称整页所有像素及历史文档内容完全相同。浏览器均使用独立Chrome for Testing与任务临时目录，结束后关闭并清理。

## 5. 文件与维护入口

- 页面：`src/web/pipeline.html`、`pipeline.js`、`pipeline-state.js`、`pipeline-view.js`、`pipeline-layout.js`、`pipeline.css`。
- 只读资料：`src/web/pipeline-data.js`、`pipeline-tasks.js`，由 `src/scripts/sync-pipeline.ts` 生成；`src/data/pipeline-documents.json`维护有限文档映射。
- 运行层：`src/runtime/web.ts`、`pipeline-documents.ts`；文档样式在 `src/web/pipeline-document.css`。
- 导航：`src/web/index.html`、`events.html`。
- 验证：`src/tests/pipeline-data.test.js`、`pipeline-ui.test.js`、`pipeline.e2e.ts`、`pipeline-real.e2e.ts`及`web-routes.test.ts`。
- 维护：`package.json`、README、AGENTS、实施计划、项目索引及日志。

节点详情与画布展示共用 `pipeline-view.js`，避免重复节点与任务上下文；本计划原拟单独的 `pipeline-detail.js`未创建。展示函数沿用原型，数据生成与交互控制各自独立；无前端框架、图形库或新外部服务依赖。

修改原型或来源文档后运行 `npm run pipeline:sync`，再执行 `npm run pipeline:check`、`npm run test:pipeline`和适用浏览器检查。同步脚本不改原型或业务文档；文档发生后续修改时，同步检查会明确失败，来源页也会提示展示副本待同步。
