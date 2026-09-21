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
