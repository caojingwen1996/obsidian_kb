import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pricingDeviationFromText } from '../src/app.mjs';

test('pricing judgement excludes negated and hypothetical bubble mentions', () => {
  assert.equal(pricingDeviationFromText('当前判断：公允价值内；现价相对中枢+1.38%；未证实估值泡沫'), '公允价值内');
  assert.equal(pricingDeviationFromText('普通高估，但不是严重估值泡沫'), '普通高估');
  assert.equal(pricingDeviationFromText('当前判断：证据不足；若盈利落空可能形成估值泡沫'), '证据不足');
  assert.equal(pricingDeviationFromText('未证实估值泡沫'), '');
  assert.equal(pricingDeviationFromText('当前判断：严重估值泡沫；价格远超上限'), '严重估值泡沫');
});

test('XCMG report renders fair value without an active bubble warning', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), 'pricing-deviation-'));
  try {
    const output = join(temp, 'report.html');
    const result = spawnSync(process.execPath, [
      join(root, '.agents/skills/bbxm-equity-research/scripts/render-report-html.cjs'),
      '--input', join(root, 'workbench/targets/2026-07-20-1737-徐工机械-机构级决策研报.md'),
      '--output', output, '--vault-root', root,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(output, 'utf8');
    assert.match(html, /当前判断：公允价值内/);
    assert.doesNotMatch(html, /pricing-level-bubble active/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
