# AI-08 Target 候选识别技术设计

> V0.1 · 2026-11-01 · 新目标机器契约提案，待评审、未生成运行Schema、未发布。业务依据：[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-08 Target候选识别|AI-08 提示词 V0.1]]及[[tools/RiskHot/docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0|F02 V1.14]]。不改变 AI-07 身份核定职责。

## 1. 文件职责与固定输入

拟新增 src/event-management/target-recognition-contracts.ts（类型/Schema/校验）、target-recognition.ts（准备/接纳/恢复）；复用 target-identity-contracts.ts 的分类目录与证据校验。标记为新建路径，当前不存在。

输入包含 schema_version=riskhot.target-recognition.input.v1、fact_id、fact_digest、Fact字段原值、material_refs[]、evidence_catalog[]、clues[]、rule_version、category_version、manifest_ref。evidence_catalog每项含 evidence_ref、fact_id、material_id、version、content_digest、segment_id、start_cp、end_cp、quote；clues每项含 clue_ref、raw_text、fact_field、evidence_refs。fact_field仅允许 subject/action/object/description。固定输入保留完整允许语境，不能只传Object名称。

程序构造 clue_ref/evidence_ref，绑定输入摘要，不以名称或数组下标当跨运行身份。无Object/线索仍有Fact语境。输入不含既有Target/Event召回列表；任一必需资料版本或权限不符不调用。

### 1.1 输入类型补充

下列类型与输出类型在同一拟新增contracts文件导出，输入Schema同样禁止额外字段。Fact原字段中的event_status按权威存储七态限定，日期不凭运行时间补齐。

```typescript
type MaterialRef = {material_id:string;version:number;content_digest:string};
type FactFields = {title:string;description:string;subject:string|null;action:string|null;object:string|null;event_status:'expected'|'announced'|'in_progress'|'effective'|'completed'|'cancelled'|'unknown';event_time:string|null};
type RecognitionInput = {
  schema_version:'riskhot.target-recognition.input.v1';
  fact_id:string; fact_digest:string; fact:FactFields;
  material_refs:MaterialRef[];
  evidence_catalog:(MaterialRef & {evidence_ref:string;fact_id:string;segment_id:string;start_cp:number;end_cp:number;quote:string})[];
  clues:{clue_ref:string;raw_text:string;fact_field:'subject'|'action'|'object'|'description';evidence_refs:string[]}[];
  contexts:(MaterialRef & {segments:{id:string;text:string}[]})[];
  rule_version:string; category_version:string; manifest_ref:string;
};
type RecognitionResult = {output:RecognitionOutput;status:'ready'|'no_targets'|'review'|'fact_correction'};
```

contexts仅在调用时从当前资料重建，不把完整内容写回输入引用工件。fact_digest是程序对固定Fact原字段的摘要，不是独立Fact版本。material_refs须与contexts资料集合一致、无重复；证据只能引用该集合，clues及候选依据只能来自evidence_catalog。所有ID/摘要格式及码点上界在运行时校验。

### 1.2 语境证据目录构造与接纳

程序先登记Step 1已经接纳的Fact证据，再为material_refs内每份合法当前资料的完整语境逐段登记可引用片段：以segment_id、码点0至段落长度、逐字quote构造目录项。相同资料/版本/区间去重，evidence_ref由资料身份/版本/摘要/分段/区间确定，不取决于是否已有fact_evidence行。正文内可构造目录项不等于已经证实属于本Fact；任何其他事件的片段都不能仅因同稿而用作本事件依据。

目录与contexts覆盖必须完整且有界于本次允许读取的资料集合；超出任务输入预算时记录INPUT_BUDGET_EXCEEDED并等待受控分段方案，不静默裁掉后文。全段引用用于允许目录，输出通过fact_fields与action_relation指出具体作用关系；程序核验整段精确引文，不能接受模型自行编造更短区间。

若模型引用尚未持久关联本Fact的语境目录项，先核对它是否只是支持已有事实的对象解释。可确定支持且未引入新行动/事实修改时，在接纳事务中追加fact_material/fact_evidence（仍重核资料和权限），复用已有唯一证据键，并保存候选对应；含义有争议先转语义复核，不先建立正式Target关系。若揭示Fact遗漏或混合独立行动，则回Step 1受控修正，不能通过追加证据偷偷改Fact字段。

追加的证据在提交时归属本Fact，再供AI-07与后续关系使用；重复接纳不追加重复行。当前识别运行固定其原输入目录与摘要，证据从目录变为已持久关系不改变该运行的语义输入，也不使自己无限失效；真正增加资料、内容、片段或Fact字段仍触发输入重验。必须测试：对象只在Step 1未引用的另一个正文段落出现、该段属于同稿另一事件、目录超预算、追加后重投四种情况。

## 2. 输出类型

以下为拟实现的 TypeScript 契约；所有对象Schema使用 additionalProperties=false，字段均必需，可空处明确null。标识引用必须属于本输入；字符串须非空白；输出大小受任务包预算限制，超限明确失败，不截断后接纳。

