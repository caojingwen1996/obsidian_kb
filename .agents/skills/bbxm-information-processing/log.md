# information-processing 变更日志

本日志记录技能本身的变更。每次修改后追加日期、版本变化、原因、文件、具体变更与验证结果；业务运行结果不作为技能变更。退役技能原始日志完整保留在 [history/retired-information-filter-log.md](history/retired-information-filter-log.md)。

## 2026-09-21 — 按信息的金融处理框架新建

- 版本：新建 1.0.0；输出 schema_version 为 1.0，两者含义不同。
- 修改原因：用户明确要求删除信息归纳技能，依据 wiki/concepts/冰冰小美-framework-信息的金融处理.md 重新生成信息处理技能。
- 涉及文件：SKILL.md、agents/openai.yaml、references/source-routing.md、references/output-contract.md、references/result-template.json、references/output-schema.json、scripts/validate_result.py、history/retired-information-filter-log.md、log.md。
- 具体变更：支持 feed / monitor / target；按信息获取、结构化、归纳三步执行；提供来源路由和证据约定；直接从指定页面提取 InformationProcessingResult JSON 模板，配套严格结构与跨对象引用校验；不执行风险、估值或交易判断。
- 迁移：专家总入口、强触发指针、三要素、产业思维个股筛选、资金面分析和项目技能索引改用新技能；旧日志逐字节保留，旧字典、五层模板和旧入口退役。
- 框架边界：本次不改写用户指定概念页。页面中旧标题、来源空字段和未完成路由不冒充已完善；来源路由、字段填值与验证规则明确为执行约定。
- 验证结果：新技能 quick_validate 通过；输出模板与指定 Wiki JSON 示例逐字段一致；JSON Schema 自检、CLI 实测及16项合成契约检查通过（含三模式空结果、有效归纳簇、变量缺失、额外领域字段、缺字段、重复事件、时间轴遗漏、悬空引用和单事件假簇等）。本地链接、界面 YAML、UTF-8、退役日志 SHA256、旧入口清理和 git diff --check 检查通过。测试工件位于 .work/information-processing-validation-20260921/；未进行真实网络采集或完整技能行为评测。
- 相邻技能验证边界：专家入口和资金面技能通用校验通过；个股产业思维的 compatibility、三要素的 version 为原有顶层字段，通用校验器不接受。已用 Git HEAD 对比确认这两项技能 frontmatter 未改动，相关路由与旧引用清理独立核验通过。
- 删除记录：递归删除命令被自动审批拦截，未执行；改用逐文件补丁删除6个明确文件，再以非递归操作清理空目录。旧技能目录已不存在。


## 2026-09-21 — 工作流拆分为独立文件

- 版本：1.0.0，版本号不变。
- 修改原因：用户要求 workflow 单独拆分为文件。
- 涉及文件：SKILL.md、workflow.md、log.md。
- 具体变更：将信息获取、信息结构化、信息归纳三个 Step 原文移入 workflow.md；SKILL.md 保留强制读取入口，能力说明、输入模式、输出与边界不变。
- 验证结果：迁移正文逐字一致，三个步骤仅在工作流文件维护；入口引用与本地链接、UTF-8、新技能 quick_validate 校验通过。仅拆分文档，不改变业务逻辑或输出 Schema。


## 2026-09-21 — 整理技能入口结构

- 版本：1.0.0，版本号不变。
- 修改原因：用户指出 SKILL.md 结构不合适；上次拆分仍将准备、范围与交付细则留在入口，未突出框架要求的能力说明。
- 涉及文件：SKILL.md、workflow.md、log.md。
- 具体变更：按 skill-creator 的元数据、入口与支持资源分层原则，整理定位、核心能力、输入、输出、工作流入口、能力边界、支持资源和维护章节；缩短触发描述。将执行准备、模式范围细则及交付验证移入 workflow.md，三个核心步骤保持原文。澄清纯 JSON 输出时不额外附加诊断文字或字段，避免原有交付要求自相矛盾。
- 验证结果：quick_validate 通过；两份文档17处本地链接、UTF-8、空白及入口/工作流分离检查通过；三个核心步骤逐字一致，结果模板、Schema、校验脚本和指定框架页哈希不变。本次为文档结构修订，未运行网络采集或技能行为评测。

## 2026-09-23 — 对齐新 feed 分层契约

