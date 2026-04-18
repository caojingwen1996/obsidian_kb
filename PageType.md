# Page Type Guide

## Purpose

本文件只定义各类 page type 的详细使用边界，不定义执行流程，不重复目录、frontmatter、标签、命名、建页阈值等通用规则。

它回答的是：

- 每种页面类型具体承载什么
- 每种页面类型不承载什么
- 相邻页面类型如何区分
- 新内容进入知识库时应优先落到哪一类页面
- 页面之间最低应形成哪些连接

执行流程，例如 ingest、query、lint、初始化行为，统一放在 `SKILL.md`。  
页面类型枚举、目录结构、frontmatter、标签体系、建页阈值、命名规则、冲突处理，统一以 `SCHEMA.md` 为准。

## Scope

本文件仅对以下 page type 做详细约束：

- person
- concept
- topic
- view
- timeline
- comparison
- query
- output
- summary

若未来新增或删除 page type，必须先修改 `SCHEMA.md`，再同步更新本文件。

## Global Rules

所有 page type 的使用都应遵循以下总规则：

1. 页面类型必须单一明确  
   一个页面只能有一个主要职责，不应同时承担人物画像、概念定义、观点证据、对比分析等多重主职责。

2. 优先更新已有页面  
   在已有页面可承载的前提下，优先更新，不轻易新建。

3. 优先保持中性对象与时间性判断分离  
   - 中性、可脱离“谁和何时”而成立的内容，优先进入 `concept` 或 `topic`
   - 必须结合“谁、何时、来源”才成立的内容，优先进入 `view`

4. 不使用 page type 承载临时信息  
   一次性、低复用、弱链接的内容，不应强行建页。

5. 页面必须能进入知识网络  
   任何新页都应能和已有页面形成明确链接，不应制造孤页。

## Type Semantics

### person

#### Definition

`person` 用于沉淀某个长期跟踪对象的稳定画像。

#### Should Contain

- 长期关注主题
- 常见判断原则
- 推理风格
- 常用分析框架
- 代表性观点入口
- 观点演化的摘要性描述

#### Should Not Contain

- 单次发言全文
- 某个时间点的具体判断细节
- 没有形成长期特征的一次性表达
- 纯资料摘录

#### Boundary

- `person` 关注“这个人长期如何看问题”
- `view` 关注“这个人在某个时间点具体说了什么”

#### Minimum Links

`person` 页面至少应链接：

- 代表性 `view`
- 相关 `topic`

必要时可链接相关 `concept`。

---

### concept

#### Definition

`concept` 用于沉淀一个相对稳定、可反复引用的知识点本身。

#### Should Contain

- 定义
- 机制
- 关键变量
- 边界条件
- 常见误区
- 与其他概念的关系

#### Should Not Contain

- 某个长周期问题的综合讨论
- 某个人的具体观点
- 强时间性的阶段判断
- 一次性问答结果

#### Boundary

- `concept` 是知识对象本身
- `topic` 是围绕长期问题域组织起来的知识容器

#### Minimum Links

`concept` 页面至少应链接：

- 相关 `topic`

必要时可链接相关 `view`。

---

### topic

#### Definition

`topic` 用于承载一个长期问题域的系统化认识。

#### Should Contain

- 长期跟踪问题
- 关键问题清单
- 关键变量与观察框架
- 相关概念入口
- 相关观点入口
- 主要争议点
- 必要的阶段变化摘要

#### Should Not Contain

- 单纯概念定义
- 单个人单次表达
- 一次性临时问题
- 过宽且带强结论倾向的命题句

#### Boundary

- `topic` 关注“这个长期问题域是什么、该如何跟踪”
- `concept` 关注“这个知识点本身是什么”
- `view` 关注“某个人在某时对该 topic 的判断”

#### Additional Constraint

`topic` 的命名应尽量中性、稳定、可持续扩展。  
以下倾向通常说明 topic 过宽或带结论味，应收窄或改写：

- 把两个以上问题强行并列
- 把结论直接写进文件名
- 同时混入对象、动作、立场、比较关系

#### Minimum Links

`topic` 页面至少应链接：

- 相关 `concept`
- 相关 `view`

必要时可链接 `comparison`。

---

### view

#### Definition

`view` 用于记录某个人在某个时间点、围绕某个 topic 或 concept 的具体判断。

