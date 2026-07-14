# BBXM 每日任务自动风险提示写入设计

## 目标

扩展 `.agents/automations/bbxm_daliy_brief.md`：冰冰小美当日帖子抓取和汇总完成后，自动判断每条帖子是否构成风险提示，并把确认的 `R1 / R2 / R3` 提示幂等写入冰冰小美风险提示工具的固定 Excel。

该功能只处理风险提示记录，不把风险转弱、买入窗口或普通观点自动写入工具，也不改变现有抓取、同日增量保存和 `summary.md` 的基本流程。

## 总体流程

```text
抓取并保存目标日期帖子
→ 检查抓取覆盖与正文完整性
→ 生成或更新 summary.md
→ 读取当天全部已保存帖子
→ 对每条帖子进行结构化风险识别
→ 写入 processing/risk-analysis.json
→ 校验分析完整性
→ 幂等更新固定 Excel 中的自动分析行
→ 写入 processing/risk-write-status.json
→ 在 summary.md 和任务收尾中报告结果
```

同日重跑必须基于当天全部已保存帖子重新生成风险分析，不得只分析本轮净新增帖子，也不得用“上次次数 + 本次次数”的方式累计。

## 风险判断范围

风险判断只允许使用：

1. `{DATE}` 当天已保存的冰冰小美帖子正文及其元数据；
2. `.agents/automations/bbxm_daliy_brief.md` 指定的冰冰小美体系知识页；
3. `bbxm-expert` 的 `risk-identification` 规则；
4. `risk-node-identification` 中的等级、传导链和证据约束。

不得为完成风险判断而额外联网获取行情、新闻、利率、资金流或其他外部数据。帖子没有提供足够信息时，必须标记为证据不足或待验证。

## 写入条件

每条帖子独立判断，满足以下条件时计为一次风险提示：

1. 正文和发布时间已可靠保存；
2. 能明确识别风险对象和风险触发信息；
3. 能写出风险传导链；
4. 证据能够支持 `R1 / R2 / R3` 中的一个等级；
5. 判断不是仅由“上涨、下跌、利好、利空”等孤立词语触发；
6. 帖子唯一标识尚未在本次分析结果中重复出现。

等级含义：

| 等级 | 写入 | 含义 |
|---|---|---|
| R1 | 是 | 出现可说明的风险苗头，进入风险观察。 |
| R2 | 是 | 风险明显增强，默认降低暴露并等待验证。 |
| R3 | 是 | 多个风险因子共振增强，优先防守。 |
| N | 否 | 风险方向不明确。 |
| W1 / W2 / W3 | 否 | 风险减弱或转向机会，不属于本工具的风险提示。 |
| 待验证 | 否 | 抓取、正文、传导链或证据不完整。 |

一条帖子即使包含多个风险点，也只计一次；风险原因可以在同一条目内概括多个相关风险。

## 分析完整性阻断

出现以下任一情况时，`analysis_complete` 必须为 `false`，不得更新 Excel：

- 登录、滑块验证或页面异常导致目标日期覆盖不完整；
- 已发现目标日期候选帖，但正文未保存；
- 原始帖子文件缺少正文、发布时间或稳定来源标识；
- 生成风险分析时有帖子遗漏、解析失败或无法完成分类；
- `risk-analysis.json` 不符合数据契约。

“当天未发现风险提示”只有在抓取和逐帖分析均完整时才成立。抓取不完整不能写成零风险。

## `risk-analysis.json` 数据契约

路径：

```text
sources/automations/BBXM每日汇总/{DATE}/冰冰小美/processing/risk-analysis.json
```

结构：

```json
{
  "schema_version": 1,
  "target_date": "2026-07-14",
  "author": "冰冰小美",
  "generated_at": "2026-07-14T18:00:00+08:00",
  "analysis_complete": true,
  "coverage": {
    "saved_post_count": 20,
    "analyzed_post_count": 20,
    "unresolved_post_count": 0,
    "unresolved_reasons": []
  },
  "qualified": [
    {
      "post_key": "https://xueqiu.com/0000000000/123456789",
      "source_file": "2026-07-14-180000-示例.md",
      "url": "https://xueqiu.com/0000000000/123456789",
      "title": "示例标题",
      "published_at": "2026-07-14T18:00:00+08:00",
      "level": "R2",
      "risk_object": "市场情绪",
      "trigger": "高位一致预期继续增强",
      "transmission": "一致预期增强 → 后手集中 → 承接脆弱 → 亏钱效应扩散",
      "evidence": ["帖子证据一", "帖子证据二"],
      "reason": "高位一致预期和后手集中使承接风险上升"
    }
  ],
  "not_written": [
    {
      "post_key": "stable-key",
      "level": "N",
      "reason": "仅为学习方法讨论，不构成当日风险提示"
    }
  ]
}
```

约束：

- `post_key` 优先使用帖子 URL；URL 缺失时使用来源文件名与发布时间生成的稳定键。
- `qualified` 内 `post_key` 必须唯一。
- `level` 只能是 `R1`、`R2`、`R3`。
- `coverage.saved_post_count` 必须等于 `coverage.analyzed_post_count + coverage.unresolved_post_count`。
- `analysis_complete=true` 时，`unresolved_post_count` 必须为 `0`。
- 所有写入理由必须可追溯到 `source_file` 或 `url`。

## Excel 更新器

