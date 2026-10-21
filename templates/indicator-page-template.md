---
title: ""
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: indicator
status: active
tags: []
related: []
summary: ""
indicator_id: ""
spec_version: "1.0.0"
indicator_kind: mixed
observation_scope: ""
purpose: ""
update_frequency: ""
required_inputs: []
metric_fields: []
allowed_assessments: [undetermined]
validation_status: draft
---

# 指标名称

## 指标定义

说明测量或核对的对象，区分指标、风险源与交易结论。

## 观察目的与适用范围

说明用于观察什么状态，适用市场、样本、时间尺度及调用前提。

## 数据输入与口径

| 输入字段 | 含义与类型 | 单位／口径 | 必需性与证据要求 |
|---|---|---|---|
|  |  |  |  |

说明数据来源、统计日与披露日、完整性、更新频率及过期判定。

## 计算与判定

列出公式或定性判定步骤、输出指标字段和 allowed_assessments 中每种状态的证据条件。数值阈值注明出处、适用范围和复核条件；尚无依据时保持未定。

## 解释边界与失效条件

区分作者观点与整理者规则；说明阈值迁移、样本变化、指标重叠和反证。

## 缺失与异常处理

按 [[schema#5.2 Indicator 的 Agent 输出契约|指标输出契约]] 处理缺失、滞后和不可比情况；不以零值代替缺失。说明何时需要人工复核。

## Agent 输出契约

填写下列示例中的稳定标识、版本、subject、metrics 字段和缺口。此为未运行示例，实际结果写入 Workbench。

```json
{
  "indicator_id": "待填写",
  "spec_version": "1.0.0",
  "subject": "待指定观察对象",
  "observed_at": null,
  "available_at": null,
  "evaluated_at": null,
  "data_status": "unavailable",
  "metrics": {},
  "assessment": "undetermined",
  "evidence": [],
  "missing_inputs": [],
  "limitations": ["仅为输出结构示例，尚未运行"],
  "requires_human_review": true
}
```

## 来源与版本记录

- 原始资料：使用库内正文双链，注明作者、位置与证据性质。
- 版本：记录规范变更及验证情况；不能以格式检查通过代替指标有效性验证。
