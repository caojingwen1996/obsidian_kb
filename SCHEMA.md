# Obsidian KB Schema

## Purpose

本文件只定义知识库的静态结构规则，不定义执行流程。

它回答的是：

- 这个知识库的领域边界是什么
- 页面类型如何划分
- 不同目录分别承载什么
- frontmatter 应该长什么样
- 标签体系是什么
- 什么情况下值得建新页
- 页面之间应该如何链接
- 命名应遵循什么规则
- 冲突信息如何记录

执行流程，例如启动顺序、ingest、query、lint、任务收尾、首次初始化行为，统一放在 `SKILL.md`。

## Domain

知识库覆盖两个紧密相关的领域：

- 宏观经济：增长、通胀、利率、流动性、信用、财政政策、货币政策、汇率、就业、经济周期
- 投资策略：资产配置、仓位管理、择时、估值、风险控制、行业轮动、交易纪律、组合构建、回撤管理、复盘

## Domain Intent

本知识库有两个核心目标：

1. 对领域内的某个知识点形成完整、系统、可复用的认识
2. 通过持续跟踪某个博主或研究者的观点，学习其思维方式、判断框架与原则结构

因此，知识库默认包含两条互相连接的主线：

- 知识理解线：concept -> topic
- 人物学习线：person -> view

必要时可通过 comparison、query、output 做进一步沉淀。

## Formal Knowledge Admission

资料只有在满足以下条件之一时，才允许进入正式知识层：

1. 资料直接属于本文件定义的领域边界
2. 资料虽然不直接是领域主题，但明确服务于本文件已经允许的长期主线

如果上述两条都不满足：

- 直接丢弃，不进入当前知识库
- 不进入 `people/`、`concepts/`、`topics/`、`views/`、`timelines/`、`summaries/`、`comparisons/`、`queries/`、`outputs/`
- 不继续做 page type、建页阈值和链接规则判断

## Directory Contract

知识库必须使用并维护以下结构：

.
├── SCHEMA.md
├── index.md
├── log.md
├── raw/
│   ├── articles/
│   ├── papers/
│   ├── transcripts/
│   └── assets/
├── people/
├── concepts/
├── topics/
├── views/
├── timelines/
├── summaries/
├── comparisons/
├── queries/
└── outputs/

目录语义如下：

- raw/：原始资料层，只允许新增归档，不允许覆盖改写；这里只保存已经通过正式知识层准入的原始资料
- concepts/：沉淀知识点本身的定义、机制、变量、误区与边界
- topics/：围绕长期问题域形成系统认识
- people/：沉淀人物长期画像与思维方式总结
- views/：保存单条、带日期与来源的观点节点
- timelines/：仅在确有必要时使用，用于表达明显阶段变化
- summaries/：保存阶段性归纳，不替代长期维护的主页面
- comparisons/：保存对比分析结果
- queries/：保存高价值、可复用的问答结果
- outputs/：保存最终成品输出

## Page Types

允许使用以下页面类型：

- person
- concept
- topic
- view
- timeline
- comparison
- query
- output
- summary

## Type Semantics

页面类型按以下语义使用：

- concept：知识点本身，例如流动性、风险溢价、估值中枢、美元周期
- topic：长期问题域，例如美联储加息周期、黄金定价、AI 硬件与软件估值、防御型仓位管理
- person：某个长期跟踪对象，例如某位博主、投资人、研究者
- view：某个人在某个时间点对某个 topic 的具体判断
- timeline：只在某个人或某个 topic 已出现明显阶段变化、且拆出后更清晰时使用
- comparison：不同人物、不同主题或不同阶段之间的对比分析
- query：高价值、可复用的问答沉淀
- output：整理完成后的成品输出
- summary：阶段性归纳页

详细范围说明见 `PageType.md`


## Frontmatter Contract

所有页面必须包含以下基础 frontmatter：

