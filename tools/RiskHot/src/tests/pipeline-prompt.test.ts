import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractPromptBody } from '../platform/pipeline-prompt.js';

const document = (content: string) => `# 文档\n## 2. 输入与输出语义\n旧说明\n## 3. 提示词正文\n\n${content}\n\n## 4. 程序交接与验证\n不属于提示词`;

test('兼容原有 text 围栏及 CRLF', () => {
  assert.equal(extractPromptBody(document('```text\n原文\n```').replace(/\n/g, '\r\n'), 'legacy.md'), '原文');
});

test('完整保留四反引号内的四层标题和 JSON 围栏，排除外部说明', () => {
  const prompt = '# V0.3\n## 第一层\n正文\n## 第二层\n```json\n{"value": 1}\n```\n## 第三层\n步骤\n## 第四层\n输出';
  assert.equal(extractPromptBody(document(`> 修订说明\n\n\`\`\`\`markdown\n${prompt}\n\`\`\`\``), 'nested.md'), prompt);
});

test('较短或不同字符的围栏不能提前结束正文', () => {
  const prompt = '第一行\n```\n~~~\n末行';
  assert.equal(extractPromptBody(document(`\`\`\`\`text\n${prompt}\n\`\`\`\``), 'fences.md'), prompt);
});

test('拒绝未闭合围栏，避免生成截断或包含后续章节的副本', () => {
  assert.throws(() => extractPromptBody(document('````markdown\n正文\n```'), 'unclosed.md'), /未闭合/);
});

test('拒绝缺失、空白或多个提示词代码块', () => {
  for (const content of ['说明', '```text\n \n```', '```text\n甲\n```\n```markdown\n乙\n```']) {
    assert.throws(() => extractPromptBody(document(content), 'invalid.md'), /一个非空/);
  }
  assert.throws(() => extractPromptBody('## 4. 其他\n```text\n误读\n```', 'missing.md'), /一个非空/);
});

test('实际 AI-01 文档完整提取四层及所有 JSON 示例', () => {
  const source = readFileSync('docs/system-design/03-系统功能架构/AI任务与提示词/AI-01 候选事件提取.md', 'utf8');
  const body = extractPromptBody(source, 'AI-01');
  assert.equal((body.match(/^## 第[一二三四]层：/gm) ?? []).length, 4);
  const examples = [...body.matchAll(/^```json\n([\s\S]*?)\n```$/gm)];
  assert.equal(examples.length, 7);
  for (const example of examples) JSON.parse(example[1]!);
  assert.ok(body.endsWith('**现在根据调用方提供并已完成前置校验的 material，执行事件候选抽取。**'));
  assert.ok(!body.includes('修订说明（2026-10-28）'));
  assert.ok(!body.includes('## 4. 程序交接与验证'));
});


test('按章节名称读取第三节或第四节完整四层提示词，排除示例章节', () => {
  for (const name of ['AI-03 Event增量识别.md', 'AI-08 Target候选识别.md']) {
    const source = readFileSync('docs/system-design/03-系统功能架构/AI任务与提示词/' + name, 'utf8');
    const body = extractPromptBody(source, name);
    assert.equal((body.match(/^## 第[一二三四]层：/gm) ?? []).length, 4);
    assert.ok(body.startsWith('# RiskHot AI-'));
    assert.ok(!body.includes('## 5. 合成示例'));
    assert.ok(!body.includes('## 4. 程序接纳与下游交接'));
  }
});
