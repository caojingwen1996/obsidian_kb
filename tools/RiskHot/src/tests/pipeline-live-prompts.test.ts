import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerWeb } from '../runtime/web.js';
import { promptDirectory, parsePromptDocument } from '../platform/pipeline-prompt.js';
import { readPipelineTasks } from '../runtime/pipeline-prompts.js';

const document = (version: string, body: string, task = 'AI-01') => `---\ntask_id: ${task}\ntitle: 最新标题 ${version}\nversion: ${version}\nstatus: 草案 ${version}\n---\n## 3. 提示词正文\n\n\`\`\`\`markdown\n${body}\n\`\`\`\`\n\n## 4. 其他\n正文结束`;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'riskhot-live-prompts-'));
  await mkdir(join(root, promptDirectory), { recursive: true });
  await mkdir(join(root, 'src/web'), { recursive: true });
  const sourcePath = `${promptDirectory}/AI-01.md`, path = join(root, sourcePath);
  const data = { tasks: [{ id: 'AI-01', version: '1.0' }], definitions: { stable: true }, usage: [],
    prompts: { 'AI-01': { sourcePath, sourceHref: '/pipeline/documents/0000000000000001' } } };
  const generated = join(root, 'src/web/pipeline-tasks.js');
  const module = '// Generated fixture\nexport default ' + JSON.stringify(data) + ';\n';
  await writeFile(generated, module);
  await writeFile(path, document('V0.3', '旧正文'));
  const app = Fastify(); registerWeb(app, { pipelineRoot: root });
  return { root, path, generated, module, data, app, async dispose() { await app.close(); await rm(root, { recursive: true, force: true }); } };
}
const decode = (body: string) => JSON.parse(body.replace(/^export default /, '').replace(/;\s*$/, ''));

test('同一服务每次请求读取最新正文及元数据，不同步、不重启、不改变固定任务', async () => {
  const f = await fixture();
  try {
    const first = await f.app.inject('/pipeline/pipeline-tasks.js');
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers['cache-control'], 'no-store');
    assert.match(String(first.headers['content-type']), /javascript/);
    assert.equal(decode(first.body).prompts['AI-01'].body, '旧正文');
    const prompt = '# 新正文\n## 第一层\n内容\n```json\n{"new":true}\n```';
    await writeFile(f.path, document('V0.4', prompt));
    const second = decode((await f.app.inject('/pipeline/pipeline-tasks.js')).body);
    assert.equal(second.prompts['AI-01'].body, prompt);
    assert.equal(second.prompts['AI-01'].title, '最新标题 V0.4');
    assert.equal(second.prompts['AI-01'].version, 'V0.4');
    assert.equal(second.prompts['AI-01'].status, '草案 V0.4');
    assert.notEqual(second.prompts['AI-01'].sourceSha256, decode(first.body).prompts['AI-01'].sourceSha256);
    assert.deepEqual(second.tasks, f.data.tasks);
    assert.deepEqual(second.definitions, f.data.definitions);
    assert.deepEqual(second.usage, f.data.usage);
    assert.equal(await readFile(f.generated, 'utf8'), f.module);
    assert.equal(await readFile(f.path, 'utf8'), document('V0.4', prompt));
  } finally { await f.dispose(); }
});

test('文档损坏、身份不匹配或被删除时只显示读取失败，修复后立即恢复', async () => {
  const f = await fixture();
  try {
    for (const broken of ['损坏正文', document('V0.4', '错误身份正文', 'AI-02')]) {
      await writeFile(f.path, broken);
      const result = decode((await f.app.inject('/pipeline/pipeline-tasks.js')).body);
      assert.equal(result.prompts['AI-01'].status, '读取失败');
      assert.doesNotMatch(result.prompts['AI-01'].body, /旧正文|错误身份正文/);
      assert.deepEqual(result.tasks, f.data.tasks);
    }
    await rm(f.path);
    assert.equal(decode((await f.app.inject('/pipeline/pipeline-tasks.js')).body).prompts['AI-01'].status, '读取失败');
    await writeFile(f.path, document('V0.5', '修复正文'));
    assert.equal(decode((await f.app.inject('/pipeline/pipeline-tasks.js')).body).prompts['AI-01'].body, '修复正文');
  } finally { await f.dispose(); }
});

test('来源路径及符号链接不能越过提示词目录，客户端不能指定任意文件', async () => {
  const f = await fixture();
  try {
    const outside = join(f.root, 'outside.md');
    await writeFile(outside, document('V9', '目录外正文'));
    await rm(f.path); await symlink(outside, f.path);
    assert.equal((await readPipelineTasks(f.root)).prompts['AI-01']!.status, '读取失败');
    f.data.prompts['AI-01'].sourcePath = `${promptDirectory}/../../outside.md`;
    await writeFile(f.generated, '// Generated fixture\nexport default ' + JSON.stringify(f.data) + ';\n');
    assert.equal((await readPipelineTasks(f.root)).prompts['AI-01']!.status, '读取失败');
    assert.equal((await f.app.inject('/pipeline/outside.md')).statusCode, 404);
  } finally { await f.dispose(); }
});

test('真实提示词按当前文档解析，展示源码不包含草稿正文快照', async () => {
  const data = await readPipelineTasks();
  for (const [taskId, prompt] of Object.entries(data.prompts)) {
    const source = await readFile(prompt.sourcePath, 'utf8');
    const expected = parsePromptDocument(source, prompt.sourcePath);
    assert.equal(expected.task_id, taskId);
    assert.equal(prompt.body, expected.body);
    assert.equal(prompt.version, expected.version);
  }
  const module = await readFile('src/web/pipeline-tasks.js', 'utf8');
  const generated = decode(module.slice(module.indexOf('export default ')));
  for (const prompt of Object.values(generated.prompts)) {
    assert.deepEqual(Object.keys(prompt as object).sort(), ['sourceHref', 'sourcePath']);
  }
});
