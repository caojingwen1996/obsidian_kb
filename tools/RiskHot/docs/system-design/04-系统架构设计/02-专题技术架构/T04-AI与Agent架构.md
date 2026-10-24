# T04 AI与Agent架构

> V0.3 · 2026-10-24 · 模型是有边界的建议生成器；任务语义引用[L0第6章](../../02-%E4%B8%9A%E5%8A%A1%E6%9E%B6%E6%9E%84%E4%B8%8E%E9%A2%86%E5%9F%9F%E8%AE%BE%E8%AE%A1/RiskHot_L0_%E4%BF%A1%E6%81%AF%E5%A4%84%E7%90%86%E5%B1%82_%E4%B8%9A%E5%8A%A1%E6%9E%B6%E6%9E%84%E4%B8%8E%E9%A2%86%E5%9F%9F%E8%AE%BE%E8%AE%A1V1.0.md)。

## 1. 固定任务包

运行由程序装配task_id、task_version、prompt_version/digest、output_schema_version、模型标识与参数、校验器版本、工具允许清单、方法/字典引用及运行预算，形成不可变method_manifest。模型厂商未暴露精确构建号时如实记录可见标识，不虚构可完全复现的模型版本。

[M3](../../03-%E7%B3%BB%E7%BB%9F%E5%8A%9F%E8%83%BD%E6%9E%B6%E6%9E%84/M3%E7%AD%96%E7%95%A5%E7%AE%A1%E7%90%86%E4%B8%AD%E5%BF%83%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1.md)管理发布；在途执行不读取可变“latest”。AI-01/02提示词V0.1仍是草案，本技术设计不发布它们，也不静默改写原AI@1.0。新增候选上下文契约须形成新Schema并完成兼容评审。

## 2. 一次调用的执行协议

程序准备并冻结TaskInput → 记录Attempt和预算 → 模型适配器调用 → 保存原始响应及结束原因 → 解析结构 → 引用/业务校验 → 形成Proposal与ValidationReport → 授权复核或已批准政策判断 → 程序提交。网络故障、拒答、截断与结构不合法均产生明确失败记录。

共享输出包装采用task_id、input_digest、proposal_items、warnings及程序记录的completion_status；模型自报“完成”不能覆盖适配器的截断/结束状态。候选提取返回完整列表，可为空；各任务的具体建议内容见[AI-01](../03-%E6%A8%A1%E5%9D%97%E6%8A%80%E6%9C%AF%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1/L0-%E4%BF%A1%E6%81%AF%E5%A4%84%E7%90%86%E5%B1%82/F02-%E4%BA%8B%E4%BB%B6%E7%AE%A1%E7%90%86/AI%E4%BB%BB%E5%8A%A1%E6%8A%80%E6%9C%AF%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1/AI-01-%E4%BA%8B%E4%BB%B6%E5%80%99%E9%80%89%E6%8A%BD%E5%8F%96.md)至[AI-05](../03-%E6%A8%A1%E5%9D%97%E6%8A%80%E6%9C%AF%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1/L0-%E4%BF%A1%E6%81%AF%E5%A4%84%E7%90%86%E5%B1%82/F02-%E4%BA%8B%E4%BB%B6%E7%AE%A1%E7%90%86/AI%E4%BB%BB%E5%8A%A1%E6%8A%80%E6%9C%AF%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1/AI-05-%E9%87%91%E8%9E%8D%E6%84%8F%E4%B9%89%E8%AF%84%E4%BB%B7.md)。

## 3. 未正式保存事件时的上下文

F02 Step 6才创建新正式事件，Step 2～5不能假造event_id。新增技术包装EventContextRef：kind=candidate时携candidate_id及候选上下文版本；kind=event时携既有event_id与expected_revision。程序生成并限制模型透传，不能由模型切换kind或身份。

