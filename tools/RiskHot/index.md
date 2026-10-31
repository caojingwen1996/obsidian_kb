# RiskHot 项目文档索引


## Worker调度技术架构（2026-10-30）

- [[tools/RiskHot/docs/system-design/04-系统架构设计/02-专题技术架构/T03-任务编排与可靠性架构|Worker调度与任务执行架构 V1.0]]：采用pg-boss业务Job交接，按业务队列限并发，复核后入队续办；技术设计已重构，代码仍为Temporal。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/S01任务执行数据契约|S01任务执行数据契约]]：运行登记、投递关联与周期扫描分工。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构决策记录/ADR-L0-003-业务任务队列替代Temporal|架构决策]]及[[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构验证/Worker任务队列切换验证方案|切换验证方案]]：旧执行退出与回退规则、20项待执行验收。

## 阶段工作与文档导航

- [[tools/RiskHot/AGENTS#3. 阶段工作规则|阶段工作规则与文档目录]]：按功能设计、原型设计、技术架构设计和工程开发列出文档目录、作用、阅读依据及产物位置，区分原型与实际工程验证证据。

## 共享数据

- [[tools/RiskHot/src/data/source-catalog.js|信源清单]]：40条信源的名称、网址、等级、分组与关注内容，统一在 `src/data` 维护。
- [[tools/RiskHot/src/data/source-demo.js|信源演示配置]]：原型使用的分类、启停及接入预设、示例关系，与信源清单分开维护；使用方式见[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/02. 交互原型说明|M1 原型说明]]。

## 来源到事件候选：工程实现

- [[tools/RiskHot/docs/verification/task-workspace-groups|信息采集任务三个子分组]]：计划设置、手动发起、执行记录统一归属任务页，顶部取消手动任务，详情左上角统一“返回”，顶部追加事件处理任务空白页；隔离15组和实际只读7组检查通过。

- [[tools/RiskHot/docs/verification/source-financial-classification|信源金融属性分类分析]]：38条已按数量／价格／流向完成分类，2个博主待确认；逐条理由与实际应用证据。

- [[tools/RiskHot/docs/verification/source-financial-attributes|信源金融属性独立字段]]：m1.sources新增financial_attributes多值列，兼容既有分类接口；增量迁移保留40条信源及已有任务资料。

- [[tools/RiskHot/docs/verification/source-catalog-boundary|信源目录与任务边界]]：目录移除任务内容与接口依赖，检索和四个视图切换合并一排；计划入口和页面路由归属信息采集任务，旧地址自动跳转，含桌面及移动验证。

- [[tools/RiskHot/docs/verification/research-view|专题研究实际目录修复]]：固定钱的数量／价格／流向与待分类，真实40条分类缺失明确显示；实际只读浏览器4组、回归15组通过。
- [[tools/RiskHot/docs/verification/inline-plans|信源列表行内任务计划]]：历史实现曾在目录与计划列表同时提供控件；现仅在任务计划页保留，支持并发与原键恢复保护。
- [[tools/RiskHot/docs/verification/source-groups|信源目录分组恢复]]：恢复四种既有分组方式，复用原层级与多标签去重规则，12组浏览器检查通过。
- [[tools/RiskHot/docs/verification/source-grades|信源目录等级修复]]：独立等级列与等级筛选恢复，40条等级数据不变，11组浏览器检查通过。
- [[tools/RiskHot/docs/verification/ingestion-migration|F01 schema5迁移验收]]：本机已保留40条信源并重建其余应用表，23项集成、10组浏览器、真实Temporal及实际央行采集抽取通过；完整回归276/279，三项既有失败单列。

- [[tools/RiskHot/docs/superpowers/plans/2026-10-27-事件列表时间线重构|事件列表时间线重构计划]]：已按批准规格实施；按72小时规则、同版本来源依据和异常降级分组，包含真实来源、完整description、分页与阅读状态恢复。
- [[tools/RiskHot/docs/verification/event-timeline|事件列表时间线验证]]：17项页面/时间专项、7项API、215项回归、隔离浏览器18组场景、真实只读页面与1440/390/320截图；记录规模及偏移分页边界。
- [[tools/RiskHot/src/web/events.js|事件管理页面]]：正式事件详情左上角提供“返回事件列表”，支持直接打开详情后的列表导航。
- [[tools/RiskHot/docs/verification/fact-model|F01/F02 Fact模型实施与验收]]：当前 schema4；新表、接口、文件与页面，真实迁移和下游读取证据及未完成能力。
- [[tools/RiskHot/docs/superpowers/plans/2026-10-27-F01-F02-Fact模型实施|Fact模型实施计划]]：七项改造顺序与范围。

- [[tools/RiskHot/docs/superpowers/plans/2026-10-27-F02事件管理Step2至7|F02 Step 2～7 实施计划]]：已实施；186项回归通过，第一条真实候选正式保存/交付、3次重投及重启验收通过，整份资料1/2部分完成。
- [[tools/RiskHot/docs/verification/f02-events|F02 事件处理实施与验证]]：实际三项业务复核、5类真实模型证据、正式事件/交付/回执文件及页面状态；第二条隔夜操作仍待身份复核。
- [[tools/RiskHot/docs/superpowers/plans/2026-10-26-标准化资料交付与候选接收闭环|标准化资料交付与候选接收闭环实施计划]]：已确认并实施；交付文件、固定版本、回执、独立恢复和页面入口已完成，真实人民银行资料形成2条候选；见[[tools/RiskHot/docs/verification/information-handoff|本轮118项回归与真实验收]]。
- [[tools/RiskHot/docs/verification/m1-management|M1 实际管理与任务控制]]：在 main 按原型实现信源档案、全部启用信源一键开启、批次暂停/继续及分钟／小时／天计划；本机默认免登录，包含接口、浏览器、代码审阅与后台迁移证据。
- [[tools/RiskHot/docs/verification/codex-subscription|Codex 订阅闭环与后台运行]]：真实央行公告形成2条已校验候选，定时与重复获取复用同一资料/候选；后台计划、安静异常提醒及真实证据入口。
- [[tools/RiskHot/docs/verification/all-sources|全部信源接入阶段验证]]：40条状态明确，26条真实入库、6条待补地址、8条受阻；保留该阶段41项测试与模型待配置的历史证据。[[tools/RiskHot/docs/verification/all-sources.json|逐源证据清单]]保留范围、运行及原件摘要。

- [[tools/RiskHot/README|启动与操作说明]]：独立 TypeScript/PostgreSQL/Temporal/OIDC 工程，实际 M1 页面、40条来源状态、26个实际采集范围及API/CLI监测。
- [[tools/RiskHot/docs/superpowers/specs/2026-10-24-source-to-candidates-design|已批准设计]]与[[tools/RiskHot/docs/superpowers/plans/2026-10-24-source-to-candidates|实施计划]]：EXTRACTION_ONLY 候选范围；订阅执行承接[[tools/RiskHot/docs/superpowers/specs/2026-10-24-codex-subscription-design|扩展设计]]及[[tools/RiskHot/docs/superpowers/plans/2026-10-24-codex-subscription|扩展实施计划]]。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/04-公共技术契约/来源候选切片实现契约|当前实现契约]]与[[tools/RiskHot/docs/verification/codex-subscription|当前执行验证]]：来源到AI-01候选的真实最小闭环已取得证据，完整L0未验收。