新增脚本：

```text
tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py
```

命令：

```powershell
python tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py `
  --analysis-file "sources/automations/BBXM每日汇总/{DATE}/冰冰小美/processing/risk-analysis.json" `
  --workbook "tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx" `
  --status-file "sources/automations/BBXM每日汇总/{DATE}/冰冰小美/processing/risk-write-status.json"
```

脚本职责：

1. 校验 JSON 数据契约和目标日期；
2. 拒绝写入 `analysis_complete=false` 的结果；
3. 去重 `post_key`，拒绝相同键给出矛盾内容；
4. 在 Excel 中查找风险原因以固定前缀开头的自动分析行：

```text
[自动分析｜冰冰小美每日任务]
```

5. 只更新或删除目标日期、固定前缀匹配的自动分析行；
6. 不修改目标日期的人工行，也不修改其他日期；
7. `qualified` 非空时写入一行，次数等于唯一合格帖子数；
8. `qualified` 为空时删除已有自动分析行，不新增零次数行；
9. 使用临时文件保存并替换原工作簿，替换成功前不破坏原文件；
10. 无论成功、无风险、阻断还是待重试，都生成状态文件。

Excel 风险原因格式：

```text
[自动分析｜冰冰小美每日任务]
【R2】示例标题：高位一致预期和后手集中使承接风险上升（来源：https://...）
【R1】另一标题：简短原因（来源：文件名）
```

## `risk-write-status.json` 数据契约

```json
{
  "schema_version": 1,
  "target_date": "2026-07-14",
  "status": "written",
  "count": 2,
  "workbook": "tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx",
  "analysis_file": "processing/risk-analysis.json",
  "message": "已更新自动分析风险提示行"
}
```

`status` 只允许：

- `written`：已新增或更新自动分析行；
- `no_risk`：完整分析后没有 R1/R2/R3，且不存在需要保留的自动行；
- `removed`：完整分析后没有风险，已删除旧自动行；
- `pending`：Excel 被占用或暂时无法替换，等待同日重跑；
- `blocked`：分析不完整或数据契约无效，禁止写入。

## Excel 被占用时的处理

Excel 被占用或替换失败时：

1. 保留原工作簿不变；
2. 保留完整 `risk-analysis.json`；
3. 写入 `risk-write-status.json`，状态为 `pending`；
4. 在 `task.log`、`summary.md` 和最终收尾中说明待补写；
5. 本次自动化不得声称全部完成；
6. 同日重跑重新分析全部已保存帖子并再次执行更新器。

不得通过删除锁文件、结束 Excel 进程或覆盖工作簿来绕过占用状态。

## `summary.md` 扩展

在现有“行为翻译”之后增加：

```markdown
## 风险提示判定

- 分析覆盖：已分析 X / 已保存 Y，未解决 Z
- 是否写入风险工具：是 / 否 / 待补写 / 已阻断
- 当日累计风险提示次数：N
- 风险等级分布：R1 × A，R2 × B，R3 × C
- 写入文件：`tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx`
- 待验证边界：无 / 具体说明
```

该章节是结构化结果的可读摘要，不作为 Excel 更新器的输入。更新器只读取 `risk-analysis.json`。

## 自动化提示词变更

在 `.agents/automations/bbxm_daliy_brief.md` 中新增以下阶段：

1. 抓取完整性门禁；
2. 当天全部已保存帖子的逐帖风险分析；
3. `risk-analysis.json` 生成与自检；
4. Excel 更新器调用；
5. `risk-write-status.json` 检查；
6. `summary.md` 风险提示判定章节；
7. 收尾报告中的风险分析覆盖、写入状态、次数和人工跟进项。

同日重跑必须复用现有原始帖和状态，但风险分析与 Excel 自动行必须按当天完整集合重算。

## 测试范围

### 更新器单元测试

- 首次写入一个日期的自动分析行；
- 多条合格帖子合并为一行并正确计数；
- 相同 `post_key` 不重复计数；
- 同日重跑更新原自动行而非新增重复行；
- 同日人工行保持不变；
- 其他日期保持不变；
- 零风险删除旧自动行；
- 零风险且无旧行返回 `no_risk`；
- `analysis_complete=false` 返回 `blocked` 且不修改 Excel；
- 覆盖计数矛盾、非法等级、缺失来源和重复矛盾键被拒绝；
- Excel 被占用或替换失败返回 `pending` 且原文件不变；
- 状态文件在所有结果分支均生成。

### 自动化契约测试

- 提示词包含风险分析阶段和完整性门禁；
- 明确 R1/R2/R3 写入、N/W 不写入；
- 明确只使用当天帖子和知识库；
- 明确同日重跑按完整集合重算；
- 明确 Excel 占用时保存 pending 状态；
- 明确最终收尾报告风险写入结果。

### 工具回归测试

- 现有 Excel 读取、曲线、明细表和启动脚本测试继续通过；
- 自动分析行与同日人工行由现有加载逻辑正确合并。

## 范围边界

- 不修改雪球抓取脚本、浏览器登录或滑块处理逻辑；
- 不改变 Excel 的三列结构；
- 不自动联网补充风险验证数据；
- 不把 W1/W2/W3 写为风险提示；
- 不把风险等级自动翻译成买入或卖出指令；
- 不修改或删除人工填写的风险记录；
- 不在抓取或分析不完整时写入零风险结论。
