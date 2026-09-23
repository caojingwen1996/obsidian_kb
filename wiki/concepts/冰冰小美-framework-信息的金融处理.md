---
title: 冰冰小美-framework-信息归纳框架
aliases: []
created: 2026-08-31
updated: 2026-08-31
type: concept
status: active
tags: []
sources: []
related: []
summary: ""
definition: ""
key_variables: []
common_misunderstandings: []
---

# 冰冰小美-framework-信息归纳框架

## 一句话定义

归纳，是从海量信息中筛选出能够改变市场行为的信息，并通过持续跟踪这些信息，判断风险正在增加还是减弱，从而决定哪些方向应该回避、哪些方向可以逐渐参与。

## 概念来源

- 来源明确提出：
- 来源间接支持：
- 整理者归纳：
- 待验证：

## 概念要解决的问题



## 核心内涵

首先要知道自己的研究需求，而信息是研究对应的信息承载。


### 研究什么？？？？

“我要观察 X，应该去哪获取信息？”

‘伊朗和美国的关系最近有了微妙变化。伊朗总统佩泽希齐扬今天去美国纽约参加联合国活动，不是正式访美，但两国在大打出手后伊朗总统还能入境美国就很稀罕了。伊朗总统是民选的，但总统在伊朗国内不是最高领袖，只负责日常行政、经济民生等事项，参与不了重大战略决策。’

Nota AI刚刚宣布在英特尔Arc Pro B70上推出集成NVA解决方案，进一步拓展了客户在视觉人工智能基础设施层面的选择，业内认为这将助力英特尔拓展人工智能相关业务布局。此外市场也有讨论提及英特尔或将成为人工智能存储的新载体。


### 归纳什么？？？？（continue)

> “归纳内容的核心要点是在于这种信息会引发市场行为变化，特别是其相关风险评估。”


冰冰小美的归纳建议：

 分类维度一：按来源

|来源类型|具体内容|特点|
|---|---|---|
|**市场数据**|股价、汇率、成交量|最直接的盘面语言，实时可观测|
|**机构数据**|财报、监管报告、研报|国外大多收费、国内大多免费。免费不一定对。外资曾是A股风向指引|
|**用户数据**|交易记录、信用评分、持仓分布|「散户根本无法得到有效信息。信息全部被券商掌握，银行掌握。故而，天生不公平」|

分类维度二：按功能

| 功能类型    | 核心关注      | 在冰美体系中的作用                 |
| ------- | --------- | ------------------------- |
| **风险类** | 波动率、违约率   | 支撑冰美体系年度更新的核心：风控          |
| **交易类** | 订单流、流动性   | **冰美体系最关注的一类。** 流动性是交易类核心 |
| **分析类** | 行业趋势、政策解读 | 辅助参考，不直接指导交易              |


1.自上而下

| 建档级别            | 信息源类型                           | 建档条件与用途                                   |
| --------------- | ------------------------------- | ----------------------------------------- |
| **核心源：长期建档**    | 央行、财政及统计部门、重要政策发布机构、监管机构与交易所    | 持续提供货币、财政、制度和经济运行的一手材料，是长期判断的依据           |
| **专题源：按研究需要建档** | 公司公告与投资者关系栏目、行业协会、产业统计机构、相关主管部门 | 与正在跟踪的产业、企业或风险直接相关，能提供连续数据或执行证据           |
| **观察源：试用建档**    | 研究机构、专业媒体、专家和分析者                | 能持续提供独特线索，引用可追溯，观点可以事后验证；需要记录立场、利益关系和纠错情况 |

预设观测对象：

2.自下而上

核心机制：固定观察底层信号，动态生成上层主题









## 信息处理系统的方法论

信息的获取到底应该放在此工作流吗？

信息获取-信息拆解为Event-信息结构化（建立观测对象，建立时间窗口）-信息归纳了（事件密集区，提取共同现象）-观测对象

Input-RawInfo-Event-Signal-Cluster-Theme-Risk Variable

Event = 事实单元
Signal = 变量变化

Cluster = 多个信号开始聚合
Theme = 多个 Cluster 共同指向什么持续性的核心问题





### 输入

我要观察什么？
- feed模式: 用户给信息
- monitor模式：根据预设观测对象 获取这些预设观测对象当天新增的信息
- target模式：输入具体标的，获取具体标的的相关信息






（2.Source Routing 应该去哪找？（very important)

针对这个观察对象，应该去哪里获取？
maybe 一个观测对象是：新闻，标的，宏观日报，微信公众号文章，