此包装解决[L0业务字段](../../02-%E4%B8%9A%E5%8A%A1%E6%9E%B6%E6%9E%84%E4%B8%8E%E9%A2%86%E5%9F%9F%E8%AE%BE%E8%AE%A1/RiskHot_L0_%E4%BF%A1%E6%81%AF%E5%A4%84%E7%90%86%E5%B1%82_%E4%B8%9A%E5%8A%A1%E6%9E%B6%E6%9E%84%E4%B8%8E%E9%A2%86%E5%9F%9F%E8%AE%BE%E8%AE%A1V1.0.md)以Event描述前序上下文与[F02正式保存时点](../../03-%E7%B3%BB%E7%BB%9F%E5%8A%9F%E8%83%BD%E6%9E%B6%E6%9E%84/F02%20%E4%BA%8B%E4%BB%B6%E7%AE%A1%E7%90%86%E6%A8%A1%E5%9D%97%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1%20V1.0.md)之间的实现差异：前序仍分析同一业务事件建议，Step 6通过身份决策取得真实event_id后才写正式关系。正式EventTarget/EventUpdate/EventRating不得保存candidate_id冒充event_id。未升级Schema的旧任务不能直接接收此新包装。

## 4. 分层校验与权限

| 层 | 程序要求 | 失败去向 |
| --- | --- | --- |
| 执行完整性 | 结束原因正常、覆盖完整、输入匹配、代次有效 | 技术恢复；不得降格为0候选 |
| 结构 | 必填、类型、枚举、长度与数量界限 | 重试或复核 |
| 引用 | ID在允许集合、版本准确、原文定位可解析 | 复核/重新准备 |
| 业务 | 时间、身份、三元关系、增量、评分口径合法 | 指定上游节点或复核 |
| 语义与授权 | 结论得到证据支持、审批绑定该建议 | 未批准不正式提交 |

引用字符串真实不等于解释正确。初始切片在自动通过政策未制定时使用授权人工复核，逐项检查身份、事实与证据；后续自动政策需评测与发布，不以模型自报置信度代替。

## 5. Agent与工具边界

L0任务可由固定调用完成，不要求自治Agent。若后续使用工具，工具仅能读取程序授权的证据包与字典快照，调用次数和返回体有界；不得开放任意网络、SQL、文件写入或业务审批。任务调用不维护独立持久业务状态，不在Temporal之外再创建一套恢复检查点。

原文中的“忽略规则”“调用工具”等均是待分析资料。提示词隔离指令与资料，模型无权限提升途径；输出再经白名单与引用检查。模型原始思维过程不是审计必需品，保存可复核的结论、证据和简要理由即可。

## 6. 故障与质量

供应方降级或模型更换必须记录新的尝试与明确兼容政策，不能在同一manifest下隐形替换。默认保留失败待恢复，不用模型失败生成默认Event、默认评分或无事件结果。程序性质用受控模型替身验证，真实语义质量须另用版本固定的模型和标注样本验证，二者分别记账，见[质量方案](../05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E9%AA%8C%E8%AF%81/AI%E8%B4%A8%E9%87%8F%E8%AF%84%E6%B5%8B/L0%E6%A8%A1%E5%9E%8B%E4%B8%8E%E8%AF%81%E6%8D%AE%E8%B4%A8%E9%87%8F%E8%AF%84%E6%B5%8B%E8%AE%BE%E8%AE%A1.md)。

## 7. 模型适配器与任务执行协议

按照五个固定业务任务定义新的模型调用协议。供应方适配器、任务执行器和业务提交器各有独立职责；接口如下，均为待实现的目标契约。

| 接口/数据 | 确定字段或操作 |
| --- | --- |
| TaskInputEnvelope | contract_version、task_id、manifest_id、processing_id、candidate_id可空、subject_ref可空、input_digest、evidence_pack_ref、definitions_ref可空、payload |
| ModelAdapter.generate | 输入TaskInputEnvelope及runtime_budget；返回ModelResponse或TypedFailure |
| ModelResponse | provider、model、provider_request_id可空、finish_reason、raw_response_artifact_id、output_text、usage、received_at |
| TaskExecutor | prepareInput → createAttempt → generate → persistResponse → validate → acceptProposal |
| ValidationReport | schema_valid、references_valid、business_valid、coverage_valid、errors[]、validator_version |
| TypedFailure | code、retryable、provider_status可空、attempt_id、reason；不得伪装payload=[] |

程序生成信封与input_digest，模型只生成task-specific payload；模型自报的成功、权限、输入摘要和总分不具备权威。模型输出工件和传输结束原因都保存后才解析，日志只保留ID和错误类别。

