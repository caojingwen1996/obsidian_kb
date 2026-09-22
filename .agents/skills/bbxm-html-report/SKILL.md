---
name: bbxm-html-report
description: 为冰冰小美 Agent 的分析、比较、风险模型、观察记录和研报生成完整 HTML 阅读版，统一浅色研报样式、图表与交付检查。用于分析技能完成后的输出环节或已有报告转 HTML；不替代研究方法，不用于简短问答或明确要求纯 JSON、仅聊天的任务。
metadata:
  version: "1.0.0"
---

# 通用 HTML 报告输出

## 定位

冰冰小美 Agent 共用的输出技能。先由分析技能完成方法论与完整内容，再生成 HTML；读取了方法论但没有实际完成分析，不算满足前置条件。

## 输入

- 本轮完整分析母稿、所用技能及其输出模板。
- 对象、数据截止时间、比较窗口、来源、证据缺口及适用状态。
- 上游约定的保存位置、文件名和已有报告更新规则。

## 输出

默认交付可阅读的 HTML 文件，并保留上游要求的 Markdown、JSON 或其他机器可读工件。HTML 完整承载业务模板，不能只剩摘要卡片；最终对话给出核心结论和 HTML 链接。

简短 Q&A、单数字查询和简短 Yes/No 回答仍用 Markdown。用户明确仅聊天、不生成文件或纯 JSON 时遵从用户要求；不得给机器接口包一层 HTML。

## 工作流入口

执行时读取 [workflow.md](workflow.md) 和 [HTML 样式规范](references/html-report-style.md)。按准备、生成、验证、交付四步执行；内容与章节遵守分析技能模板，展示样式使用本规范。

## 能力边界

- 只负责呈现，不重新计算或补造数据、概率、评分和交易结论。
- 路径、历史版本和覆盖规则沿用业务技能；风险输出继续使用项目内 `tools/a-share-market-dashboard/data/Risk/`。
- 不为满足图表要求补造数值，也不隐藏缺口、候选状态或数据时点。
- 不发布到外网、不启动看板服务或定时任务；本技能只生成及检查交付文件。

## 支持资源

| 资源 | 用途 |
|---|---|
| [workflow.md](workflow.md) | 前置内容检查、输出路径和交付验收 |
| [references/html-report-style.md](references/html-report-style.md) | 用户参考规范的本地适配及图表示例 |
| [assets/report.css](assets/report.css) | 可内联复用的浅色、响应式、打印样式 |
| [scripts/validate_html.py](scripts/validate_html.py) | 检查结构、重复ID、锚点和内联JS语法；不代替视觉验收 |

## 维护

修改本技能或附属资源后，在 [log.md](log.md) 追加日期、版本变化、原因、涉及文件和验证结果，并更新项目根日志。运行生成的报告不属于技能变更。