## 当前UI统一规则

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/信息接入任务与计划页面设计#六步进度暂时移除|六步进度展示调整]]：任务采集记录与资料详情暂不展示阶段推算进度，保留状态、异常、资料操作和运行编号。

- [[tools/RiskHot/docs/superpowers/plans/2026-10-27-流水线全景页面开发|流水线全景页面开发计划]]：已按用户确认实施，入口位于“配置”分组；保留115节点原型，记录正式导航、提示词展示副本和Fact概念口径的适配。
- [[tools/RiskHot/docs/verification/pipeline-panorama|流水线全景工程验证]]：233项回归、22组全景浏览器、56项M1及18组事件浏览器通过；九宽度画布对照及本机三宽度只读验收通过，含截图和差异清单。 2026-10-28 增加提示词按请求读取：17项专项、8项隔离浏览器及真实服务读取验证通过，运行任务包保持独立。

- [[tools/RiskHot/docs/verification/m1-navigation#8. 2026-10-27 · 信息采集任务列表与独立详情|信息采集任务列表与详情验收]]：列表一行一次任务，详情展示来源采集信息；223项回归、56项M1浏览器及真实25源整轮验证。

- [[tools/RiskHot/docs/verification/m1-navigation#7. 2026-10-27 · 目录模式宽度一致性修复|目录模式宽度一致性验证]]：档案与任务计划共用外层容器，五种宽度真实测量及截图。

- [[tools/RiskHot/docs/superpowers/plans/2026-10-27-M1页面整合与导航调整|M1页面整合与导航调整计划]]：已确认两工作区与“内容/配置”常驻菜单分组；计划归入目录任务计划表、执行记录统一，包含旧链接兼容和14项验收要求；已实施，见[[tools/RiskHot/docs/verification/m1-navigation|222项回归、56项M1浏览器及真实页面验证]]。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/信息接入任务与计划页面设计|接入任务与计划页面设计]]：紧凑概览、行内结果、计划运行记录及直达资料/候选；一键开启后持续展示运行状态与真实进度，进行中锁定开启，暂停／继续、刷新恢复及结束摘要按生命周期切换。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/标题区域设计规范|标题与操作区设计规范V1.1]]：导航与操作按职责分开；M1目录操作位于列表标题行，M2/M3页面与页签操作位于正文独立工作区操作栏，弹窗／抽屉操作进入自身标题行。最新验证见[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/工作区操作栏优化记录|M2/M3工作区操作栏优化记录]]。

## 业务架构与领域设计

- [[tools/RiskHot/docs/audit/数据模型与领域对象一致性检查-2026-10-31|数据模型与领域对象一致性检查]]：以 L0 当前十一类对象及关联为准核对六份现有存储文档，修订客体承载、变量来源/关联、评价用途、资料元信息与依据约束；区分已一致、已修订和待设计，列明观测精确证据及结果载体等缺口。仅完成文档检查，不代表数据库验收。


- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02变量观测记录数据模型与存储设计|F02 变量观测记录数据模型与存储设计]]：V1.2，保持16列观测主表、取值/时间/快照及更正约束；明确十项属性中的取值来源和原文证据精确映射仍缺失，不能以关联事实集合代替逐条观测依据。尚未实施。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/M2风险变量数据模型与存储设计|M2 风险变量数据模型与存储设计]]：V1.6，risk_variable_definitions覆盖十一项核心属性，变量名称字段为name，discovery_sources记录四类事件发现来源并支持多选，semantic_category采用五类单选语义编码，删除interpretation和applicable_scope，分别维护四态status、定义版本及创建/更新时间，明确版本快照、约束、名称检索及DDL；物理schema待定，尚未实施。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#4.3.9 VariableObservationrRecord（事件变量观测记录）|事件变量观测记录]]：按七部分定义观测属性、关系、业务规则、职责、示例和约束；区分事件时间与取值时间、取值变化与数据更正，保留多次观测及证据。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#4.3.11 Fact（事实单元）|Fact 领域对象]]：跨报道统一表征同一次具体发生，多个 material 经核定复用一个 Fact；保留多对多来源关系与各来源原文依据，可先于 Event 归组保存。Fact 复用与 Event 归组分开，报道冲突不自动产生新身份。
- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#4.3 领域对象详细定义|L0 领域对象详细定义]]：十一类对象按定位、逻辑业务属性、关系、职责边界、领域归属统一编写；Event核心属性已移除事件时间语义，事实描述与语义信息统一由event.description承载，来源关联统一为FactMaterial，Event来源经Fact派生，不保留独立EventMaterial或EventFact对象；变量关联与具体观测分别定义；核心业务属性表增加建议字段列，已设计字段注明承载位置，信源字段使用sources.*；物理结构引用数据模型设计，不确定内容留空。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#4.2 领域对象关系模型|L0 领域对象关系模型]]：按§4.1十一类对象更新UML、聚合归属与基数，区分对象关联、三元变量关联与多次观测，补齐观测证据及历史追溯；Fact 为独立实体，FactMaterial 随 Fact 管理多对多来源；正式事件至少有一个有效 Fact，事件归属直接保存在 Fact，对象、变量、观测和评价经本事件 Fact 追溯来源。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#3.2 Event 定义与识别边界|L0 Event 定义与识别边界]]：明确事件业务定义、Subject／Action／Time识别基础、Object辅助判断、八项归组规则及后续Target与风险变量关系。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计#6.1 本次事件的变量提取结果（逻辑字段约定）|本次变量提取结果]]：数据模型保留既有五字段逻辑约定，extraction_source随提取结果记录；按新风险变量定义的语义对齐待完成。

- 变量业务规则：[[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#3.4 风险变量（Risk Variable）的定义|L0变量定义与来源]]按六部分定义风险变量，以Target为核心，经Object解析、对象标准化、变量识别与定义形成特定对象和时间下的变量取值；包含概念边界、信用评级示例及阶段定位。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/业务架构总览|业务架构总览]]：参考 AIHOT 任务拆解结构，汇总 RiskHot L0—L3、八个核心模块、三个支撑中心和16项AI任务；包含总体架构、任务依赖、对象交接、策略与运行边界、端到端案例及待定事项。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0|L0 信息处理层]]、[[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L1_风险识别与纳管层_业务架构与领域设计|L1 风险识别与纳管层]]、[[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L2_风险态势分析层_业务架构与领域设计V1.0|L2 风险态势分析层]]、[[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L3_风险产品与发布层_业务架构与领域设计 V1.0|L3 风险产品与发布层]]：第五章统一为“业务接口”；第六章统一为“AI 业务设计”，6.1先列AI任务清单，再逐项定义任务编号和触发条件，输入输出细化为字段表、分析职责展开为有序步骤，注明字段来源与待定状态；6.2按分析证据、结果校验、异常人工处理三类约束组织，保留16项任务及原有待定事项。 L0现只保留业务对象、业务关系与属性/业务含义/业务规则示例；Fact与唯一Event的表结构集中于F02数据模型文档，其他层本轮只同步事件输入口径。

## 系统功能架构

- [[tools/RiskHot/docs/verification/pipeline-f02-20261031|F02 流水线八步同步验证]]：按已审核功能设计同步31个F02节点，校正AI职责、变量取值及关联、金融意义独立文档、保存后独立交付和事件关联；真实页面与回归检查见记录。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/金融意义|金融意义]]：从 F02 原 Step 6 独立拆出，集中保存金融意义评价、五维规则、初评/复评、异常恢复、输出验收及金融用途分类；原模块保留流程交接，规则发布与运行接入状态不变。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0#4.6 Step 5：风险变量识别、取值与关联|Step 5 风险变量处理]]：2026-10-31 对齐 L0 §3.4；从事件要素及语义识别、标准化、取值并关联对象与证据，Target 确认不是识别前提；定义与具体值分离；AI-05 完整任务与提示词 V0.1 草案已编写，数据契约及运行适配待完成。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0#4.5 Step 4：事件增量识别|Step 3/4 职责分工]]：实例融合唯一决定 NEW/REUSE；Step 4 对 NEW 确认初始事实、对 REUSE 识别五类增量，待确认独立为处理状态；已同步 L0 相关定义、AI-03 草案与独立正文，运行契约待适配。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0#4.1 总体流程|F02 八步业务流程]]：Step 5 变量与直接关系、Step 6 业务评价、Step 7 事件保存、Step 8 事件间关联；事件交付与关联分析独立推进，关联快照独立保存。


- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-05 从事件提取风险变量|AI-05 从事件提取风险变量 V0.1]]：依据 L0 风险变量定义补齐任务、逻辑输入输出与四层提示词；涵盖多要素发现、定义匹配、逐对象/时间/性质取值、证据与待关联，含20项待执行验收；机器契约、运行适配及模型评测待完成，未发布。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-03 Event增量识别|AI-03 事件增量识别 V0.6]]：采用AI-01式四层章节，逐项分类与主分类汇总集中于增量分类规则，聚焦候选事件六要素的有证据差异，事实增量先行、变量关系后续；六字段输出分开表达处理状态、初始事实与五类增量及变量方向、幅度、持续性，移除Nature和证据输出字段，程序应用字段补丁，含50项待执行验收场景。另一版保留历史原文；运行编号、Schema和编排待适配，未发布。

- [[tools/RiskHot/src/prompts/01.knowledge-extraction|01. 知识抽取提示词正文]]：复制自[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-01 候选事件提取|AI-01 候选事件提取]]第 3 节 V0.3 正文，作为独立提示词文件保存。
- [[tools/RiskHot/src/prompts/02.event-identity-judgment|02. Event 同一性判断提示词正文]]：与[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-02 Event同一性判断|AI-02 Event 同一性判断]]第 3 节 V0.4 正文同步，采用 AI-01 式四层 Markdown 章节。
- [[tools/RiskHot/src/prompts/03.event-delta-detection|03. Event 增量识别提示词正文]]：复制自[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-03 Event增量识别|AI-03 Event 增量识别]]第 4 节 V0.6 完整四层正文，作为独立提示词文件保存。
- [[tools/RiskHot/src/prompts/04.event-association|04. Event 关联提示词正文]]：与[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-04 Event关联|AI-04 Event关联]]第3节V0.1同步，按五维识别事件集合及连续性，保留反向与分化信号。

M1信息采集默认执行概览每个独立计划的信源一行；手动开启与本轮进度移入独立“手动任务”页面，手动历史不混入自动执行；批次详情逐份展示资料采集情况。重复页名与介绍版块已移除，见[[tools/RiskHot/docs/verification/m1-navigation#12. 2026-10-28 · 移除重复页标题与介绍|最新页面验证]]。资料级数据库目标仍待迁移。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-01 候选事件提取|AI-01 候选事件提取提示词 V0.3]]：第 2 节输入输出语义与第 3 节四层 V0.3 全文已同步，第 1/4 节交接表述已对齐；外部 Fact 设计、Schema 及运行任务包仍待适配和验证，未发布。 2026-10-31 已同步 Step 2 AI 候选识别、Step 3 身份融合的交接说明，本任务仍只抽取事实及初步对象线索。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-08 Target候选识别|AI-08 Target 候选识别 V0.1]]：Step 2 独立任务与四层提示词草案，含逻辑输入输出、候选/排除/未决及覆盖、程序接纳与 AI-07 交接、17项待执行验收；编号为 AI-08，机器 Schema、运行接入及模型评测待完成，未发布。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-07 Target同一性判断|AI-07（Target 同一性判断）]]：V0.2，Schema、逐对象运行与人工核定已实现，真实原文10个对照场景通过；新包显式选择，正式库未部署。 上游交接已对齐 Step 2 的 AI 候选识别目标；现有评测不覆盖新增识别任务及其新链路。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-02 Event同一性判断|AI-02 Event 同一性判断 V0.4]]：采用四层结构；2026-10-30 证据统一 material 身份/版本值/内容摘要，运行契约待适配；保留 F02 Step 3 定位、NEW/REUSE/UNRESOLVED、完整证据及逐项比较、检索与人工复核边界；设计草案，未替换运行任务包。
- [[tools/RiskHot/docs/audit/AI-02提示词全文复查记录-2026-10-30|AI-02 全文复查记录]]：以 F02 当前功能设计为主，记录 4 项审计发现及 2 项边界建议；A02-02 的提示词/示例与技术交接已统一 material，独立正文已同步；运行契约迁移仍阻断发布，保存旧称和程序交接缺口待修正。
- [[tools/RiskHot/docs/audit/Target单表定稿后的AI任务与流程一致性审查-2026-10-30|Target 单表定稿后的 AI 任务与流程审查]]：记录新建定义准备、召回覆盖、逐对象交接及零候选措辞4项待明确问题，并汇总已知任务编号与步骤同步缺口；保留已定稿表结构，本次仅审查，未修订提示词或运行流程。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-03 观测主体与变量识别提示词 V0.1|AI-03 观测主体与变量识别提示词 V0.1]]：M3-C02 管理的 F02 Step 3 提示词草案，覆盖观测主体、直接变量、定义候选、版本化证据与异常交接；未发布，未覆盖 AI-03@1.0。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-04 Event关联|AI-04 Event关联 V0.1]]：围绕同一事情或演化过程组织独立Event，按变量、方向、驱动、主体和时间窗五维判断；区分同步、连续、转向和未知，含22项验收场景。首版规则建议及机器契约待确认；未替换旧AI-04增量运行任务。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-05 金融意义评级提示词 V0.1|AI-05 金融意义提示词 V0.3]]：依据业务架构重写候选五维文字分析、用途标签与初评/复评规则；已同步代码并记录提示词修订，量化规则未批准，真实模型评测待完成。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/0.系统功能架构总览|系统功能架构总览]]：V3.1，四阶段、八核心模块、三业务支撑中心及S01公共运行模块；65项功能追踪、11个架构验收建议场景，明确S01执行、F01接入与监测汇聚、M1抓取任务入口及数据主责；技术实现见系统总体架构。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/F01 信息接入与标准化模块功能设计 V2.1|F01 信息接入与标准化模块功能设计 V2.1]]：V2.2目标；一源一计划、单信源任务、material及版本字段，无原件、四类独立记录或公共支撑对象；路径沿用V2.1，工程未迁移。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/F01修改清单-2026-10-29|F01聊天修改清单]]：主设计、代码、SQL及本机一天计划已落实；仅保留专题文档整理和历史个案异常证据核实。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0|F02 事件管理模块功能设计]]：V1.14；九类二级功能、10项末级功能、八步流程及124项验收编号。Step 2 由程序映射 Fact → Event，AI 基于 Object 和事实语境识别 Target 候选并经程序校验；Step 3 的 AI-02/AI-07 分别比较事件/对象身份。§4.3 明确识别输入输出、证据与覆盖、空结果/未决/执行失败、重试及十项边界场景；新识别任务的独立文档及提示词 V0.1 草案已编写；编号为 AI-08，机器 Schema、运行接入和评测待完成。页面设计仍由独立文档维护。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/F02事件管理页面设计与交互|F02 事件管理页面设计与交互]]：独立维护九节页面与交互设计，承接功能设计原第5章；区分现行页面、待实现复核与新增结果查询，保留原验证依据。
- [[tools/RiskHot/docs/system-design/03-系统功能架构/风险产品与交付模块功能设计 V1.0|风险产品与交付模块功能设计 V1.0]]：结合 V3 交互原型与用户风险卡片结构图，细化 F07/F08 六组能力、23项功能与32个验收建议；覆盖对象卡片、演化、来源双向关联、历史快照及报告发布，保持两入口免配置。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/S01 公共运行能力功能设计|S01 公共运行能力功能设计]]：V1.3去业务化目标；通用执行、触发、幂等、恢复、告警和审计，业务计划与采集对象归F01。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/M2风险源管理中心功能设计|M2 风险源管理中心功能设计]]：参照 M1 十章结构，依据最新 L1 全局变量体系形成 6 组能力、20 项功能、27 个建议验收场景；覆盖风险源、变量候选治理、指标映射、风险类型及版本追溯，明确不预配置推荐变量、实际数据归 L0，保留 11 项待定事项。 首版移除 M2-F18 使用关系查询，AC-M2-22 转后续版本；原编号保留。