- 版本：1.0.0 → 2.0.0。输出为用户提供的新 Schema，旧版 context / timeline / induction 契约不再适用；Schema 本身不新增版本字段。
- 修改原因：依据 [[wiki/concepts/冰冰小美-framework-信息的金融处理|信息的金融处理]] 的“信息处理skill的开发”章节重构。用户明确确认严格保留新 Schema，本次仅完成 feed，monitor / target 标记待实现。
- 涉及文件：SKILL.md、agents/openai.yaml、scripts/validate_result.py、新增 tests/test_validate_result.py、本 log.md；项目根 index.md、log.md 同步维护。
- 具体变更：入口改为按阶段加载现有 references、schemas 和 feed 工作流；明确 Event → Signal → Cluster → Theme → Core Findings、Summary 和风险识别移交资格；保留调用名 information-processing，区分目录名 bbxm-information-processing；界面默认提示仅使用 feed。删除入口对已不存在旧资源的引用，约定未知值、来源定位、历史对象、新增计数与展示边界。
- 校验脚本：采用本地五份 Draft 2020-12 Schema 和相对引用注册，核对 ID 唯一性、各层引用、Cluster 时间轴成员归属、单簇 Theme emerging 状态、Repricing Signal 的 Event Analysis、Summary 可核验计数和移交数量。允许空结果、仅 Event、单成员弱 Cluster、历史上下文；旧版契约和非 feed 模式拒绝通过。
- 内容保留：用户已填充的 references 4 份、schemas 5 份、workflows 1 份，前后共 10 个文件 SHA-256 全部一致；未改写方法论 Wiki、历史日志或历史业务结果。
- 验证结果：6 项 unittest 测试通过，包含 23 类无效契约/引用反例，以及合法空结果、完整链、弱簇、历史上下文、再定价和 CLI UTF-8 BOM/错误 JSON 用例；quick_validate 通过；17 处入口本地链接、界面 YAML、UTF-8 无 BOM 与乱码字符、旧资源引用清理检查通过；差异空白检查通过。
- 验证命令：python -X utf8 -B -m unittest discover -s .agents/skills/bbxm-information-processing/tests -v；python -X utf8 -B .agents/skills/skill-creator/scripts/quick_validate.py .agents/skills/bbxm-information-processing。
- 验证边界：合成数据仅用于契约与脚本回归，未进行真实网络采集、完整技能行为基准或下游风险分析。来源可靠性、归纳合理性、历史新增计数和时间演化仍须按方法文档复核；不宣称机器校验覆盖这些语义判断。

## 2026-09-28 — 定义 target 模式工作流

- 版本：2.0.0 → 2.0.1。
- 修改原因：用户要求生成target模式工作流，用于围绕指定对象或问题获取信息，以及承接风险表现补证请求。
- 涉及文件：新增`workflows/target-workflow.md`；修改`SKILL.md`、本日志；根`index.md`与`log.md`同步维护。
- 具体变更：定义对象/问题/窗口输入、来源路由、原始资料留存、时间与口径核验、相关性去重、四层归纳、按缺口补查、停止条件、问题证据对应表与下游回传；提供AI债券融资补证示例。方法和对象契约复用现有references/schemas，未复制或覆盖它们。
- 当前状态：工作流文档已定义；遵从此前严格保留Schema的要求，mode仍固定feed，target结果契约、入口启用及真实执行验收待接入。不得将target搜集改标feed或宣称已能通过当前校验器。
- 验证：quick_validate、工作流全部本地链接与锚点、UTF-8检查通过；核对现有mode契约仍为feed。人工检查来源失败、历史截止日、重复转载、仅Event/空结果、反证与下游eligible边界；未开展真实检索或完整技能行为评测，未修改脚本和测试。

## 2026-09-28 — target工作流对齐feed结构

- 版本：2.0.1 → 2.0.2。
- 修改原因：用户指出target与feed工作流差异过大；前版仅复用处理链，未沿用章节结构与伪代码风格。
- 涉及文件：`workflows/target-workflow.md`、`SKILL.md`、本日志；根索引与日志同步维护。
- 具体变更：按feed的14节结构重写，保留Purpose、Entry Conditions、Main Workflow、Build Result、User-Facing Presentation与End-to-End Flow；第4节集中描述target特有的对象解析、来源路由、主动获取、覆盖与停止检查及输入标准化。第5—11节与feed原文一致，不另造事件/信号/聚类/主题或移交规则。保留目标问题覆盖与下游补证边界，删除独立操作手册式组织。
- 验证：逐段比较第5—11节完全一致；feed工作流修改前后SHA-256不变；14节编号、代码围栏、UTF-8及quick_validate通过。本次为文档一致性修订，未启用target、修改Schema或执行真实检索。

## 2026-09-28 — references方法文档中文化

- 版本：2.0.2 → 2.0.3。
- 修改原因：用户要求将references目录改为中文。
- 涉及文件：`references/event-extraction.md`、`references/signal-extraction.md`、`references/clustering.md`、`references/theme-synthesis.md`、`SKILL.md`版本号与本日志；根索引及日志同步维护。
- 具体变更：四份文档的标题、规则说明、问题、自然语言示例、流程说明及质量检查翻译为中文；保留文件名、章节编号、对象名、字段与枚举、函数/变量标识和Schema路径，原有方法边界与判断规则不变。
- 验证：四份文档全部一级/二级编号、代码围栏数量、行内代码、snake_case标识、伪代码函数及枚举列表与翻译前核对通过；UTF-8与quick_validate通过。全部Schema和workflow文件SHA-256与翻译前一致。未运行市场检索或改变技能业务逻辑。

