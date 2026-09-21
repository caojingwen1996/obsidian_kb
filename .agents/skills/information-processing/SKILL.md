---
name: information-processing
description: 围绕观察目标获取信息、提取可追溯事件、组织时间轴并归纳共同现象与核心变量。用于处理已有材料、扫描预设来源的新增信息或收集指定对象的信息；不用于风险、估值或交易决策。
metadata:
  version: "1.0.0"
---

# 信息处理

## 定位

将原始材料加工为可追溯、结构化、可供下游技能继续分析的 `InformationProcessingResult`。方法依据为项目的 [信息的金融处理](../../../wiki/concepts/冰冰小美-framework-信息的金融处理.md) 页面。

## 核心能力

1. **信息获取**：围绕观察目标选择来源，获取材料并提取独立 Event。
2. **信息组织**：建立事件、观察对象、来源与时间窗口的关系，形成事件时间轴。
3. **信息归纳**：从相关事件提取共同现象和核心变量，保留归纳结论与证据的引用关系。

## 输入

根据请求的主动作选择模式：

| 模式 | 输入 | 处理目标 |
|---|---|---|
| `feed` | 一份或多份已有材料，以及可选的观察目标 | 提取材料中与目标相关的事件 |
| `monitor` | 预设观察对象、来源清单、扫描窗口或上次成功扫描截止点 | 获取本轮新增信息 |
| `target` | 指定公司、产业、宏观变量、事件或其他对象 | 路由来源并收集对象相关信息 |

共同范围包括核心问题、时间窗口、时区、截止时间及地域/市场。缺省值、身份歧义和首次扫描的处理见工作流的“执行准备”。

## 输出

交付一个 `InformationProcessingResult` JSON 对象：

- `context`：模式、观察目标与时间窗口。
- `events`：事件事实、来源、观察对象、金融因子和市场反应。
- `timeline`：按时间组织的事件引用。
- `induction`：事件簇、共同现象、核心变量和可追溯的归纳陈述。

完整字段以 [结果模板](references/result-template.json) 和 [字段与证据约定](references/output-contract.md) 为准。未知标量用 `null`，空列表用 `[]`；不添加领域判断字段。默认在对话中交付，需要保存文件时按用户授权和项目 Wiki / Workbench 规则选址。

## 工作流入口

执行任务时读取 [workflow.md](workflow.md)，完成执行准备、信息获取、信息结构化、信息归纳以及交付验证。详细步骤统一维护在工作流文件中。

## 能力边界

- 区分事实、来源观点与推测；金融因子和市场反应须有证据，不能直接转换为风险、估值或买卖结论。
- 不把来源获取失败当成没有新增事件，不推进失败来源的扫描进度。
- `monitor` 只执行一轮扫描；周期调度须由用户明确提出。
- 仅在用户要求时衔接下游领域分析；风险识别交给 `bbxm-risk-identification`，已识别风险的演化交给 `bbxm-risk-evolution-monitoring`。

## 支持资源

| 资源 | 使用时机 |
|---|---|
| [来源路由](references/source-routing.md) | 获取信息前，选择与观察对象匹配的来源 |
| [字段与证据约定](references/output-contract.md) | 结构化事件与生成输出时 |
| [结果模板](references/result-template.json) | 生成 JSON 时，核对完整字段 |
| [JSON Schema](references/output-schema.json) | 校验输出结构或维护契约时 |
| [结果校验脚本](scripts/validate_result.py) | 保存 JSON 后，检查结构和跨对象引用；用法见工作流 |

## 维护

修改本技能的说明、工作流、资源、脚本或界面元数据后，在 [log.md](log.md) 追加日期、版本变化、原因、涉及文件、具体变更与实际验证结果，并在项目根 `log.md` 记录概况。[退役技能日志](history/retired-information-filter-log.md) 只供审计，不作为执行依据。