## AIHOT 参考资料

- [[tools/RiskHot/aihot/aihot_prompts/README|AIHOT 提示词分组导航]]：依据分析文档第 2 章，将 29 份提示词按基础约束、预筛评分、事实抽取、内容写作、事件关系归组、事件综述与报告六组组织，保留原文。

## 产品 UI 设计

- [[tools/RiskHot/aihot/趋势动物产品用户手册|趋势动物产品用户手册]]：公开资料版V1.0，含快速上手、温度与相对强度解释、列表和趋势图阅读、历史实例及常见问题，明确端内未实测范围。
- [[tools/RiskHot/aihot/趋势动物产品用户手册.docx|趋势动物产品用户手册 Word图解版]]：V1.2，12张图分布于对应章节，含4张历史真实截图与8张教学示意图，明确类型、来源及假设数据。

- [[tools/RiskHot/aihot/趋势动物产品报告与RiskHot设计借鉴|趋势动物产品报告与 RiskHot 设计借鉴]]：公开功能与界面截图分析、数据解释边界、与 RiskHot 量化方案对照，以及设计建议和实施优先级；保留资料日期与来源。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-5 产品交付页面设计构思/一般阅读者产品设计|一般阅读者产品设计]]：仅“风险速览／观察报告”两入口，连续风险解读、按需证据与报告当期阅读；移除个人关注和配置负担，离线原型及验证在同目录。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-5 产品交付页面设计构思/量化信号决策辅助产品设计|量化信号决策辅助产品设计]]：风险排行与趋势联动、决策含义与证据、报告当期快照；独立离线原型，保留一般阅读者版。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-5 产品交付页面设计构思/量化信号决策辅助产品设计V2|量化信号决策辅助产品设计 V2]]：增加状态表达、重要变化与自身历史位置；免配置、两入口，保留 V1 与一般阅读者版。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-5 产品交付页面设计构思/量化信号决策辅助产品设计V3|量化信号决策辅助产品设计 V3]]：加入稳定风险观察对象、演化脉络与风险源双向关联；两入口、免配置，历史报告保持当期快照，保留 V2。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-5 产品交付页面设计构思/量化信号决策辅助产品设计V4|量化信号决策辅助产品设计 V4]]：补齐核心驱动变量、变化原因与下一步观察重点；变量证据可展开，原因可定位依据；两入口免配置，保留 V3 与历史报告时点。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/全任务输入输出补充记录|M3 全任务输入输出补充]]：依据L0～L3补齐16项任务312行输入和151行输出、来源与待定状态，替换通用Schema为逐任务字段片段；393项专项及既有回归通过，完整运行包装与未定规则继续保留待定。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/全任务提示词补充记录|M3 全任务提示词补充]]：按AIHOT第6章方法及RiskHot L0～L3定义补齐剩余15项任务用途、专属指令和来源；五标签共用固定定义，217项全任务、24项AI-01、102项内嵌和93项原交互通过。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI01提示词补充记录|M3 AI-01 提示词补充]]：依据L0 §6.1.1增加Prompt用途与六步专属指令，保留五标签及候选交付边界；24项专项、102项内嵌和93项原交互通过，Schema仍为示例。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI节点配置分区验证记录|M3 AI节点配置分区]]：输入输出定义集中在Tab，节点映射与流向独立折叠、默认收起；102项AI专项、93项原有交互、60项其他节点和11组非AI像素对比通过。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/节点详情精简验证记录|M3 全类型节点详情精简]]：程序、条件、人工、开始/结束和模块节点统一简洁详情，关键配置与流向保留，文档按需展开；60项专项、87项AI回归和93项原有交互通过。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌验证记录|M3 AI任务内嵌详情]]：流水线节点原地查看 C02 固定版本五标签，保留节点配置与独立滚动；详情已精简重复说明；87项专项、93项原有交互、11项非AI像素对照通过。

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/DESIGN|M1／M2／M3统一UI规范V2.1]]：三中心共用导航、排版、控件、角色色与响应式规范；[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心UI重构记录|三中心UI重构与验证记录]]包含修改清单、业务保护及37张截图。 最新57px紧凑标题规范及复验见[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心紧凑标题记录|三中心紧凑标题与业务保护]]。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/标题区域设计规范|标题区域设计规范V1.0]]：57px顶栏、14px模块名、20px任务/弹窗标题及响应式、角色分层规则；[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/标题区域全页面检查记录|全页面标题检查]]记录M1→M2→M3的逐页验收与修正。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/00. 阅读导航|流水线全景 UI 设计]]：独立全景目录，集中设计、来源对照、原型和专属验证。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/流水线全景交互原型.html|流水线全景可点击原型]]：L0～L3、F01～F08、115个节点；F01六步与F02七步（26节点，程序与AI分工展开）、内部直连及分型详情已同步，保留固定AI任务与原C01策略。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/04.RiskHot 流水线节点视觉与编号规范|全系统流程节点规范]]：集中定义起点、步骤、判断、分支与终点的视觉和编号；当前为待评审建议稿。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/05.RiskHot_六类节点详情UI设计规范_V1.0|六类节点详情规范]]：定义节点内部逻辑、后继、依据与配置展示；F01四种实际节点类型已完成本地原型重构。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/验证/F02七步流程重构记录|F02七步原型与详情重构记录]]：F02七步流程、13节点详情与固定AI五标签、无事件及保存/交付恢复验证。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/00. 阅读导航|M1 信源管理中心 UI 设计]]：依据 M1 功能设计，现行原型采用三中心统一UI规范V2.1；保留页面与交互契约、历史图稿、需求对照及未决项。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/验证/L0任务监控验证记录|M1 · L0 信息接入任务监控]]：按计划时间统计接入批次，支持日期范围、批次状态、批次下多信源详情及开启/暂停/继续按钮；沿用浅色绿色风格，支持本地启停演示。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html|M1 信源管理中心可点击原型]]：40条在册信源、全部平铺与搜索筛选共用工具区、默认专题分组的单一目录、新增查重、编辑及两态启停（操作理由选填）与版本查看；25项本地交互验证通过，刷新重置演示数据。 新增与展开／收起已移至列表标题行，导航与操作分开；当前四视图直接展示全部匹配信源，已去掉加载更多；25项浏览器专项通过。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-3-M2风险源管理中心UI设计/00. 阅读导航|M2 风险源管理中心 UI 设计]]：现行原型采用三中心统一UI规范V2.1，包含视觉与交互契约、关键页面、功能对照及桌面／手机示意；共享定义与候选治理的边界明确；首版移除使用关系，保留实施待定项。 变量详情附字段标记，区分既有字段、原型扩展和界面计算。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-3-M2风险源管理中心UI设计/M2风险源管理中心交互原型.html|M2 风险源管理中心可点击原型]]：三个顶层目录及变量内观测指标（八类风险源、四类风险类型直接预置，无初始化入口）、候选单栏资料审核（已移除相似变量对照）、单页变量身份与表格内逐项指标审核、新指标定义独立审核及四种身份处理结果、指标口径与映射、新增定义弹框、草稿差异、历史版本与维护反馈（首版移除使用关系）；本地资源离线运行，刷新重置演示数据，201项本地交互检查通过，验证范围见模块记录。 页面操作已移出面包屑，归属正文独立工作区操作栏；两中心本次74项浏览器专项通过。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/00. 阅读导航|M3 策略管理中心 UI 设计]]：策略设计与管理、AI智能分析管理、策略评估三个工作区及23项功能对照；全景设计与原型已独立至06-1目录。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html|M3 策略管理中心可点击原型]]：六条版本化策略、16项AI定义、固定评估及案例对比；流水线全景通过同级入口进入独立页面，本地演示、刷新重置。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/00. 阅读导航|配置模块 UI 设计与原型入口]]：五类配置页面、视觉规范、详细交互、35条验收条件映射及可点击原型。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/验证/原型验证记录|原型验证记录]]：22项本地交互检查通过；信源已采用单一启停状态，保留独立技术就绪提示，含桌面及手机截图；不代表业务系统验收。

