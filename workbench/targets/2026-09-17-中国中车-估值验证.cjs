const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'sources/assets/中国中车/2026-09-17');
const mdPath = path.join(__dirname, '中国中车-机构级决策研报.md');
const htmlPath = path.join(root, 'sources/automations/支柱产业/中国中车-机构级决策研报.html');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const json = name => JSON.parse(read(path.join(out, name + '.json')));
const md = read(mdPath), html = read(htmlPath), model = json('model');
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
check('six required chapters and HTML anchors', () => {
  const names = ['估值摘要', '估值基础', '估值方法与假设', '估值结果与交易溢价', '仓位测算与网格交易', '风险与结论'];
  assert.deepEqual([...md.matchAll(/^## (.+)$/gm)].map(m => m[1]), names.map((x, i) => `${i + 1}. ${x}`));
  assert.equal((html.match(/class="toc-link"/g) || []).length, 6);
  for (let i = 1; i <= 6; i++) assert.equal((html.match(new RegExp(`id="section-${i}"`, 'g')) || []).length, 1);
});
check('one tracking panel with four cards and ordered fundamentals', () => {
  assert.equal((html.match(/<section class="daily-tracking"/g) || []).length, 1);
  assert.equal((html.match(/class="tracking-card"/g) || []).length, 4);
  const card = md.split('| 基本面状态 |')[1].split('\n')[0];
  const fields = ['负债：', '净现金：', '现金流：', '开销合理性：', '真实利润：', '扣除商誉的净资产：', '综合：'];
  const offsets = fields.map(x => card.indexOf(x));
  assert.ok(offsets.every((v, i) => v >= 0 && (!i || v > offsets[i - 1])));
});
const scanSection = md.split('### 4.5 ')[1].split('## 5. ')[0];
const statuses = ['有利', '当期恶化，持续性待确认', '不利信号出现', '证据不足', '不适用'];
const scan = {};
check('32 unique scan items and exact status totals', () => {
  for (const [name, size, expected] of [['基本面', 9, [2, 3, 0, 4, 0]], ['流动性', 14, [1, 1, 0, 12, 0]], ['预期', 9, [3, 2, 0, 4, 0]]]) {
    const section = scanSection.split(`**${name}${size}项**`)[1].split('**')[0];
    const rows = section.split('\n').filter(x => x.startsWith('|')).map(x => x.split('|').slice(1, -1).map(s => s.trim())).filter(x => x.length === 5 && statuses.includes(x[2]));
    assert.equal(rows.length, size);
    assert.equal(new Set(rows.map(x => x[1])).size, size);
    const counts = statuses.map(s => rows.filter(x => x[2] === s).length);
    assert.deepEqual(counts, expected);
    scan[name] = {rows: rows.map(x => ({trigger: x[0], item: x[1], status: x[2], evidence: x[3], gap: x[4]})), counts: Object.fromEntries(statuses.map((s, i) => [s, counts[i]]))};
  }
});
check('valuation arithmetic, recurring earnings stress and Kelly', () => {
  model.values.forEach((v, i) => close(v, model.equity_100m * model.assumptions.asset_recognition[i] * model.assumptions.pb[i] / model.shares_100m));
  close(model.locomotives_revenue_share, 107 / 1316.82442);
  close(model.price_metrics.mid_return_pct, (model.values[1] / model.price - 1) * 100);
  const period = p => model.history.find(x => x.period === p);
  close(period('20251231').recurring + period('20260630').recurring - period('20250630').recurring, 117.22243);
  model.kelly.rows.forEach(row => { close(row.theoretical, row.p / model.kelly.d - (1 - row.p) / model.kelly.u); close(row.half, row.full / 2); });
  for (const h of model.history) close(h.fcf_proxy, h.cfo - h.capex);
  assert.equal(model.price_date, '20260916');
  assert.equal(model.price, 5.96);
});
check('local source links and converted HTML links', () => {
  for (const text of [md, read(path.join(root, 'sources/webpages/2026-09-17-中国中车估值新增来源.md'))]) {
    for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const p = path.join(root, m[1].split('#')[0]);
      assert.ok(fs.existsSync(p) || fs.existsSync(p + '.md'), p);
    }
  }
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    if (/^(?:#|https?:|obsidian:)/.test(m[1])) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(htmlPath), decodeURIComponent(m[1].split('#')[0]))), m[1]);
  }
  assert.ok(!html.includes('[['));
});
check('UTF-8 and no replacement, private-use or common mojibake characters', () => {
  for (const text of [md, html]) assert.ok(!/[\uFFFD\uE000-\uF8FF鍐鐭鎯灏]/u.test(text));
});
check('single authoritative report and intact previous report backup', () => {
  const candidates = fs.readdirSync(__dirname).filter(f => f.endsWith('.md')).filter(f => {
    const front = read(path.join(__dirname, f)).split('---')[1] || '';
    return /artifact_type:\s*equity_research/.test(front) && /601766\.SH/.test(front);
  });
  assert.deepEqual(candidates, ['中国中车-机构级决策研报.md']);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(out, 'previous-report.md'))).digest('hex');
  assert.equal(digest, json('original-report-hash').sha256);
});
check('valid cached JSON and successful official-page / daily Dragon Tiger retries', () => {
  for (const f of fs.readdirSync(out).filter(f => f.endsWith('.json'))) JSON.parse(read(path.join(out, f)));
  assert.ok(json('web-retrieval').every(x => x.status === 'ok'));
  assert.ok(json('top_list-retry-log').every(x => x.status === 'ok'));
});
fs.writeFileSync(path.join(out, 'scan32.json'), JSON.stringify(scan, null, 2), 'utf8');
const result = {status: 'passed', verified_at: new Date().toISOString(), checks, limitations: ['Structural HTML validation only; no browser visual signoff.', 'Economic assumptions and missing evidence remain conditional as documented.']};
fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
