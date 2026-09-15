# 五层归纳记录契约

本契约是当前 Wiki 金融信息归纳框架在持仓扫描中的实现约定，不是作者原文的数据结构。每次仍须读取最新框架。正文八类监控项、第 6 节估值字段和报告命名不变。

## 输入和持久化

运行 JSON 的每个 `items[]` 可包含以下字段：

| 字段 | 用途 |
|---|---|
| `information_review` | 对象，包含 `framework_path`、`framework_read_at`、`checked_scope`、`checked_at`、`history_source`、`note` 六个非空文本字段，记录框架读取、实际检查范围/截止时间、历史来源及总体复核说明 |
| `information_events` | 本次经过核验的事件路径记录数组；明确检查后无事件才使用空数组 |
| `prior_information_events` | 采集器从上一运行携带的事件路径记录，全部保留历史日期；不代表今日已复核 |

缺少 `information_review` 或 `information_events` 时展示“归纳未完成”，不把缺失数组解释为无事件。已有未关闭历史记录未在本次数组出现时展示“历史待复核”。未完成项目不得声称完整扫描成功。

Agent 在采集完成后补充本次归纳，保存运行 JSON，再调用报告生成器。输入中给出的事实、窗口和判断由执行 Agent 核验，生成器仅检查结构和渲染，不负责判断金融因果或自动推断风险。旧格式输入仍可渲染，但显示归纳缺口。

## 单条事件路径记录

同一事件跨日期、跨标的复用 `event_id`；不同作用路径用不同 `path_id`。同一标的同一运行不得重复 `(event_id, path_id)`。事件发生、发布、复核和数据统计期分别记录，不互相代替。

每条记录包含下列非空文本字段，未知项明确填“待验证 / 未获取到 / 不适用及原因”，不能填猜测值：

| 对象 | 必需字段 |
|---|---|
| 记录基础 | `event_id`、`path_id`、`title`、`update`、`reviewed_at` |
| `event` 事件节点 | `fact`（含事实/观点/推测/线索标注）、`occurred_at`、`published_at`、`transition`、`source` |
| `impact` 影响 | `risk_source`、`variables`、`path`、`exposure`、`hypotheses`、`conditions`（含时滞）、`evidence` |
| `behavior` 市场行为 | `expected`、`observed`、`evidence` |
| `reaction` 金融反应 | `direction`、`level`、`current_window`、`comparison_window`、`indicators`（含数值/口径/日期/来源或缺口）、`support`、`counter`（含其他解释） |
| `tracking` 长期跟踪 | `previous`（原判断及日期，首次写首次记录）、`revision_reason`、`status`、`indicator_source`、`confirm`、`invalidate`、`next_check`、`closure_reason` |

- `update`：新增 / 持续跟踪 / 获得确认 / 出现反证 / 修订判断 / 关闭。
- `direction`：增强 / 持平 / 减弱 / 重新增强 / 证据不足；`level`：高 / 中 / 低 / 待验证。
- `status`：待验证 / 跟踪中 / 关闭；获得确认不自动关闭。关闭须说明原因，并与 `update=关闭` 一致。
- 当前与比较窗口、可靠支持证据、传导和反证检查未齐备时，`direction=证据不足`；“重新增强”须在 `previous` 和证据中保留此前减弱阶段。
- 风险方向不直接映射 `judgment`、`revalue`。执行 Agent 仍按原技能阈值和证据决定投资逻辑判断、估值处置、人工复盘及研报更新。
- 关键信息不足或旧事件未复核，应进入报告快速阅读提示；不能因为生成器成功退出就视为归纳完成。

## 历史回查

`collect_monitor_run.py --prior-run ...` 将上一运行的历史和本次事件按 `(event_id, path_id)` 合并，较新的本次记录优先，放入新运行的 `prior_information_events`。不继承上次的 `information_review` 和 `information_events` 为本次结果；该行为与是否重估无关。

复核时用相同编号写入本次数组，在 `previous` 中记录原判断日期及上一报告/运行路径，在 `revision_reason` 中说明确认、反证或继续跟踪依据。旧运行文件保留，不原地改写旧判断。未复核记录继续携带，关闭记录保留供审计；新证据导致重新开启时说明原因。

组合汇总按 `event_id` 合并显示各标的路径和各自判断，不叠加分数、不按标的数计算事件数。每次扫描回查仅表示执行本技能时履行跟踪步骤，不创建新的定时任务。

## 验收情景

1. 仅价格异常：记录量价事实，参与者身份未知；风险方向缺证时为证据不足，不能因此修改价值区间。
2. 旧公告今日出现执行证据：复用编号，保留原判断并写新证据与修订理由；无新公告仍须回查。
3. 同一宏观事件影响两个持仓：事件编号相同、路径可不同，汇总一行列出两条路径及报告；不合并为单一风险方向。
4. 历史未复核或本轮输入缺归纳：报告提示未完成，旧判断不冒充今日判断，不能自动关闭。