选定供应方的响应格式由适配器转换，领域任务不读供应方JSON。供应方支持的结构化输出能力经固定模型能力测试后启用；不支持原生Schema约束也必须通过本地Ajv验证，不能因返回JSON文本就算成功。真实模型型号、精确版本和数据政策属于环境绑定，业务契约不绑定某个未来型号。

## 8. Schema编译、引用验证与错误分类

本轮任务契约使用JSON Schema 2020-12，服务启动时用专用Ajv2020编译受控Schema；不接受用户/原文临时传入Schema。所有业务对象默认additionalProperties=false，必需字段列入required；允许未知值的字段明确nullable，不自动用空字符串/0补齐。任务Schema版本与Prompt、模型参数、校验器一起进入manifest。

| 顺序 | 校验内容 | 失败码及去向 |
| --- | --- | --- |
| 1 | 供应响应成功且正常结束；未拒答、未截断，输入覆盖完整 | MODEL_TIMEOUT / MODEL_REFUSED / MODEL_TRUNCATED / INPUT_INCOMPLETE；技术恢复或待处理 |
| 2 | JSON解析、任务Schema、数组上限、字段类型 | MODEL_INVALID_JSON / OUTPUT_SCHEMA_INVALID；保留响应，不接纳建议 |
| 3 | 所有ID来自允许集合；subject_ref、范围和方法不变 | UNKNOWN_REFERENCE / SUBJECT_CHANGED / SCOPE_CHANGED；复核 |
| 4 | 分段属于版本、偏移合法、quote完全相等、映射可回原件 | EVIDENCE_MISMATCH；阻断本步，不生成正式证据 |
| 5 | 各任务业务校验：身份、直接关系、变化、评分输入 | BUSINESS_VALIDATION_FAILED；对应步骤复核 |
| 6 | 当前代次、输入摘要及审批摘要一致 | STALE_PROPOSAL；留存但不推进 |

部分字段“修复”不能由程序静默猜测：仅允许协议明示的格式转换，例如供应方返回值转内部错误码；未知日期、伪ID、缺失引文不能自动补造。人工修正形成新proposal_generation并重新验证。