#### Should Contain

- 明确判断
- 明确来源
- 明确日期
- 判断对象
- 判断方向或立场
- 必要的证据摘录或摘要

#### Should Not Contain

- 脱离来源与日期的抽象总结
- 纯概念解释
- 纯人物画像
- 低价值、无复用的即时评论

#### Boundary

- `view` 是证据节点
- `person` 是长期归纳
- `topic` 是问题容器

#### Minimum Links

`view` 页面至少应链接：

- 1 个 `person`
- 1 个 `topic` 或 `concept`

---

### timeline

#### Definition

`timeline` 用于表达某个人、某个 topic 或某类判断的阶段变化。

#### Should Contain

- 关键阶段划分
- 时间节点
- 各阶段的核心变化
- 对应证据入口

#### Should Not Contain

- 只有一两个节点的简单时间记录
- 可直接写入 `person` 或 `topic` 页内小节的内容
- 没有明显阶段差异的材料堆放

#### Boundary

- `timeline` 强调按时间组织变化
- `summary` 强调阶段归纳
- `view` 强调单点判断证据

#### Minimum Links

`timeline` 页面通常应链接：

- 对应的 `person` 或 `topic`
- 关键 `view`

---

### comparison

#### Definition

`comparison` 用于保存跨人物、跨主题、跨阶段的对比分析结果。

#### Should Contain

- 比较对象
- 比较维度
- 主要异同
- 差异原因或解释
- 对比后的结论

#### Should Not Contain

- 没有分析的并列摘录
- 一次性临时比较
- 仅为回答单次问题而拼接的材料

#### Boundary

- `comparison` 的核心任务是比较
- `topic` 的核心任务是组织长期问题域
- `query` 的核心任务是回答问题

#### Minimum Links

`comparison` 页面至少应链接：

- 被比较的主要页面
- 至少 1 个相关 `topic` 或 `person`

---

### query

#### Definition

`query` 用于保存高价值、可复用的问题与回答。

#### Should Contain

- 明确问题
- 回答结论
- 回答依据
- 适用范围
- 相关页面入口

#### Should Not Contain

- 一次性临时问答
- 强依赖当下上下文、难以复用的回答
- 很快失效的即时信息整理

#### Boundary

- `query` 以问题为入口
- `comparison` 以比较任务为入口
- `output` 以成品交付为入口

#### Minimum Links

`query` 页面至少应链接：

- 回答依据的主要页面
- 至少 1 个 `topic` 或 `person`

---

### output

#### Definition

`output` 用于保存整理完成、可直接复用或展示的最终成品。

#### Should Contain

- 结构完整的成稿
- 可交付内容
- 已整理完成的专题输出
- 面向展示、汇报、复用的结果页

#### Should Not Contain

- 尚未成熟的中间稿
- 持续变动中的核心知识页
- 纯摘录材料
- 仅阶段性归纳的内容

#### Boundary

- `output` 强调成品属性
- `summary` 强调阶段性归纳
- `topic` 强调长期维护

#### Minimum Links

`output` 页面应链接：

- 主要依据的 `topic`、`person`、`comparison` 或 `query`

---

### summary

#### Definition

`summary` 用于保存某个阶段、某批资料或某轮研究之后的归纳性总结。

#### Should Contain

- 阶段性结论
- 该阶段的重要变化
- 该阶段的主要问题与线索
- 后续应继续跟踪的点

#### Should Not Contain

- 正式概念定义
- 长期 topic 主页面
- 单条观点证据
- 对外成品稿

#### Boundary

- `summary` 是阶段性归纳
- `output` 是最终成品
- `topic`、`person`、`concept` 是长期主页面

#### Minimum Links

`summary` 页面通常应链接：

- 所归纳的 `topic`、`person` 或 `view`

## Routing Heuristic

当新内容进入知识库时，按以下顺序判断其 page type：

1. 如果内容主要描述某个人的长期思路与稳定特征，优先进入 `person`
2. 如果内容主要解释某个知识点本身，优先进入 `concept`
3. 如果内容主要围绕一个长期问题域组织知识，优先进入 `topic`
4. 如果内容主要记录某个人在某个时间点的具体判断，优先进入 `view`
5. 如果内容主要表达阶段变化，且拆页后更清晰，考虑 `timeline`
6. 如果内容主要是在做结构化对比，考虑 `comparison`
7. 如果内容主要是在沉淀高价值问答，考虑 `query`
8. 如果内容已经整理成最终成品，考虑 `output`
9. 如果内容只是阶段性归纳，考虑 `summary`

