## 一、任务目标

使用 `cjw-xueqiu-daily-monitor` skill，抓取并整理 `{DATE}` 当天「冰冰小美」的雪球帖子。

- 目标日期：`{DATE}`
- 目标作者：`冰冰小美`
- 输出位置：按 skill 的 `EXTEND.md` 配置读取输出根目录；若当前自动化约定已同步到 `sources/automations/BBXM每日汇总/{DATE}/冰冰小美`，则使用该目录。

## 二、抓取与重跑规则

1. 先读取 `cjw-xueqiu-daily-monitor` skill 的 `EXTEND.md`，确认账号、目标日期、输出根目录、同日重跑规则和浏览器环境要求。
2. 如果 `{DATE}` 当天已经存在作者输出目录，必须按同日重跑处理：
   - 复用已有 `state.json`、原始帖子文件、`task.log` 和 `processing/` 中间状态；
   - 只补抓新增帖子；
   - 不覆盖已有原始文件；
   - 不把抓取失败或验证不完整写成“无新帖”。
3. 如果登录、访问验证、页面结构、内容提取或保存失败，必须明确记录失败原因、失败阶段和未验证边界。

## 三、原帖命名

### 3.1 原帖命名

每篇帖子必须生成一组一一对应的 Markdown 文件：

```text
HHMMSS_核心观点.md

```

命名规则：

1. `HHMMSS` 必须取帖子元数据中的实际发布时间，不得使用抓取时间、保存时间或任务运行时间。

4. 文件名必须清理 Windows 禁用字符 `<>:"/\|?*`、控制字符、尾部空格和尾部句点，同时保留可读的中文语义。

6. 帖子 URL 或稳定来源标识仍是去重主键；文件名只用于阅读和定位，不得替代 `state.json` 中的稳定键。

### 3.2 逐帖解读

如果出现明确的加仓或减仓信号，写入 `操作.md `

### 3.3 同日重跑

1. 不覆盖、不重命名已有原帖或已有解读文件；新增帖子按本节规则同时生成原帖与解读文件。
2. 已有原帖缺少解读时必须补生成解读。若原帖属于旧命名格式，原帖保持不变，补生成的解读仍使用 `HHMMSS_核心观点_解读.md`，并在 `state.json` 或 `task.log` 中记录原帖与解读文件的对应关系。
3. 补生成解读不算新增帖子，不改变原帖去重状态和原始帖数量。
4. 解读生成失败时必须保留原帖，记录失败原因并列入未解决项；不得因此删除、覆盖或改写原帖。

## 四、风险分析与工具写入

### 4.1 分析范围与完整性门禁

抓取和原始帖保存完成后，必须使用 `bbxm-expert` 的风险识别路径和 `risk-node-identification` 规则，对 `{DATE}` 当天全部已保存帖子逐帖分析。不得只分析本轮净新增帖子，也不得用“上次次数 + 本次次数”累计；同日重跑必须按当天完整集合重算，每条帖子最多计一次。

风险判断只允许使用：

1. `{DATE}` 当天已保存的冰冰小美帖子正文及元数据；
2. 本提示词要求阅读的冰冰小美体系知识页；
3. `bbxm-expert` 的风险识别规则；
4. `risk-node-identification` 的等级、传导链和证据规则。

不得额外联网获取行情、新闻、利率、资金流或其他外部数据来补足风险证据。证据不足时必须归为 `待验证`，不得强行判定。

出现以下任一情况时，`analysis_complete` 必须为 `false`，不得把抓取不完整写成零风险：

- 登录、滑块验证、页面异常或内容提取失败导致目标日期覆盖不完整；
- 已发现目标日期候选帖，但正文未保存；
- 原始帖缺少正文、发布时间或稳定来源标识；
- 任一已保存原帖缺少对应的 `_解读.md` 文件，或解读文件不符合“仅保留冰冰小美体系解读一个正文章节”的内容契约；
- 有帖子遗漏、解析失败或无法完成分类；
- 结构化分析不符合下述数据契约。

### 4.2 风险等级与计数

- `R1 / R2 / R3`：风险增强节点，写入风险工具；每条合格帖子计 1 次。
- `W1 / W2 / W3`：风险减弱或转向机会节点，写入风险工具；每条合格帖子计 1 次。
- `N`：方向不明确，不写入。
- `待验证`：证据、抓取或传导链不完整，不写入。

合格风险必须同时具备明确的风险对象、触发信息、传导链和帖子证据。不得仅因帖子出现“上涨、下跌、利好、利空”等孤立词语而触发。一条帖子包含多个相关风险点时仍只计 1 次，并在同一条原因中概括。

### 4.3 `risk-analysis.json`

把逐帖结果写入：

```text
sources/automations/BBXM每日汇总/{DATE}/冰冰小美/processing/risk-analysis.json
```

文件必须包含：

```json
{
  "schema_version": 1,
  "target_date": "{DATE}",
  "author": "冰冰小美",
  "generated_at": "ISO 8601 时间",
  "analysis_complete": true,
  "coverage": {
    "saved_post_count": 0,
    "analyzed_post_count": 0,
    "unresolved_post_count": 0,
    "unresolved_reasons": []
  },
  "qualified": [],
  "not_written": []
}
```

`qualified` 每项必须包含：`post_key`、`source_file`、`url`、`title`、`published_at`、`level`、`risk_object`、`trigger`、`transmission`、`evidence`、`reason`。`post_key` 优先使用帖子 URL；没有 URL 时使用来源文件名和发布时间生成稳定键。`level` 只能是 `R1`、`R2`、`R3`、`W1`、`W2`、`W3`。

`not_written` 每项必须包含：`post_key`、`level`、`reason`，其中 `level` 只能是 `N`、`待验证`。