## 业务功能需求

- [[tools/RiskHot/03-业务功能需求/01. RiskHot_系统业务功能需求规格说明书_V1.0|业务功能需求总说明]]：总说明与十一份分册，53项功能、185条验收条件；现有51项功能和157条验收条件保留。
- [[tools/RiskHot/03-业务功能需求/02. RiskHot_配置模块功能需求规格说明书_V1.0|配置模块]]：信源、风险源、核心驱动变量、关键指标与风险类型五类业务配置。
- [[tools/RiskHot/03-业务功能需求/10. RiskHot_基础资料管理功能需求规格说明书_V1.0|基础资料管理]]、[[tools/RiskHot/03-业务功能需求/11. RiskHot_策略管理功能需求规格说明书_V1.0|策略管理]]、[[tools/RiskHot/03-业务功能需求/12. RiskHot_观测数据管理功能需求规格说明书_V1.0|观测数据管理]]：分别承接主体与展示分类、判断方法、实际数据；运行版本归运行管理分册。
- [[tools/RiskHot/03-业务功能需求/09. RiskHot_验收与交付管理_V1.0#5. 配置模块审计与迁移记录|配置模块审计与迁移记录]]：问题依据、原功能去向、六个待执行场景及实现差距。

## 系统架构

- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F01信息接入模块数据模型与存储设计|F01信息接入模块数据模型与存储设计]]：V2.2目标；保留infomation五张业务表及material版本字段，补齐metadata附件、内容覆盖与采用配置依据契约；既有schema5迁移与新增契约实施状态分开，新契约尚待适配。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计|F02 事件管理模块数据模型与存储设计]]：V1.11 按 L0 领域属性补齐 fact.object，移除三元关联中的变化结果字段和评价表对金融用途的必填要求，更新变量来源与类型、依据基数及迁移规则；保留 fact_material 多对多、Fact 直接事件归属及现有证据关系。新增目标尚未实施，提取/用途结果与精确观测证据契约仍待完成。