## Common Misuse

常见误用包括：

1. 用 `topic` 承载带结论的判断句  
2. 用 `person` 直接承载单次表达  
3. 用 `concept` 承载明显时段性问题  
4. 用 `summary` 长期替代正式主页面  
5. 在阶段变化不明显时滥建 `timeline`  
6. 把没有分析的并列摘录写成 `comparison`

## Maintenance Rule

每次创建或更新页面时，至少检查以下事项：

- 页面主职责是否明确
- 是否更适合更新已有页面
- 是否满足最低链接要求
- 是否与相邻 page type 混用
- 是否具有长期复用价值

## Topic Page Refinement Rule

`topic` 页面允许并鼓励进行持续的二次整理（refinement），前提是不改变其作为“长期问题域主页面”的职责。

该规则用于规范在已有 `topic` 页面上进行结构优化、内容重组与抽象提升时的边界。

### Allowed Operations

在 `topic` 页面上，允许直接进行以下操作：

1. 结构重组  
   - 调整章节层级  
   - 将长段落拆分为多个子章节  
   - 按问题、变量或逻辑重新组织内容  

2. 内容压缩与去重  
   - 删除重复表达  
   - 合并语义相近的条目  
   - 用更稳定的表述替换零散摘录  

3. 抽象与提炼  
   - 从具体材料中提炼关键问题  
   - 补充“关键变量”“观察框架”“检查项”等结构  
   - 将零散观点上升为结构化描述  

4. 链接增强  
   - 补充指向相关 `concept`、`view`、`comparison` 的链接  
   - 将原本内嵌的内容改为引用已有页面  

5. 表达中性化  
   - 将带强结论倾向的表达改写为中性问题或结构  
   - 避免在 `topic` 主页面中固化单一结论  

以上操作均视为对 `topic` 主页面的增强，不构成规则破坏。

### Disallowed Patterns

在 `topic` 页面中，不应出现以下情况：

1. 承载单次观点证据  
   - 大量保留某人某次发言的原始表达  
   - 未抽象为问题结构或变量的观点堆积  

2. 替代其他 page type  
   - 用 `topic` 页面承担 `person` 的人物画像职责  
   - 用 `topic` 页面承担 `view` 的时间性判断记录  
   - 用 `topic` 页面承担 `comparison` 的对比分析主结构  

3. 退化为资料堆  
   - 仅做摘录堆积，没有形成结构化组织  
   - 无法回答“这个页面在研究什么问题”  

4. 变成成品输出页  
   - 页面整体转为对外展示稿或完整成稿  
   - 表达风格偏交付而非长期维护  

### Extraction Rule

当二次整理过程中出现以下情况时，应考虑拆出新页面，而不是继续堆在 `topic` 内：

1. 某一组内容已经形成独立知识对象  
   - 可单独作为 `concept` 被多个页面复用  

2. 某一组内容属于具体判断证据  
   - 应拆为 `view`，并在 `topic` 中引用  

3. 某一组内容构成结构化对比  
   - 应拆为 `comparison`  

4. 某一组内容为阶段性归纳  
   - 应拆为 `summary`  

5. 某一组内容已经整理为完整成稿  
   - 应拆为 `output`  

### Integrity Check

每次对 `topic` 页面进行较大幅度整理后，至少检查以下事项：

1. 页面是否仍围绕一个清晰的长期问题域  
2. 页面是否在组织 `concept` 与 `view`，而不是替代它们  
3. 是否存在应拆分为独立页面的内容块  
4. 页面是否比整理前更易于被引用与链接  
5. 页面是否保持中性、可持续扩展  

若以上条件成立，则该次整理视为有效增强。

### Guiding Principle

`topic` 页面是知识库中的主干节点，应被反复整理、压缩与重组。  

优化结构与表达是正常维护行为，  
真正需要避免的是页面类型边界的丧失，而不是修改本身。

## Change Policy

如需调整 page type 的范围或边界：

1. 先修改 `SCHEMA.md`
2. 再修改本文件
3. 最后再检查 `SKILL.md` 是否需要同步

不要只改其中一个文件。