写入前必须自检：

- `post_key` 在逐帖结果中唯一；完全相同的重复结果只保留一条，矛盾结果必须阻断；
- `saved_post_count = analyzed_post_count + unresolved_post_count`；
- `analysis_complete=true` 时 `unresolved_post_count` 必须为 `0`；
- 所有写入理由都能追溯到 `source_file` 或 `url`。

### 4.4 调用 Excel 更新器

生成分析文件后执行：

```powershell
python tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py --analysis-file "sources/automations/BBXM每日汇总/{DATE}/冰冰小美/processing/risk-analysis.json" --workbook "tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx" --status-file "sources/automations/BBXM每日汇总/{DATE}/冰冰小美/processing/risk-write-status.json"
```

更新器只允许修改目标日期、风险原因以 `[自动分析｜冰冰小美每日任务]` 开头的自动行；不得修改同日人工行或其他日期记录。完整分析后没有 R1/R2/R3/W1/W2/W3 可写入节点时，由更新器删除旧自动行，不新增零次数行。

执行后必须读取 `risk-write-status.json`：

- `written`：自动行已新增或更新；
- `no_risk`：完整分析后无风险，且没有旧自动行；
- `removed`：完整分析后无风险，已删除旧自动行；
- `pending`：Excel 被占用或暂时不能替换，等待同日重跑；
- `blocked`：分析不完整或数据契约无效，禁止写入。

若 Excel 被占用，必须保留原工作簿、`risk-analysis.json` 和 `pending` 状态，在 `task.log`、`summary.md` 与收尾报告中标明待补写，本次任务不得声称全部完成。不得结束 Excel 进程，不得删除锁文件，也不得覆盖工作簿绕过占用；关闭占用后按同日重跑再次执行完整分析和更新。

## 五、summary.md 输出要求

在作者目录生成或更新 `summary.md`。

`summary.md` 必须包含以下章节：

```markdown
# 冰冰小美 - {DATE} 观点整理

## 总观点

<用一段话概括冰冰小美当天最核心、最一致的判断。只基于当天已抓取帖子，不扩展外部背景，不写投资建议。>

## 分观点

1. 冰冰小美：<一句明确观点>
   证据：<引用或概括当天帖子中的对应依据；只有观点不够明确时才写>

2. 冰冰小美：<一句明确观点>



## 风险提示判定

- 分析覆盖：已分析 X / 已保存 Y，未解决 Z
- 是否写入风险工具：是 / 否 / 待补写 / 已阻断
- 当日累计风险提示次数：N
- 风险等级分布：R1 × A，R2 × B，R3 × C，W1 × D，W2 × E，W3 × F
- 写入文件：`tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx`
- 待验证边界：无 / 具体说明
```

“风险提示判定”是 `risk-analysis.json` 与 `risk-write-status.json` 的可读摘要，不作为 Excel 更新器的输入。

## 六、行为翻译前置要求

在生成「行为翻译」前，必须先检索并阅读当前知识库中与当天帖子主题相关的冰冰小美体系页面。

最低必读页面：

1. `wiki/people/冰冰小美.md`
2. `wiki/concepts/冰冰小美-rule-体系三要素的运用.md`
3. `wiki/concepts/冰冰小美-concept-风险的定义.md`
4. `wiki/concepts/冰冰小美-concept-风险类型整理.md`
5. `wiki/concepts/冰冰小美-分仓.md`
6. `wiki/concepts/冰冰小美-等.md`
7. `wiki/concepts/冰冰小美-rule-减仓.md`
8. `wiki/concepts/冰冰小美-rule-买入不败.md`
9. `wiki/reasoning/冰冰小美如何判断风险转弱的节点.md`
10. `wiki/reasoning/冰冰小美-风险转弱节点如何形成买入窗口.md`

如果当天帖子涉及特定主题，必须追加读取相关概念页、推导页或主题页：

- 情绪、冰点、亏钱效应：读取情绪体系、情绪冰点、亏钱效应相关页面；
- 流动性、宏观风险、外围风险：读取流动性辩证分析、宏观风险信号表、风险敞口相关页面；
- K 型分化、推倒重来、资产配置功能缺失：读取市场结构、风险类型、流动性和情绪位置相关页面；
- 国产算力、AI、半导体、交换机、海外链：读取产业思维、AI、国产科技、产业链相关推导页面；
- ETF、仓位、长持、补仓：读取 ETF 行情、仓位承受力、底线思维、分仓和等待相关页面。

行为翻译只能基于：

1. `{DATE}` 当天已抓取帖子；
2. 已阅读的知识库页面；
3. 明确标注为“待验证”的推断。

不得仅凭模型常识翻译成买卖动作。



## 八、输出边界

1. `总观点` 和 `分观点` 是当天观点汇总，只做作者观点整理。
2. `行为翻译` 是基于冰冰小美体系的执行约束翻译，不是投资建议。
3. 不得把观点写成事实，不得把推测写成结论。
4. 不得省略未验证边界；抓取不完整时必须说明。
5. 中间分析产物只能放入作者目录下的 `processing/`，不要混放在 `summary.md` 同级作为最终读物。

## 九、任务收尾报告

每次运行结束必须明确报告：

1. 目标日期；
2. 作者输出目录；
3. 原始帖保存状态和帖子数量；
4. summary.md 路径；
5. 风险分析覆盖：已保存、已分析、未解决数量；
6. Excel 写入状态：`written / no_risk / removed / pending / blocked`；
7. 当日自动风险提示次数和 R1/R2/R3/W1/W2/W3 分布；
8. 抓取、分析或写入失败边界；
9. 逐帖解读生成数量；
10. 缺失或生成失败的解读文件、对应原帖和失败原因；
11. 人工跟进项。