观测指标表：
[[wiki/concepts/冰冰小美-indicator-非金融信息观测指标表]]
[[冰冰小美-indicator-金融信息（todo)]]

还需要一个路由routing表（todo)
eg：利率 → 央行 / 财政部 / Treasury）


  

### 输出

自下而上 处理结果：
1. Summary：本轮信息处理概览

核心回答：

> 今天这些杂乱信息最终沉淀出了什么

```
Summary

今日新增 Event：12
今日新增 Signal：3

正在形成的 Theme：2
已有 Theme 获得新证据：3

孤立异常 Signal：4
暂不足以形成 Theme：7

建议移交 Risk Identification：2

Theme A
eligible = true
reason = "持续性 + 多 Cluster 支撑 + 存在明确下行传导"

Theme B
eligible = false
reason = "证据仍不足"
```

2.Core Finding = 本轮最值得保留的信息结论

这里回答：

> **今天真正值得记住的是什么？**

建议每条 Finding 长这样：

```
Core Finding #1

结论：
能源价格压力出现明显缓解。

依据：
- Cluster A：原油价格连续回落
- Cluster B：通胀预期同步下降
- Cluster C：长端利率回落

对应 Theme：
宏观定价压力是否正在缓解？

状态：
Theme strengthening / forming

后续观察：
油价回落是否持续；
10Y 是否继续确认。
```




### 步骤


1.信息拆解为Event

Event：在特定时间或时间区间内，某个主体发生、执行、发布或出现的一项可独立记录的信息变化。
标准化原始信息：统一时间 统一主体名称，去除噪音，保留来源
提取event： - 谁 - 发生了什么 - 什么时候 - 涉及什么对象 - 关键数据 - 来源 

| 字段                 | 核心问题          | 示例                    | 必填  |
| ------------------ | ------------- | --------------------- | --- |
| **Event ID**       | 这个事件的唯一标识是什么？ | `EVT-20260923-001`    | 是   |
| **Event Time**     | 事件什么时候发生？     | `2026-09-23`          | 是   |
| **Time Precision** | 时间精确到什么程度？    | `day / hour / exact`  | 是   |
| **Subject**        | 谁发生了行为或变化？    | 美联储、OPEC、微软           | 是   |
| **Action**         | 做了什么 / 发生了什么？ | 加息、减产、上调 CapEx        | 是   |
| **Object**         | 行为作用于什么对象？    | 政策利率、原油供给、AI资本开支      | 可选  |
| **Key Fact**       | 事件最核心的事实是什么？  | 美联储加息 25bp            | 是   |
| **Key Value**      | 是否有关键数值？      | `+25bp`、`CPI 0.4%`    | 可选  |
| **Context**        | 理解事件需要什么背景？   | 此前市场预期加息25bp          | 可选  |
| **Source**         | 信息来自哪里？       | FOMC、Reuters、公司财报     | 是   |
| **Source Time**    | 信息什么时候发布？     | `2026-09-17 14:00`    | 建议  |
| **Confidence**     | 对事实本身有多确定？    | `high / medium / low` | 是   |
| **Conflict**       | 是否存在来源冲突？     | `false`               | 建议  |
| **Original Text**  | 原始信息是什么？      | 原文摘录                  | 建议  |

Event 处理：

去重 / 合并: 多条信息是否描述同一事件
关联：判断 Event 之间是否存在： - 同一主体 - 同一变量 - 同一因果链 - 同一时间窗口 - 同一现象






Event Analysis：

如果是**关键 Event**，再追加 Event Window 信息

| 字段                        | 核心问题           | 示例                    |
| ------------------------- | -------------- | --------------------- |
| **Core Question**         | 这个事件真正要回答什么问题？ | 美联储是否继续维持高利率？         |
| **Pre-event Expectation** | 事件前市场预期什么？     | 加息25bp，之后可能转鸽         |
| **Actual Result**         | 实际发生了什么？       | 加息25bp并强调2%通胀目标       |
| **Surprise**              | 实际结果和预期差在哪里？   | 政策态度更鹰                |
| **Immediate Reaction**    | 事件后第一反应是什么？    | 10Y上行                 |
| **Repricing**             | 市场重新定价了什么？     | higher-for-longer预期上升 |
| **Changed Variables**     | 哪些变量因此发生变化？    | 降息预期↓、长端利率↑           |


如果存在可识别的变化（预期差）则进入下一步。


2.提取真正发生变化的核心变量：Signal 

目的：把“发生了什么”转换成“哪个变量发生了什么方向、什么强度、什么性质的变化”。

Signal 可以有两类来源：

