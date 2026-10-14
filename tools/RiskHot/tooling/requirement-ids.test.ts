import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { extractRequirementIds, readRequirementIds } from './requirement-ids.js';

test('reads requirement headings across document levels without counting prose references', () => {
  const markdown = [
    '### FR-L0-01 信源登记',
    '##### FR-L1-04 正式纳管',
    '###### FR-L2-12 审核交付',
    '- 关联需求：FR-L0-01、FR-L1-04。',
    '| FR-L2-12 | 验收关联 |',
    '### 阶段汇总：FR-L2-12',
  ].join('\n');
  assert.deepEqual(extractRequirementIds(markdown), ['FR-L0-01', 'FR-L1-04', 'FR-L2-12']);
});

test('loads Markdown volumes and rejects duplicate definitions instead of silently merging them', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'riskhot-requirements-'));
  const directoryUrl = pathToFileURL(directory + '/');
  try {
    await Promise.all([
      writeFile(join(directory, '总说明.md'), '# 总说明\n- 参见 FR-L0-01。\n', 'utf8'),
      writeFile(join(directory, '信息处理.md'), '#### FR-L0-01 信源登记\n', 'utf8'),
      writeFile(join(directory, '风险纳管.md'), '#### FR-L1-04 正式纳管\n', 'utf8'),
      writeFile(join(directory, 'notes.txt'), '### FR-OPS-01 非需求文档\n', 'utf8'),
    ]);
    assert.deepEqual((await readRequirementIds(directoryUrl)).sort(), ['FR-L0-01', 'FR-L1-04']);
    await writeFile(join(directory, '重复定义.md'), '### FR-L0-01 重复\n', 'utf8');
    await assert.rejects(readRequirementIds(directoryUrl), /Duplicate functional requirement definition: FR-L0-01/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the requirements collection retains the 51 legacy identities and the two responsibility splits', async () => {
  const actual = await readRequirementIds(new URL('../03-业务功能需求/', import.meta.url));
  const expected = [
    ['CFG', 7], ['L0', 10], ['L1', 8], ['L2', 13], ['PUB', 8], ['OPS', 6], ['DAT', 1],
  ] as const;
  const expectedIds = expected.flatMap(([prefix, count]) =>
    Array.from({ length: count }, (_, index) => `FR-${prefix}-${String(index + 1).padStart(2, '0')}`),
  );
  assert.deepEqual(actual.sort(), expectedIds.sort());
});