- [[tools/RiskHot/docs/superpowers/specs/2026-10-24-source-to-candidates-design|真实信源到事件候选的最小闭环实施设计]]：用户已选择真实信源与真实模型；范围为来源、获取解析、标准化、AI-01、保存及状态查询。候选模式与完整事件处理明确区分；已批准并实施，当前结果见[[tools/RiskHot/docs/verification/codex-subscription|订阅闭环验证记录]]。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构验证/系统架构文档完整性审查|系统架构文档完整性审查]]：按system-architecture-design V2.0.0核对总体视图、文档归属与质量门禁；记录补齐内容和未验证条件。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/大纲|系统架构设计文档大纲]]：按六类技术文档组织，新增模块数据模型与存储设计，模块详设在 L0 下归属 F01、F02，提供总览、专题、公共契约与治理入口。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/系统总体技术架构设计|系统总体技术架构（全系统与L0切片）]]：V0.7十四章总体架构；补齐技术运行单元、业务映射、数据流及公共契约索引；明确全系统约束、设计假设及待确认的生产条件；覆盖全系统上下文、L0～L3/M1～M3/S01组件与数据主责、运行/部署视图、跨模块机制、质量场景和需求追踪；L0已有详细设计分册，L1～L3继续细化；全部运行验收未执行。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构决策记录/ADR-L0-002-独立技术选型与设计基线|独立技术选型与设计基线]]：比较部署结构、语言、数据库、编排、存储与AI执行方式；从空环境建立，旧工程清单只保留历史意义。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构验证/L0最小业务闭环验证方案|L0最小业务闭环验证方案]]：五项硬性要求、8项补充场景和16个故障窗口；[[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构验证/架构验收报告/L0最小闭环验收报告_待执行|验收报告]]全部运行项待执行；决策与未决条件见[[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构决策记录/ADR-L0-001-最小闭环与正式提交边界|ADR-L0-001]]。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F02-事件管理/事件数据与状态设计#7.2 不同候选并发新建的集合校验|F02 并发新建事件协调机制]]：召回与共享集合协调标记绑定、提交时核对内容摘要、旧决定失效及Step 2恢复；配套并发与故障验证方案，尚未实施。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F02-事件管理/事件数据与状态设计#3.1 授权确认非事件与正常结束|F02 确认非事件与批次结束]]：授权复核、dismissed终态、NOT_EVENT回执与完整候选汇总；处置不产生正式事件或事件变化通知，运行验证待执行。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F01-信息接入与标准化/关键接口与数据设计#7. F01 复核与恢复契约|F01 独立复核与恢复]]：接入操作、复核案件/决定、保存回执及独立交付恢复；绑定依据、权限与有效代次，无须F02候选身份，运行验证待执行。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F01-信息接入与标准化/关键接口与数据设计#6.3.1 保存分支与当前版本指针|F01 保存分支与当前版本指针]]：新修订推进当前指针，复用/历史晚到保持指针，来源真实回滚建立新修订；同文顺序不明进入复核。
- [[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F01-信息接入与标准化/关键接口与数据设计#7.1.1 完整接入请求的持久化定义|F01 完整请求持久化]]：完整输入工件、三类摘要、202受理事务、重启读取和引用保护；只在工件持久可读且操作/回执/启动意图提交后受理。
- [[tools/RiskHot/aihot/归档/旧版系统架构设计/归档说明|旧版系统架构设计归档]]：9份旧文档已移入aihot，保留设计依据和L1～L3等历史内容；当前L0规范以新版总体技术架构为准。
- [[tools/RiskHot/aihot/归档/旧版系统架构设计/00. 系统总体架构|系统总体架构（历史技术参考）]]：V1.1 历史技术融合稿；本轮L0以新总体技术架构及分册为准，涵盖系统边界、功能技术映射、运行单元、通信与正式写入、运行恢复及部署演进；明确业务归属与技术包的待对齐项。

- [[tools/RiskHot/04-系统架构设计/RiskHot_系统架构设计_V1.0#5.1.1 信源配置的唯一写入方|信源配置的业务与技术归属]]：配置模块由 reference 唯一维护信源，L0 只读消费；架构清单与开发任务包已对齐，运行代码与数据库迁移待实施；信源业务准入已统一为启停（ACTIVE／PAUSED／DISABLED），技术就绪独立检查。

## 事件观测主体

- [[tools/RiskHot/docs/references/金融风险研究对象分类索引 V1.0|金融风险研究对象分类索引（项目内副本）]]：六大类与33个二级分类参考，正文和表格保留，来源知识库导航转为普通文字。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计#3.3 Target：分类目录与已收集观测对象|Target 分类与对象数据模型]]：V1.5 单一 Target 主表设计，取消对象业务编码；categories、aliases、scope_definition 分别保存分类、别名和范围，含三组范围示例；不设分类、别名或范围细分表，保留对象版本、快照及 Event—Target 关系，尚未迁移或导入。[[tools/RiskHot/docs/system-design/04-系统架构设计/05-架构治理与验证/架构决策记录/ADR-Target-001-分类目录与观测对象分离|Target 分类字段存储决策]]记录取舍。

- [[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-01 候选事件提取|AI-01 事件候选抽取]]：已完成全文业务规则复查；三要素字段统一为 subject/action/object，action 为具体行动文字；资料输入、输出及证据统一 material 身份/版本值/内容摘要；资料身份、字段映射和覆盖载体等发布阻断项见[[tools/RiskHot/docs/audit/AI-01提示词全文复查记录-2026-10-30|AI-01 全文复查记录]]，未发布运行任务包。

- [[tools/RiskHot/docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0#3.3 Target 定义与边界|事件的观测主体（Target）]]：2026-10-30 局部修订：作用对象匹配、复用或创建 Target 后建立事件关联；解除五类宏观限制及前置行业预筛，保留身份/范围/证据校验，F02 其他流程不变。
- [[tools/RiskHot/03-业务功能需求/01. RiskHot_系统业务功能需求规格说明书_V1.0#4.2 术语与容易混淆的边界|业务功能需求术语表]]：需求、页面与验收沿用相同名称。

## 个人原型验证

- [[tools/RiskHot/_bmad-output/planning-artifacts/prds/prd-RiskHot-2026-10-12/个人原型验证产品需求文档|RiskHot 个人原型验证 产品需求文档]]：快速生成的评审稿，包含目标、建议范围、核心能力与待确认点。
- [[tools/RiskHot/_bmad-output/planning-artifacts/prds/prd-RiskHot-2026-10-12/领域需求明细与验收|领域需求明细与验收]]：41 项功能需求、7 项质量要求、17 个验收场景和 14 组待确认事项，均保留来源。
- [[tools/RiskHot/_bmad-output/planning-artifacts/prds/prd-RiskHot-2026-10-12/技术机制与来源差异补充|技术及来源差异补充]]：保留源资料模型、机制、命名差异和未决约束。

## 维护记录

- [[tools/RiskHot/log|项目文档维护日志]]：记录本项目文档生成和校验情况。

## EventTarget 关系简化评估

- [[tools/RiskHot/docs/system-design/05-场景验证/EventTarget关系简化评测集/评测说明|EventTarget 关系简化评测集]]：16个合成开发用例，6份仓库依据与用户提案快照；新增160份已采集Information输入，覆盖26个信源，尚无人工金标。含2项规则未决用例；尚未执行模型或数据库评测。

- [[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F01现行存储快照-2026-10-29|F01旧存储快照]]：保存旧实现和已替代目标提案，仅供历史追溯，不作为新实现依据。

- [[tools/RiskHot/docs/superpowers/specs/2026-10-29-f01-material-migration|F01工程迁移规格]]：表、采集、F02与页面的单一迁移闭环；草稿待审，基线类型检查通过，未改业务实现。

## AI-07 工程交付（2026-10-31）

- [[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F02-事件管理/AI任务技术详细设计/AI-07-Target同一性判断|AI-07 技术实现]]：输入输出契约、逐对象预算、核定与恢复、API及旧包兼容。
- [[tools/RiskHot/docs/verification/ai07-target-identity|AI-07 验证记录]]：真实模型10项对照结果、独立审查、自动化验证与正式部署边界。
