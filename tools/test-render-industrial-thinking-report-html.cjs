const assert = require('node:assert/strict');
const { transformProfitabilityTable, validateFreshnessAudit } = require('./render-industrial-thinking-report-html.cjs');

function audit(status = '通过') {
  return `
**数据源新鲜度审计**

报告截止日：2026-09-03 17:30（Asia/Shanghai）。

| 指标 / 证据 | 发布频率 | 报告使用期 | 截止日最新可得期 | 发布 / 获取日期 | 来源 | 审计结果 |
|---|---|---|---|---|---|---|
| 原铝产量 | 月 | 2026-07 | 2026-07 | 2026-08-17 | 国家统计局 | ${status} |

**声明**
`;
}

assert.doesNotThrow(() => validateFreshnessAudit(audit()));
assert.throws(() => validateFreshnessAudit('**声明**'), /缺少“数据源新鲜度审计”/);
assert.throws(() => validateFreshnessAudit(audit('滞后')), /存在滞后项：原铝产量/);
assert.throws(() => validateFreshnessAudit(audit('最新')), /状态无效：最新/);
assert.throws(
  () => validateFreshnessAudit(audit().replace('| 国家统计局 | 通过 |', '|  | 通过 |')),
  /审计行不完整/,
);

const profitability = `
### 3.4 盈利能力

| 期间 | 营业收入（亿元） | 毛利率 | 经营现金流（亿元） | 资本开支近似值（亿元） | 自由现金流近似值（亿元） |
|---|---:|---:|---:|---:|---:|
| 2025 | 600.43 | 16.79% | 84.32 | 6.41 | 77.92 |
| 2026H1 | 349.81 | 31.84% | 83.77 | 2.06 | 81.71 |

### 3.5 业绩兑现
`;
const visual = transformProfitabilityTable(profitability);
assert.match(visual, /class="profitability-visual"/);
assert.match(visual, /营业收入柱状图与毛利率折线图/);
assert.match(visual, /经营现金流、自由现金流柱状图与资本开支折线图/);
assert.doesNotMatch(visual, /\| 期间 \| 营业收入/);
assert.equal(transformProfitabilityTable('### 3.4 盈利能力\n\n无表格\n\n### 3.5 业绩兑现'), '### 3.4 盈利能力\n\n无表格\n\n### 3.5 业绩兑现');

console.log('render-industrial-thinking-report freshness audit tests passed');