```
1. Fact Signal
   事实本身发生变化

2. Repricing Signal
   市场对事实的预期和定价发生变化
```


|维度|核心问题|可选值 / 表达|说明|
|---|---|---|---|
|**Variable**|什么变量发生了变化？|宏观 / 市场 / 行业 / 公司|变量应尽量标准化，可跨不同 Event 复用|
|**Direction**|变量往哪个方向变化？|上升 / 下降；改善 / 恶化；收紧 / 宽松；加速 / 减速|根据变量本身选择合适的方向表达|
|**Magnitude**|变化有多大？|`small` / `moderate` / `large` / `extreme`|描述变化幅度或重要程度|
|**Novelty**|这次变化相对之前有什么新意？|`new` / `continuation` / `reversal` / `reconfirmation`|区分首次出现、延续、反转、再次确认|
|**Persistence**|这个变化持续性如何？|`one_off` / `repeated` / `persistent` / `unknown`|判断是一次性事件，还是连续出现|
|**Scope**|变化发生在哪个范围？|`company` / `industry` / `sector` / `market` / `macro` / `cross_market`|描述 Signal 的影响或观察范围|
|**Confidence**|对这个 Signal 的判断有多确定？|`low` / `medium` / `high`|由事实完整度、来源质量、交叉验证决定|
最终一个signal可以表达成：

|Variable|Direction|Magnitude|Novelty|Persistence|Scope|
|---|---|---|---|---|---|
|原油价格|↓|large|reversal|unknown|macro|
|AI CapEx 需求|↑|moderate|reconfirmation|repeated|industry|
|长期利率|↓|moderate|reversal|short-lived|market|

3.判断多个 Signal能否归纳为cluster

目的：这一段时间里，到底发生了什么？市场是怎么重新定价的？

cluster定义：一组相互关联的 Event / Signal，围绕同一件事情或同一段演化过程形成的事件集合。
可以观察Event或Signal有没有连续性。（也就是冰冰小美语境下的时间窗口）


判断能否聚合的维度：

| 关系维度                  | 判断问题            | 示例                 |
| --------------------- | --------------- | ------------------ |
| **Same Variable**     | 是否指向同一个变量？      | Brent↓、WTI↓ → 原油价格 |
| **Same Direction**    | 是否共同体现同方向变化？    | 2Y↓、10Y↓ → 利率压力下降  |
| **Same Driver**       | 是否由同一个驱动因素引起？   | OPEC减产、库存下降 → 供给收紧 |
| **Same Subject**      | 是否围绕同一主体？       | 微软CapEx↑、GPU采购↑    |
| **Same Time Window**  | 是否在同一观察窗口内连续出现？ | 过去3天多个AI需求信号       |
| **Transmission Link** | 是否位于同一条传导链？     | 油价↑ → 通胀预期↑ → 10Y↑ |

cluster的timeline:提取每个 Event / Signal 的时间 ,统一时间格式, 按时间排序.

Cluster 最终可以有两种表现形式：

| 视图                 | 作用                                  |
| ------------------ | ----------------------------------- |
| **Structure View** | 看这些 Event / Signal 为什么属于同一个 Cluster |
| **Timeline View**  | 看这些 Event / Signal 是怎么随时间演化的        |
|                    |                                     |



4.判断多个 Cluster 是否共同指向同一个核心问题

目的：这些事情共同在回答什么“核心问题”

定义：Theme = 由多个相关 Cluster 共同指向的、具有持续解释力的核心问题或主导叙事。


|判断维度|核心问题|说明|
|---|---|---|
|**Common Question**|这些 Cluster 是否共同围绕同一个核心问题？|最重要|
|**Common Variable**|是否反复涉及同一组核心变量？|如油价、通胀、利率|
|**Common Driver**|是否存在共同驱动？|如能源冲击、货币政策、AI CapEx|
|**Transmission Chain**|Cluster 之间能否组成连续传导链？|如能源 → 通胀 → 利率 → 估值|
|**Directional Consistency**|是否共同强化、削弱或改变同一判断？|可以方向一致，也可以出现转折|
|**Explanatory Compression**|一个更高层问题能否解释多个 Cluster？|Theme 要有“压缩信息”的能力|




**如何区分cluster和Theme?**

```
Theme：高利率对AI资产的压制
│
├── Cluster 1：9月FOMC重新定价
├── Cluster 2：10Y突破5%
├── Cluster 3：油价上涨推升通胀预期
├── Cluster 4：油价回落、10Y跌破5%
└── Cluster 5：AI需求重新增强
```





## 信息处理skill的开发

