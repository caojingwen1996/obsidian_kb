import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { taskSchemas, type Evidence, type IdentityProposal } from '../event-management/contracts.js';
import { parsePromptDocument } from '../platform/pipeline-prompt.js';

const path = 'docs/system-design/03-系统功能架构/AI任务与提示词/AI-02 Event同一性判断.md';
const source = readFileSync(path, 'utf8');
const prompt = parsePromptDocument(source, path);
type MaterialEvidence = Omit<Evidence, 'information_version_id'> & {
  material_id: string;
  material_version: number;
  material_digest: string;
};
type DraftIdentityProposal = Omit<IdentityProposal, 'evidence_refs'> & { evidence_refs: MaterialEvidence[] };
// 仅验证文档草案；复制未变的外层约束，不修改或发布运行 Schema。
const draftSchema = structuredClone(taskSchemas['AI-02']) as { properties: Record<string, object> };
draftSchema.properties.evidence_refs = {
  type: 'array', minItems: 1, maxItems: 20,
  items: {
    type: 'object', additionalProperties: false,
    required: ['material_id', 'material_version', 'material_digest', 'segment_id', 'start_cp', 'end_cp', 'quote'],
    properties: {
      material_id: { type: 'string', minLength: 1 },
      material_version: { type: 'integer', minimum: 1 },
      material_digest: { type: 'string', minLength: 1 },
      segment_id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
      start_cp: { type: 'integer', minimum: 0 },
      end_cp: { type: 'integer', minimum: 1 },
      quote: { type: 'string', minLength: 1, maxLength: 4000 },
    },
  },
};
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile(draftSchema);
const validateRuntime = ajv.compile(taskSchemas['AI-02']!);
const reuse: DraftIdentityProposal = JSON.parse(/合法输出结构示例：\n\n```json\n([\s\S]*?)\n```/.exec(prompt.body)![1]!);
const exampleSection = source.slice(source.indexOf('## 4. 输入与输出示例'));
const examples = [...exampleSection.matchAll(/^```json\n([\s\S]*?)\n```$/gm)].map(match => JSON.parse(match[1]!));

test('AI-02 四层正文可被展示读取，定位为 Step 3 且保留发布边界', () => {
  assert.equal(prompt.task_id, 'AI-02');
  assert.equal(prompt.version, 'V0.4');
  assert.deepEqual(prompt.body.match(/^## 第[一二三四]层：.+$/gm), [
    '## 第一层：核心认知原则',
    '## 第二层：领域判断规则',
    '## 第三层：执行步骤',
    '## 第四层：输出契约',
  ]);
  assert.equal(prompt.body.trim(), readFileSync('src/prompts/02.event-identity-judgment.md', 'utf8').trim());
  assert.match(prompt.body, /Step 3/);
  assert.match(prompt.status, /待实现及评测/);
});

test('三类文档输出示例符合 material 草案结构，旧运行契约仍待适配', () => {
  const outputs = [reuse, ...examples.slice(1)] as DraftIdentityProposal[];
  assert.deepEqual(outputs.map(item => item.decision), ['REUSE', 'NEW', 'UNRESOLVED']);
  for (const output of outputs) {
    assert.ok(validate(output), JSON.stringify(validate.errors));
    assert.equal(validateRuntime(output), false, '草案校验通过不能冒充运行契约已迁移');
    if (output.decision === 'REUSE') {
      assert.equal(output.comparisons.filter(item => item.identity_match === true).length, 1);
      assert.equal(output.matched_event_id, output.comparisons.find(item => item.identity_match === true)!.event_id);
      assert.ok(output.comparisons.every(item => item.identity_match !== null));
    } else assert.equal(output.matched_event_id, null);
    if (output.decision === 'NEW') assert.ok(output.comparisons.every(item => item.identity_match === false));
    if (output.decision === 'UNRESOLVED') assert.ok(output.unresolved_issues.length > 0);
  }
});

test('合成输入的证据区间、归属及 REUSE 双方证据可核对', () => {
  const input = examples[0];
  assert.equal(input.retrieval.status, 'COMPLETE');
  assert.equal(input.retrieval.coverage_sufficient, true);
  assert.equal(input.retrieval.truncated, false);
  for (const entry of input.evidence_catalog as { evidence: MaterialEvidence; segment_text: string }[]) {
    const evidence = entry.evidence;
    assert.equal([...entry.segment_text].slice(evidence.start_cp, evidence.end_cp).join(''), evidence.quote);
  }
  assert.deepEqual(reuse.evidence_refs[0], input.candidate.evidence_refs[0]);
  assert.deepEqual(reuse.evidence_refs[1], input.retrieval.existing_events[0].evidence_refs[0]);
  assert.equal(input.evidence_catalog[0].owner_ref, input.candidate.candidate_ref);
  assert.equal(input.evidence_catalog[1].owner_ref, reuse.matched_event_id);
  assert.ok(input.candidate.fact_ids.includes(input.evidence_catalog[0].fact_id));
  assert.ok(input.retrieval.existing_events[0].fact_ids.includes(input.evidence_catalog[1].fact_id));
  assert.notEqual(reuse.evidence_refs[0]!.material_id, reuse.evidence_refs[1]!.material_id);
  assert.notEqual(reuse.evidence_refs[0]!.material_version, reuse.evidence_refs[1]!.material_version);
  assert.notEqual(reuse.evidence_refs[0]!.material_digest, reuse.evidence_refs[1]!.material_digest);
});

test('目标草案拒绝旧枚举、免审字段和字符串证据', () => {
  for (const invalid of [
    { ...reuse, decision: 'MATCH_EXISTING' },
    { ...reuse, decision: 'NEW_EVENT' },
    { ...reuse, requires_review: false },
    { ...reuse, evidence_refs: ['C-EV-01'] },
  ]) assert.equal(validate(invalid), false);
});

test('material 草案拒绝独立版本 ID、缺失摘要及非法版本值', () => {
  const evidence = reuse.evidence_refs[0]!;
  for (const patch of [
    { material_version: 0 }, { material_version: -1 }, { material_version: 1.5 },
    { material_version: '22222222-2222-4222-8222-222222222222' },
    { material_version: undefined }, { material_digest: '' }, { material_digest: undefined },
    { material_id: '' }, { information_version_id: '22222222-2222-4222-8222-222222222222' },
  ]) assert.equal(validate({ ...reuse, evidence_refs: [{ ...evidence, ...patch }] }), false);
  assert.doesNotMatch(source, /information_version_id|\bInformation\b/);
});
