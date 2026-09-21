# InformationProcessingResult 1.0 字段约定

字段结构来自项目 [信息的金融处理](../../../../wiki/concepts/冰冰小美-framework-信息的金融处理.md) 的完整 JSON 示例，[result-template.json](result-template.json) 是其转录。以下填值、ID与证据规则是执行约定；不增加、改名或删减页面字段。

## 对象与时间

- `schema_version` 固定为 `1.0`；`result_id` 为本次唯一结果标识；`generated_at` 用含时区的 ISO 8601 时间。
- `context.mode` 为 `feed`、`monitor`、`target`；observation_target 填实际对象类型、标识和名称，不知道的身份字段用 null。
- `time_window.start/end` 是纳入本轮事件的时间范围；扫描获取窗口不同于事件窗口时，在 JSON 外运行说明中分别记录。时间可以为带时区的时间戳、日期或来源明确的区间文本，不补造时分秒。
- `key_event_id` 指向本结果内已记录的关键事件，没有则 null。预告本身可作为发布事件，不能把未来计划写成已发生事件。
- `pre_event_expectation` 和 `post_event_repricing` 为有出处的简短文本或 null；文本内保留事件/证据编号、观察窗口，不因缺字段而编造预期或价格变化。

## Event 与证据

- `event_id`、`source_id`、`cluster_id`、`phenomenon_id`、`variable_id` 使用可引用的非空标识。复用已有事件和来源ID，不能仅按扫描日期生成同一事件的新身份。
- `fact` 仅写直接可核对的事实。action/object 使用具体动作和对象；传闻或预测以“某来源发布该说法”记录，不能让说法冒充现实结果。value 可为数值、保留范围或修订语义的文本、null；单位与口径不明时保持缺失。
- `source.source_type` 描述原始文件、统计数据、正式披露、研究分析或转述等来源性质；`source_tier` 使用当前框架的核心源、专题源、观察源、线索源，确实未定时 null，不编造S/A信用等级。
- `published_at` 是材料发布时间，不能替代 `fact.time`；`raw_ref` 必须定位真实原文、文件段落、页码或本轮编号材料段落。
- 因子、市场反应或多来源核验需要附加证据时，raw_ref 指向包含各原始链接、数据所属期、指标口径、获取时间和引用位置的证据记录。source 的其他字段描述主要事实来源；反应的其他来源在证据记录中分别列明，不混为同一发布者。
- 当前 Schema 没有独立的核验状态、获取时间、数据所属期、反证和来源集合字段；将这些保存在可追溯证据记录及 JSON 外说明中，不静默丢失，不擅自扩展1.0字段。

## 分类与观察

- `structure.domain`、`hierarchy.level/category` 按对象和当前知识库填写，没有适用分类则 null；通用非金融材料不强塞金融分类。
- `observation_objects` 只列实际相关的对象。`financial_factors` 和 `market_reactions` 无依据时填空数组，不保留全null占位对象。
- direction 仅表示原始指标的描述性变化，如上升、下降、不变；缺依据为 null。不能把因子名称写成风险结论，也不能从行业事件直接推定资金流入。
- 市场反应条目须有实际观测对象及指标；附上观察窗口和口径的证据。不能用未观测的“可能上涨”填充市场反应。

## 时间轴和归纳引用

- `timeline.event_ids` 包含本结果全部 Event，且每项恰好一次。可比较的发生时间升序排列；不明确时间置后，不以发布时间冒充发生时间。
- cluster 由同一核心问题下至少两个非重复的相关 Event 形成；单事件保留于 events/timeline，clusters 可为空。
- 共同现象的 `supporting_event_ids` 必须来自本簇；变量的支持事件与支持现象必须指向本簇已有项。
- `induction_result` 的支持事件和变量同样来自本簇。支持不等于因果已证实；statement 要保留候选解释、反向事实和不能覆盖的变化。
- 如果无法提炼共同变量，可保留已有共同现象、`core_variables: []`，在 statement 中说明缺口；不要强造解释。没有合格簇时 `clusters: []`。
- events、clusters、变量等均不需要为展示模板保留空对象；没有事件时 events、timeline.event_ids、induction.clusters 均为空列表。

## 验证

[output-schema.json](output-schema.json) 检查字段、类型、必需标识和禁止额外字段；[validate_result.py](../scripts/validate_result.py) 进一步检查重复ID、时间轴覆盖、关键事件与簇内支持关系。运行需要 Python 的 `jsonschema` 包；缺少依赖时明确报告，不把未运行当通过。

校验器不负责验证抓取覆盖、事实真伪、时间语义、事件去重质量或归纳解释力，交付时另行核对。