### 8.1 统一EvidenceRef的精确结构

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EvidenceRefV1",
  "type": "object",
  "additionalProperties": false,
  "required": ["information_version_id", "segment_id", "start_cp", "end_cp", "quote"],
  "properties": {
    "information_version_id": {"type": "string", "format": "uuid"},
    "segment_id": {"type": "string", "format": "uuid"},
    "start_cp": {"type": "integer", "minimum": 0},
    "end_cp": {"type": "integer", "minimum": 1},
    "quote": {"type": "string", "minLength": 1, "maxLength": 4000}
  }
}
```

Schema只能验证类型范围，`end_cp>start_cp`、`end_cp≤段落码点数`及引文相等由程序执行。用户/模型不提供artifact路径；程序沿version→segment→mapping→raw解析。上述URI仅标识Schema方言，不代表运行时下载远程Schema。

## 9. 五任务payload的定版候选

以下为本轮目标Schema的字段契约，尚未发布为M3生效版本。公共EvidenceRef按上节定义；array上限均显式配置，首切片candidates最多50，单项evidence_refs最多20，其他业务列表最多100。所有列出的输出字段均required，标记“可空”的用null表达；未知枚举用UNKNOWN，不造正式ID。

| 任务 | payload字段与类型 | 条件约束及程序交接 |
| --- | --- | --- |
| AI-01 | candidates: Candidate[]；warnings: string[] | Candidate={local_key:string,title:string,description:string,subject_name:string/null,action:string,event_status:string,event_time:TimeValue/null,evidence_refs:EvidenceRef[],missing_fields:string[]}；非空候选至少1项证据；全部合法才固定集合 |
| AI-02 | decision: NEW/REUSE/UNRESOLVED；matched_event_id:uuid/null；comparisons: Comparison[]；reason:string；evidence_refs:EvidenceRef[]；unresolved_issues:string[] | REUSE必须来自召回集合；其他decision不得携带拟正式新ID；Comparison={event_id:uuid,identity_match:boolean/null,reason:string}；UNRESOLVED问题列表非空 |
| AI-03 | targets: TargetRelation[]；variables: VariableRelation[]；definition_candidates: DefinitionCandidate[]；unresolved_issues:string[] | TargetRelation={target_id,definition_version,relation_note,evidence_refs}；VariableRelation={target_id,variable_id,definition_version,relation_type,change_direction,impact_status,description,evidence_refs}；定义候选无正式ID |
| AI-04 | classification:七类枚举；changes: Change[]；source_evidence_refs:EvidenceRef[]；reason:string；unresolved_issues:string[] | Change={local_key:string,update_type:string,summary:string,previous_status:string/null,current_status:string/null,effective_time:TimeValue/null,supersedes_update_ids:uuid[],evidence_refs:EvidenceRef[]}；SOURCE_ADDITION/DUPLICATE不得携changes |
| AI-05 | assessment_scope:object；research_horizon:object；method_version:string；dimensions: Dimension[]；financial_usages:string[]；reasoning_summary:string；limitations:string[] | Dimension={dimension_key:string,score:0～5的number/null,reason:string,evidence_refs:EvidenceRef[]}；范围/期限/方法必须与输入相同；总分、rating_id、批准状态不在模型输出Schema中 |

TimeValue统一为{text:string,start:string/null,end:string/null,precision:timestamp/day/month/year/range/unknown,kind:occurred/announced/expected/unknown,timezone:string/null}。精度不足时不转换成虚假的午夜时间戳；正式events除event_time外保存event_time_text、precision/kind及区间字段，以保留月/年/预计等语义。时区未知时不能偷偷套用服务器时区。

DefinitionCandidate={kind:target/variable,name:string,definition:string,jurisdiction:string/null,unit:string/null,reason:string,evidence_refs:EvidenceRef[]}；枚举relation_type、event_status等由固定业务方法包提供，编译时形成enum，而非模型自由扩充。任务输出类型中的uuid均为字符串格式，业务列表元素默认additionalProperties=false。

### 9.1 AI-01零候选的有效载荷

```json
{"candidates": [], "warnings": []}
```

只有适配器正常结束、覆盖完整且Schema通过时才接纳该结果。`null`、空字符串、只有warnings、超时后缺失响应都不等价于该载荷。模型在同一资料上返回两个候选时，程序将local_key映射到两项稳定candidate_id；后续重试不依赖模型重新给出相同顺序。

### 9.2 输入预算与任务包完整性

首切片runtime_policy规定max_input_tokens=24000、max_output_tokens=8000；具体模型绑定必须经适配验证，证明所用计量方式与上下文上限允许该组合，否则启动检查拒绝该绑定。输入Token计量包含系统指令、Schema、当前资料、召回历史与定义，不只计算正文字符。预算不足返回INPUT_BUDGET_EXCEEDED，不静默截断必要内容；供应方输出截断始终失败。

manifest固定input_schema_digest、output_schema_digest、prompt_digest、model_binding_ref、validator_version、runtime_policy_version及method/definition引用。进入调用与正式提交时都核对这些摘要；模板正文、模型绑定或Schema改变必须使用新的任务包，不以同版本号改内容。

## 10. 严格校验与重复尝试的接受条件

AI 输出校验器固定关闭类型强转、默认值填充和多余字段删除；版本随任务包保存。网络成功、供应方正常结束、覆盖完整、Schema合法、引用有效和业务验证通过缺一不可。格式插件与跨字段校验分别有固定版本；Schema合法只证明结构，无法证明事实解释正确。

同一节点的重试可能得到不同的合法建议。程序先锁 owner 对应的 processing/candidate 行，核对 execution_generation、input_digest 和节点接受状态；第一个符合条件并成功提交的结果成为有效建议，之后的结果仅作为 superseded 尝试保存。接纳 AI-01 时在同一事务生成全部候选 UUID 和启动意图；model local_key 只用于本响应内关联，重复 local_key 拒绝整套候选。

模型 Worker 使用独立运行凭据，仅可访问已分配任务的输入工件、保存响应和尝试状态。候选接纳、业务校验及正式提交由 IO Worker 执行；模型进程不持 information 正式表写权限。人工修正必须形成独立来源和新建议代次，不能把超时尝试直接改为模型成功。