### SKILL.md

定位：
```

	`bbxm-information-processing` 是一个通用的信息处理 Skill。

它负责围绕指定观察目标获取相关信息，将原始材料提取为 Event，并进一步完成事件结构化、时间组织和信息归纳。

能力边界：
该 Skill 不执行具体领域判断。

它的职责是把外部信息加工成：
可追溯
+
结构化
+
可归纳
+
可供下游 Skill 继续分析的机器可读信息结果。

## 核心能力 
1. **信息获取** 围绕指定观察目标获取相关信息。 
2. **信息组织** 将分散信息组织为具有时间、观察对象和来源关系的结构化信息集合。
3. **信息归纳** 从相关信息中提取共同现象和核心变量，形成可追溯的结构化归纳结果。


```

入口：
```
Skill 支持三种主要入口模式：
feed：
适用于已经存在一份或多份待处理材料的场景。
该模式主要回答：从已有材料中，可以提取哪些与当前观察目标相关的 Event？

monitor：
适用于已经建立固定观察体系，需要周期性扫描预设信息源的场景。
该模式主要回答：预设观察对象在当前扫描周期内出现了哪些新的 Event？

target：
适用于给定一个具体对象，围绕该对象动态获取相关信息的场景。
该模式主要回答：与指定 Target 相关的新增 Event 有哪些？


```

输出：

```
## 输出

本 Skill 的标准输出为 `InformationProcessingResult`。

其完整结构由：

schemas/information-processing-result.schema.json定义。

结果中可以包含结构化的 `Event`、`Signal`、`Cluster` 和 `Theme` 对象，具体结构由 `schemas/` 目录下对应的 Schema 定义。

对于 `feed` 模式，面向用户的回答应基于标准输出进一步整理为：
1. 总结
   - 今日新增 Signal
   - 正在形成的 Theme
   - 获得新证据的已有 Theme
   - 孤立 Signal
   - 暂不足以形成 Theme 的信息
   - 建议移交 Risk Identification 的对象

2. Core Findings
   - 本轮最值得保留的信息结论


`InformationProcessingResult` 是标准结构化输出。

面向用户的总结回答是基于标准输出生成的展示结果。

风险判断、投资判断和交易结论不属于本 Skill 的职责范围。

```

可视化输出

```
## 可视化输出

本 Skill 先完成信息处理并生成标准结构化结果 `InformationProcessingResult`。

当结果包含适合可视化表达的 `Cluster`、`Theme`、`Core Finding` 或其他结构化信息，且当前任务需要生成阅读版报告时，将完整分析结果交由 Agent 的可视化输出 Skill 处理。

可视化输出可优先表达：

- Cluster 的事件时间轴与事件演化；
    
- Cluster 内 Event / Signal 的关系结构；
    
- 多个 Cluster 与 Theme 的归纳关系；
    
- Theme 的核心变量与传导结构；
    
- Summary 与 Core Findings 的结构化展示。
    

本 Skill 只提供完整、可追溯的分析结果及对象关系，不规定具体 HTML 结构、图表实现、视觉样式和页面布局。

具体呈现规则由可视化输出 Skill 定义。
```







推荐可视化映射

```
### 推荐可视化映射

当需要生成可视化报告时，可根据结构化对象优先考虑以下表达方式：

|对象|推荐表达|
|---|---|
|Signal|信号列表 / 状态表|
|Cluster|事件时间轴|
|Cluster|Event / Signal 关系链|
|Theme|Cluster → Theme 结构图|
|Theme|核心变量 / 传导结构|
|Summary|数量概览|
|Core Finding|结论 + 支撑证据链|

以上仅用于描述信息结构的推荐表达方式。

具体采用哪种图表、页面布局、HTML 结构和视觉样式，由可视化输出 Skill 根据实际内容决定。
```

工作流程

```
## 工作模式

本 Skill 支持以下模式：

### feed
处理用户已经提供的信息，完成结构化、归纳和主题提炼。

执行流程：
workflows/feed-workflow.md

### monitor
持续读取指定信息源，识别观察窗口内的新增变化。

执行流程：
workflows/monitor-workflow.md

### target
围绕指定对象或问题主动获取并处理相关信息。

执行流程：
workflows/target-workflow.md
```

### references

规定“每一步怎么做”

event-extraction.md

signal-extraction.md:

clustering.md

theme-synthesis.md



### workflow

feed_workflow.md



### schema

规定“结果长什么样”

information-processing-result.schema.json
`Event`、`Signal`、`Cluster` 和 `Theme` 对象的schema定义。


### template





## 来源