```typescript
type CategoryPair = {primary_category:string;secondary_category:string};
type Candidate = {
  candidate_ref:string; raw_name:string; suggested_name:string|null;
  identity_attributes:{name:string;value:string;evidence_refs:string[]}[];
  jurisdiction:string|null; scope_definition:string|null;
  categories:CategoryPair[]; observation_meaning:string; action_relation:string;
  clue_refs:string[]; fact_fields:('subject'|'action'|'object'|'description')[];
  evidence_refs:string[]; gaps:string[];
};
type RecognitionOutput = {
  schema_version:'riskhot.target-recognition.output.v1';
  fact_id:string; fact_digest:string;
  candidates:Candidate[];
  clue_results:{clue_ref:string;status:'identified'|'unresolved'|'excluded'|'fact_correction';candidate_refs:string[];reason:string;evidence_refs:string[]}[];
  unresolved:{ref:string;candidate_ref:string|null;clue_ref:string|null;reason:string;needed_evidence:string;resume_step:1|2|3;evidence_refs:string[]}[];
  coverage:{context_reviewed:boolean;complete:boolean;uncovered_refs:string[];reason:string};
};
```

数组允许合法空值，但每项候选evidence_refs至少1个；无clue_refs的语境候选须有fact_fields及具体证据。未知身份属性不生成项；分类缺失允许空但必须说明gap；类别配对来自固定目录。

## 3. 接纳算法与结果

接口提案：validateTargetRecognition(input: RecognitionInput, value: unknown): RecognitionResult；RecognitionResult包含 output及status='ready'|'no_targets'|'review'|'fact_correction'，状态由程序推导，模型不决定批准或正式状态。

1. 校验结构、原样fact_id/digest、引用唯一性、分类配对、全部引文码点及资料版本。
2. 每个输入clue_ref恰好一条clue_results；不能缺项、多项或伪造；候选引用均存在、来源对应可核对。identified至少有候选，excluded/fact_correction不引用候选，unresolved须有对应未决说明；fact_correction必须有同clue_ref且resume_step=1的unresolved记录，缺失按覆盖错误拒绝。
3. context_reviewed必须为true才可形成有效语境核对结果；coverage.complete指检查范围完整，不代表未决已解决。complete=true时uncovered_refs为空；complete=false必有范围缺口并转review，不能输出no_targets。
4. 每项候选观测含义、行动作用与证据均明确；语义争议保留review。仅JSON合法不等于语义通过；程序检查引用及已知边界，含义由固定规则评测和必要人工核定保障。
5. no_targets仅在完整覆盖、candidates为空、unresolved为空、无fact_correction时成立；空线索不自动满足该条件。
6. 任一clue_results.status=fact_correction或任一unresolved.resume_step=1均转fact_correction，且二者引用必须对应；其余未完成覆盖或本步语义未决转review；候选的单纯身份/范围缺口交Step 3。混合结果可保留有效子集，受限推进仍需对应授权，不标整批完成。

错误码提案：TARGET_RECOGNITION_SCHEMA_INVALID、TARGET_RECOGNITION_REFERENCE_INVALID、TARGET_RECOGNITION_COVERAGE_INVALID；复用 MATERIAL_BASIS_CHANGED、EVIDENCE_MISMATCH、FORBIDDEN。超时、拒答、截断、空响应是执行失败；不得转no_targets或合法review结果。

## 4. AI-07 交接与持久化

接纳结果通过运行检查点和不可变输出工件保存；复用键含fact_digest、排序证据集合摘要、规则/分类/任务包摘要。重投不得再次调用已有效模型结果。

每项候选映射为既有TargetObject：object_ref由程序对运行身份/输入摘要/candidate_ref生成稳定引用；name=suggested_name（空保持空）、categories/jurisdiction/scope_definition原值；gaps拆为limitations/uncertainties时保留完整原始结果；evidence_refs由目录展开为MaterialEvidence。observation_meaning/action_relation及线索对应保留在识别结果，不能因TargetObject未设同名字段丢弃。

AI-07只接纳已校验的识别候选或经授权的人工修正版本；候选替换后旧身份建议、批准和依赖结果失效。不得调用公开setObjects接口绕过业务事务或冒充人工操作；提取其事务内部能力供受控接纳用例调用。

## 5. 评测与验收

纯契约测试覆盖：一Object多候选、语境新增对象、空Object仍执行、重复/漏线索、伪造证据、跨来源引用、非法分类、合法无对象、部分未决、回Step 1（仅clue标修正却无对应unresolved须拒绝，完整修正记录须转fact_correction）、禁止正式ID/NEW字段。

隔离数据库测试覆盖：同输入重复接纳同工件、不同输入失效、跨来源版本变化/撤权、未知尝试计次、AI-08恢复不清除map_event、对象引用在重试间稳定。模型评测复用已有evaluate-ai07方法但建立独立样例和逐项预期；记录真实模型与任务包，不以夹具测试代替模型评测。

## 6. 2026-11-01工程落实

本技术提案经“按计划实施”进入工程，契约/接纳和接口已实现，部署尚未执行。真实模型评测发现版本名不足以指导分类，输入新增category_catalog，实际提供固定六类目录及二级配对，Schema以const校验其等于发布目录；RecognitionInput增加category_catalog: Record<string,string[]>。证据、版本和事实边界不因模型成功而放宽。实现与两轮评测见[[tools/RiskHot/docs/verification/f02-eight-step|首批工程验证]]。