---
title: ""
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: ""
status: active
tags: []
sources: []
related: []
summary: ""
---

允许的扩展字段：

- 人物页：people_type、core_topics、principles、reasoning_style
- 概念页：definition、key_variables、common_misunderstandings
- 主题页：topic_scope、key_questions、related_concepts
- 观点页：person、topic_refs、stance、time_scope、confidence
- 时间线页：subject、timeline_type、period_start、period_end
- 归纳页：subject_refs、period_start、period_end、source_batch

## Tag Taxonomy

除非先修改本文件，否则只能使用以下标签：

宏观类
- macro/growth
- macro/inflation
- macro/rates
- macro/liquidity
- macro/credit
- macro/fiscal
- macro/monetary-policy
- macro/fx
- macro/employment
- macro/cycle

策略类
- strategy/allocation
- strategy/position-sizing
- strategy/timing
- strategy/valuation
- strategy/risk-control
- strategy/rotation
- strategy/review
- strategy/drawdown
- strategy/discipline
- strategy/portfolio

资产类
- asset/equity
- asset/bond
- asset/gold
- asset/commodity
- asset/cash
- asset/real-estate

功能类
- function/framework
- function/thesis
- function/checklist
- function/case-study
- function/query
- function/comparison

人物学习类
- learning/reasoning
- learning/principle
- learning/worldview
- learning/decision-style

## Creation Threshold

以下阈值只适用于已经通过正式知识层准入的资料。

仅在满足以下条件之一时新建页面：

1. 某个概念在 2 个或以上来源中重复出现，且值得单独沉淀
2. 某个主题值得长期跟踪，并且可以承接多个来源或多个观点
3. 某个人物值得持续追踪，且目标是学习其思维方式
4. 某条观点具有明确来源、日期，并有长期分析价值
5. 某次 query 的结果具有长期复用价值
6. 某个 comparison 足够重要，值得长期保留
7. 某轮阶段性归纳比直接回写主页面更清晰，且后续仍可能被引用

以下情况不要新建页面：

- 信息过于零碎、临时、一次性
- 内容完全可以补充到已有页面
- 只是短期查找，没有长期价值
- 新页面将成为孤立页面，无法形成有效链接
- 某条内容还不足以帮助理解知识点或提炼人物思路

## Link Rules

最低链接要求如下：

- view 页面至少链接 1 个 person 页面与 1 个 topic 或 concept 页面
- person 页面至少链接代表性 view 页面、相关 topic 页面，并在页内维护“思维方式”与“观点演化”区块
- concept 页面至少链接相关 topic 页面，必要时链接相关 view
- topic 页面至少链接相关 concept 页面、相关 view 页面，必要时链接 comparison 页面
- summary 页面至少链接所归纳的主要 topic、person 或 view 页面
- query 页面至少链接回答依据的主要页面，以及至少 1 个 topic 或 person 页面

## Conflict Handling

当新信息与旧信息不一致时：

1. 不直接覆盖旧内容
2. 同时记录旧说法和新说法
3. 记录各自的日期和来源
4. 判断属于以下哪类：
   - 信息修正
   - 观点变化
   - 表达变化
   - 明确冲突
5. 对人物观点变化，优先在 views/ 中保留证据，再回写到 people/ 页的“观点演化”部分
6. 对主题认知变化，优先更新 topic 页面，并在必要时补充相关 view 作为证据

## Naming Rules

- 使用稳定标题
- 文件名建议使用 kebab-case
- 避免随意重命名已被广泛链接的页面
- view 文件名优先采用“人物 + 核心主题 + 日期”的格式，避免塞入过长判断句
- 详细结论写入页面标题、summary 和正文，不在文件名中承载全部语义

示例：

- people/ray-dalio.md
- topics/us-rate-cycle.md
- concepts/liquidity-trap.md
- views/ray-dalio-us-debt-cycle-2026-04-13.md
- summaries/gold-pricing-q2-2026-summary.md
