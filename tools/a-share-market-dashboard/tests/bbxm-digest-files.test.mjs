import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findBbxmDigestGroups } from '../scripts/bbxm-digest-files.mjs';

test('BBXM groups monthly files and legacy layouts without including processing files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bbxm-digest-'));
  try {
    for (const filename of [
      '2026/10/2026-10-16_120700_月目录原帖.md',
      '2026/10/2026-10-16_summary.md',
      '2026/10/2026-10-16_操作.md',
      '2026/10/2026-10-16_processing_extract.md',
      '2026/10/2026-10-16_120700_月目录原帖_解读.md',
      '2026/09/2026-09-28/103700_旧年月日原帖.md',
      '2026/09/2026-09-28/summary.md',
      '2026/09/2026-09-28/processing/111111_中间文件.md',
      '2026-07-30/冰冰小美/162100_旧作者目录原帖.md',
      '2026-07-30/冰冰小美/summary.md',
      '_运行状态.md',
    ]) {
      const path = join(root, filename);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, '# 原文\n', 'utf8');
    }
    const groups = (await findBbxmDigestGroups(root)).sort((a, b) => a.date.localeCompare(b.date));
    assert.deepEqual(groups.map(group => [group.date, group.files.length]), [
      ['2026-07-30', 1], ['2026-09-28', 1], ['2026-10-16', 1],
    ]);
    assert.equal(groups[2].files[0].name, '120700_月目录原帖.md');
    assert.equal(groups[2].summaryPath, join(root, '2026/10/2026-10-16_summary.md'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('BBXM missing source directory returns no groups', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bbxm-missing-'));
  try {
    assert.deepEqual(await findBbxmDigestGroups(join(root, 'missing')), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
