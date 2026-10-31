import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import vm from 'node:vm';
import { parsePromptDocument, promptDirectory } from '../platform/pipeline-prompt.js';

const root = resolve(import.meta.dirname, '../..');
const prototype = 'docs/system-design/06产品UI原型设计/';
const m3 = prototype + '06-4-M3策略管理中心UI设计/原型资源/';
const panorama = prototype + '06-1-流水线全景ui设计/原型资源/system-panorama.js';
const check = process.argv.includes('--check');
const context = vm.createContext({});
const inputs: Record<string, string> = {};
const digest = (body: string | Buffer) => createHash('sha256').update(body).digest('hex');
async function input(path: string) {
  const body = await readFile(resolve(root, path), 'utf8');
  inputs[path] = digest(body);
  return body;
}
for (const path of [m3 + 'flow-data.js', panorama, m3 + 'task-contracts.js', m3 + 'task-definition-references.js']) {
  vm.runInContext(await input(path), context, { timeout: 2000 });
}
const app = await input(m3 + 'app.js');
vm.runInContext(app.slice(0, app.indexOf('const strategies =')), context, { timeout: 2000 });
const evaluate = (expression: string): any => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
const system = evaluate('SYSTEM_PANORAMA');
const sources = evaluate('FLOW_SOURCES');
sources.FINANCIAL = { title: '金融意义', path: 'docs/system-design/03-系统功能架构/金融意义.md' };
const tasks = evaluate('tasks');
const definitions = evaluate('TASK_DEFINITION_REFERENCES');
const documents: Record<string, { path: string; title: string; sha256?: string; livePrompt?: boolean }> = {};
const registerDocument = async (path: string, title: string) => {
  const key = digest(path).slice(0, 16);
  const body = await input(path);
  documents[key] ??= { path, title, sha256: digest(body) };
  return `/pipeline/documents/${key}`;
};
for (const source of Object.values(sources) as any[]) {
  source.path = await registerDocument(source.path, source.title);
}
for (const ref of Object.values(definitions) as any[]) {
  const [path, anchor] = ref.href.split('#');
  const local = relative(root, resolve(root, prototype, '06-4-M3策略管理中心UI设计', path));
  ref.href = await registerDocument(local, ref.heading) + (anchor ? '#' + anchor : '');
}

const prompts: Record<string, unknown> = {};
for (const name of (await readdir(resolve(root, promptDirectory))).filter(name => name.endsWith('.md')).sort()) {
  const path = `${promptDirectory}/${name}`, body = await readFile(resolve(root, path), 'utf8');
  // Field-only notes have no published prompt identity or complete body.
  if (!/^task_id:/m.test(body)) continue;
  const { task_id } = parsePromptDocument(body, path);
  if (prompts[task_id]) throw new Error(`提示词任务重复：${path}`);
  const key = digest(path).slice(0, 16);
  documents[key] = { path, title: `${task_id} 提示词`, livePrompt: true };
  // Only identity and source location are generated; content is read per HTTP request.
  prompts[task_id] = { sourcePath: path, sourceHref: `/pipeline/documents/${key}` };
}

// The prototype's EventUpdate concept predates the current Fact contract. Keep its
// layout and graph, while quoting the current definitions from their owning document.
const f02Path = 'docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0.md';
const f02 = await input(f02Path);
const domainRow = (heading: string, term: string) => {
  const start = f02.indexOf(heading);
  if (start < 0) throw new Error(`缺少概念章节：${heading}`);
  const section = f02.slice(start + heading.length).split(/\n#{2,3} /)[0]!;
  const row = section.split('\n').filter(line => line.startsWith('|'))
    .map(line => line.split(/(?<!\\)\|/).slice(1, -1).map(cell => cell.trim()))
    .find(cells => cells[0] === term);
  if (!row || row.length !== 3 || !row[1] || !row[2]) throw new Error(`缺少有效领域定义：${heading} / ${term}`);
  return row;
};
const module = system.stages.flatMap((stage: any) => stage.modules ?? []).find((item: any) => item.code === 'F02');
module.conceptSections = '§3.1～3.3';
module.concepts = [
  { name: '事件', term: 'Event' },
  { name: '候选事实', term: 'Fact' },
  { name: '观测主体', term: 'Target' },
  { name: '直接变量', term: 'Variable' },
].map(concept => ({ ...concept,
  definition: domainRow('### 3.1 领域本体', concept.term)[1],
  boundary: domainRow('### 3.1 领域本体', concept.term)[2],
}));

// Reviewed F02 nodes use their own display definitions, never legacy executable contracts.
for (const node of system.nodes.filter((node: any) => node.module === 'F02' && node.reviewed && node.type === 'AI' && node.task)) {
  const source = sources[node.source];
  tasks.push({ id: node.task, version: node.taskVersion, name: node.name, reviewed: true,
    summary: node.summary, ruleDetail: node.ruleDetail, sourceHref: source.path, sourceTitle: source.title,
    section: node.section, inputDescription: node.inputDescription, outputDescription: node.outputDescription,
    pending: '提示词、机器契约与运行接入状态见来源文档。', nodeId: node.id });
}

const usage = evaluate(`Object.entries(DOMAIN_FLOWS).filter(([id])=>id!=='system').map(([id,flow])=>({id,source:flow.source,tasks:[...new Set(flow.nodes.filter(n=>n.type==='AI').map(n=>n.task))]}))`);
const graph = { sources, system, inputs };
const taskData = { tasks, definitions, prompts, usage };
const outputs: Record<string, string> = {
  'src/web/pipeline-data.js': '// Generated by src/scripts/sync-pipeline.ts; edit the owning prototype or business document.\nexport default ' + JSON.stringify(graph, null, 2) + ';\n',
  'src/web/pipeline-tasks.js': '// Generated by src/scripts/sync-pipeline.ts; execution versions are not published here.\nexport default ' + JSON.stringify(taskData, null, 2) + ';\n',
  'src/data/pipeline-documents.json': JSON.stringify(documents, null, 2) + '\n',
};
for (const [path, body] of Object.entries(outputs)) {
  if (check) {
    if (await readFile(resolve(root, path), 'utf8').catch(() => '') !== body) throw new Error(`流水线展示副本未同步：${path}`);
  } else await writeFile(resolve(root, path), body, 'utf8');
}
console.log(`流水线${check ? '同步检查通过' : '展示副本已生成'}：${system.nodes.length}节点、${tasks.length}任务、${Object.keys(prompts).length}提示词、${Object.keys(documents).length}来源文档`);
