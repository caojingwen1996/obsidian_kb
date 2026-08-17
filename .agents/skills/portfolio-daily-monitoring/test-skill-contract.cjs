const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const template = fs.readFileSync(path.join(root, 'template.md'), 'utf8');
const openai = fs.readFileSync(path.join(root, 'agents', 'openai.yaml'), 'utf8');

assert.match(skill, /当前版本：`1\.2\.1`/);
assert.match(skill, /扫描已生成研报的标的/);
assert.match(skill, /股价变化只更新安全边际/);
assert.match(skill, /价格[\s\S]*?突破估值区间上下沿[\s\S]*?`NO_REVALUE`/);
assert.match(skill, /默认估值重算触发规则/);
assert.match(skill, /距最近完整重估超过 90 天/);
assert.match(skill, /盈利预测 \/ EPS[\s\S]*?5%/);
assert.match(skill, /归母净利润或自由现金流[\s\S]*?10%/);
assert.match(skill, /经营现金流[\s\S]*?15%/);
assert.match(skill, /重大订单 \/ 合同[\s\S]*?5%/);
assert.match(skill, /总股本[\s\S]*?3%/);
assert.match(skill, /可比公司估值[\s\S]*?15%/);
assert.match(skill, /WACC关键输入[\s\S]*?0\.5 个百分点/);

for (const status of ['NO_REVALUE', 'LIGHT_REVALUE', 'FULL_REVALUE', 'MANUAL_REVIEW']) {
  assert.match(skill, new RegExp(`\\b${status}\\b`));
  assert.match(template, new RegExp(`\\b${status}\\b`));
}

for (const judgment of ['强化', '无实质影响', '轻微削弱', '明显削弱', '逻辑失效', '信息不足']) {
  assert.match(skill, new RegExp(judgment));
}

assert.match(skill, /四类估值处置状态与六类投资逻辑判断分别输出/);
assert.match(skill, /未真正执行重算前不得给出新的估值区间/);
assert.match(skill, /股价上涨 8%[\s\S]*?`NO_REVALUE`/);
assert.match(skill, /盈利预测上调 7%[\s\S]*?`LIGHT_REVALUE`/);
assert.match(skill, /净利润预测上调 12%[\s\S]*?`FULL_REVALUE`/);
assert.match(skill, /原研报没有收入基线[\s\S]*?`MANUAL_REVIEW`/);
assert.match(template, /#### 6\. 估值输入变化与重算判断/);
assert.match(skill, /第二章“重点变化摘要”必须直接给出“是否需要继续阅读后续章节”的快速结论/);
assert.match(template, /### 快速阅读结论/);
assert.match(template, /是否需继续阅读/);
assert.match(template, /无需继续阅读后续章节/);
assert.match(template, /需要继续阅读后续章节/);
assert.match(template, /## 三、八类监控项结果/);
assert.doesNotMatch(template, /逐标的监控|个股监控结果/);
assert.match(template, /## 五、估值重算队列/);
assert.match(template, /原模型值[\s\S]*?最新值[\s\S]*?触发阈值/);
assert.match(template, /本次监控没有标的进入估值重算队列/);
assert.match(openai, /识别估值重算和人工复盘触发器/);

console.log('PASS: portfolio daily monitoring skill contract');