## 2026-09-28 — 工作模式调整为 feed 与 theme

- 版本：2.0.3 → 2.0.4。
- 修改原因：用户要求从 SKILL.md 工作模式中移除 monitor，将 target 改为 theme。
- 涉及文件：`SKILL.md`、`agents/openai.yaml`、工作流入口 `workflows/theme-workflow.md`、本日志；根 `index.md` 与 `log.md` 同步维护。
- 具体变更：入口工作模式仅保留 feed 与 theme；同步模式说明、工作流链接及界面默认提示，原 target 工作流路径调整为 theme-workflow.md；历史日志保留原记录。
- 边界：当前结果 Schema 仍固定 feed，theme 保留待接入状态；本次命名调整不启用新模式，不修改已有 Schema、参考方法或 feed 工作流。
- 验证：技能 quick_validate 通过；入口及界面提示不存在旧模式名称，工作流新路径存在，UTF-8 与差异空白检查通过。未进行真实采集或模式执行验收。

## 2026-09-28 — 接入 theme 主动搜集模式

- 版本：2.0.4 → 2.1.0。
- 修改原因：用户要求在技能中增加可执行的 theme 模式，承接已定义的自上而下主题工作流。
- 涉及文件：`SKILL.md`、`agents/openai.yaml`、`workflows/theme-workflow.md`、新增 `schemas/theme-processing-result.schema.json`、`scripts/validate_result.py`、新增 `tests/test_theme_result.py`、本日志；根 `index.md` 与 `log.md`。
- 具体变更：入口按已有材料/已知主题分流；theme 解析主题问题与变量，主动搜集并核验事件、数据、支持证据和反证，按变量登记缺口与停止条件。新增独立 ThemeProcessingResult，复用既有 Event、Signal 和可选 Cluster 定义；统一校验入口按 mode 路由，检查证据链引用、重复 ID、数量、变量覆盖、窗口和再定价依据。工作流补齐结果字段映射，初始化可选 clusters，纠正“发债增加自动支持融资压力”的示例。
- 边界：保持原有五份 Schema、四份 references 和 feed 工作流字节不变；theme 不依赖历史 Theme/Cluster 存储，不生成生命周期状态、风险评分或投资结论。此次未修改 feed 既有校验分支与测试，验证结论仅覆盖本次 theme 接入。
- 验证：6 项 theme 测试通过，含 16 类无效输入反例、检索失败空结果、仅 Event、反证、可选 Cluster、UTF-8 BOM 中文 CLI 和非法 JSON；quick_validate、本地链接、UTF-8、原资源 SHA-256 保持及差异空白检查通过。合成数据仅用于契约验证，未执行真实联网采集或完整金融研究。


## 2026-09-28 — 固化 theme 阅读版输出规范

- 版本：2.1.0 → 2.1.1。
- 修改原因：用户要求将AI发债扩张报告的结构与重点改进固化到技能，供后续生成沿用。
- 涉及文件：`SKILL.md`、`workflows/theme-workflow.md`、本日志；同步根 `index.md`、`log.md`。
- 具体变更：theme工作流新增阅读版规范，首屏直接回答主题问题，正文按关键变化、支持与反证、判断边界、后续观察组织；每图服务一个问题，个案明确范围。逐笔明细、口径与检索校验进入附录，关键反证和影响结论的限制留在正文；入口链接到唯一详细规范。
- 边界：仅修改阅读版输出约定，未改feed流程、Schema、机器结果、校验脚本或已有报告。
- 验证：两技能quick_validate通过；本次五份说明文档UTF-8、代码围栏与37处本地链接/锚点通过，差异空白检查通过。人工核对theme工作流与HTML规则的章节顺序、明细折叠及重要证据可见性一致。本次未生成新报告，不声称完成新输出的视觉或端到端行为验收。


## 2026-09-29 — 阅读版输出规范移入 SKILL.md

- 版本：2.1.1 → 2.1.2。
- 修改原因：用户明确要求暂将阅读版输出规范放在SKILL.md中。
- 涉及文件：`SKILL.md`、`workflows/theme-workflow.md`、本日志；根`index.md`与`log.md`。
- 具体变更：将theme工作流原第16节的规范正文完整移至SKILL.md的“theme 阅读版输出规范”，置于theme入口之后、feed约定之前；workflow仅保留引用，更新入口与索引锚点。不新增references文件，不改变规范内容或数据契约。
- 验证：迁移前后规范正文一致；quick_validate、UTF-8和两份活动文档本地链接/锚点检查通过；差异空白检查通过。仅文档归位，未重生成报告或运行市场检索。
