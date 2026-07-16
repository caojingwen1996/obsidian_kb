# 合并冰冰小美交易复盘技能设计

## 目标

将 `bbxm-trade-review` 与 `trade-ticket-review` 合并为一个技能，最终只保留 `trade-ticket-review` 作为冰冰小美专家体系中的交易复盘入口。

## 边界

- 保留 `.agents/skills/trade-ticket-review/` 及其技能名。
- 将旧技能中仍有价值且未被现技能覆盖的冰冰小美体系复盘约束并入保留技能。
- 删除 `.agents/skills/bbxm-trade-review/`，不保留别名技能或转发入口。
- 清理活动技能、测试和路由中的旧名称引用；历史设计、计划和日志记录不回写。
- 不改变 `bbxm-expert` 当前指向 `trade-ticket-review` 的正式路由。

## 合并后的职责

`trade-ticket-review` 统一处理：

1. 单笔交易、截图、交割单和阶段交易记录复盘；
2. 信息依据、风险状态、情绪、流动性、仓位、性格和执行纪律审计；
3. 盈亏来源、错误代码、可复制性和下一次约束提炼；
4. 用户明确要求冰冰小美三要素复盘时，调用 `bbxm-three-factor-analysis` 并消费其结果，不复制三要素检查表；
5. 用户要求沉淀到知识库时，按项目规则创建或更新 Query Page，并维护索引和日志。

## 内容取舍

- 以现有 `trade-ticket-review` 的完整工作流、评分和输出模板为主体。
- 吸收旧技能强调的“恢复原始交易意图”“明日是否有人承接”“仓位与性格匹配”和 Wiki 输出边界。
- 对两边重复的三要素、流动性、盈亏归因和常见错误只保留一份定义。
- 风险方向判断如需正式结论，应消费 `risk-identification` 的结果；交易复盘技能不自行扩展另一套风险状态体系。

## 验证

- `trade-ticket-review` 技能目录通过 `quick_validate.py`。
- 项目契约测试确认 `bbxm-expert` 只路由到 `trade-ticket-review`。
- 测试确认旧目录不存在，活动文件中不再引用 `bbxm-trade-review`。
- UTF-8 和 YAML 元数据检查通过。

