const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, 'link-report-to-industry.cjs');

function makeFixture({ withIndustry = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-industry-link-'));
  const equity = path.join(dir, '2026-07-20-测试公司-机构级决策研报.html');
  fs.writeFileSync(equity, '<!doctype html><html><head><title>测试公司机构级决策研报</title></head><body></body></html>', 'utf8');
  const industry = path.join(dir, '测试产业完整分析报告.html');
  if (withIndustry) {
    fs.writeFileSync(industry, '<!doctype html><html><body><main><h1>测试产业完整分析报告</h1></main></body></html>', 'utf8');
  }
  return { dir, equity, industry };
}

{
  const { equity, industry } = makeFixture();
  const result = spawnSync(process.execPath, [script, '--equity-html', equity], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const html = fs.readFileSync(industry, 'utf8');
  assert.match(html, /id="equity-research-links"/);
  assert.match(html, /href="\.\/2026-07-20-测试公司-机构级决策研报\.html"/);
  assert.match(html, />测试公司机构级决策研报<\/a>/);

  const rerun = spawnSync(process.execPath, [script, '--equity-html', equity], { encoding: 'utf8' });
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  const rerunHtml = fs.readFileSync(industry, 'utf8');
  assert.equal((rerunHtml.match(/href="\.\/2026-07-20-测试公司-机构级决策研报\.html"/g) || []).length, 1);
}

{
  const { equity, dir } = makeFixture({ withIndustry: false });
  const result = spawnSync(process.execPath, [script, '--equity-html', equity], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /industry-report-not-found/);
  assert.equal(fs.readdirSync(dir).length, 1);
}

console.log('PASS: equity HTML links into an existing industry report and remains idempotent');

const skill = fs.readFileSync(path.join(__dirname, '..', 'SKILL.md'), 'utf8');
assert.match(skill, /link-report-to-industry\.cjs/);
assert.match(skill, /产业研报不存在/);
assert.match(skill, /产业研报已包含个股 HTML 链接/);
