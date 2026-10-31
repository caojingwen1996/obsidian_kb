import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import graph from '../web/pipeline-data.js';
import taskData from '../web/pipeline-tasks.js';
import { promptDirectory, parsePromptDocument } from '../platform/pipeline-prompt.ts';

test('product graph retains every source identity, role, branch, dependency and display number', () => {
  const context = vm.createContext({});
  for (const path of [
    'docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/原型资源/flow-data.js',
    'docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/原型资源/system-panorama.js',
  ]) vm.runInContext(readFileSync(path, 'utf8'), context);
  const original = JSON.parse(vm.runInContext('JSON.stringify(SYSTEM_PANORAMA)', context));
  assert.equal(graph.system.nodes.length, original.nodes.length);
  assert.deepEqual(graph.system.nodes, original.nodes);
  const originalStages = structuredClone(original.stages), stages = structuredClone(graph.system.stages);
  for (const items of [originalStages, stages]) for (const stage of items) for (const module of stage.modules ?? []) {
    if (module.code === 'F02') { delete module.concepts; delete module.conceptSections; }
  }
  assert.deepEqual(stages, originalStages);
  const ids = new Set(graph.system.nodes.map(node => node.id));
  assert.equal(ids.size, graph.system.nodes.length);
  for (const node of graph.system.nodes) {
    for (const edge of node.next) assert.ok(ids.has(edge.to), `${node.id} → ${edge.to}`);
    for (const id of node.requiresAll ?? []) assert.ok(ids.has(id), id);
    if (node.type === 'AI' && node.task) assert.ok(taskData.tasks.some(task => task.id === node.task && task.version === node.taskVersion));
  }
});

test('领域概念引用本体定义与边界，提示词引用不包含生成正文', () => {
  const modules = graph.system.stages.flatMap(stage => stage.modules ?? []);
  const module = modules.find(module => module.code === 'F02');
  const concepts = module.concepts;
  assert.equal(module.conceptSections, '§3.1～3.3');
  assert.deepEqual(concepts.map(concept => concept.term), ['Event', 'Fact', 'Target', 'Variable']);
  const source = readFileSync('docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0.md', 'utf8');
  const ontology = source.split('### 3.1 领域本体')[1].split('### 3.2 领域属性')[0];
  for (const concept of concepts) {
    const row = ontology.split('\n').find(line => line.split('|')[1]?.trim() === concept.term);
    assert.ok(row, concept.term);
    const cells = row.split('|').map(cell => cell.trim());
    assert.equal(concept.definition, cells[2], concept.term);
    assert.equal(concept.boundary, cells[3], concept.term);
  }
  assert.equal(taskData.tasks.filter(task => !task.reviewed).length, 16);
  const sourceIds = readdirSync(promptDirectory).filter(name => name.endsWith('.md')).filter(name => /^task_id:/m.test(readFileSync(`${promptDirectory}/${name}`, 'utf8'))).map(name => parsePromptDocument(readFileSync(`${promptDirectory}/${name}`, 'utf8'), name).task_id);
  assert.deepEqual(Object.keys(taskData.prompts).sort(), sourceIds.sort());
  for (const prompt of Object.values(taskData.prompts)) {
    assert.ok(readFileSync(prompt.sourcePath, 'utf8'));
    assert.match(prompt.sourceHref, /^\/pipeline\/documents\/[a-f0-9]{16}$/);
    assert.deepEqual(Object.keys(prompt).sort(), ['sourceHref', 'sourcePath']);
    assert.equal(graph.inputs[prompt.sourcePath], undefined);
  }
});


test('F02 follows the reviewed eight steps and separates save, delivery and association', () => {
  const nodes = graph.system.nodes.filter(node => node.module === 'F02');
  const node = id => nodes.find(item => item.id === id);
  const steps = new Set(nodes.map(item => item.panoramaStep.match(/^Step (\d+)/)?.[1]).filter(Boolean));
  assert.deepEqual([...steps].sort(), ['1','2','3','4','5','6','7','8']);
  for (const [id,task] of Object.entries({'EV-A1':'AI-01','EV-TARGET-AI':'AI-08','EV-A2':'AI-02','EV-TARGET-MATCH':'AI-07','EV-A5':'AI-03','EV-VARIABLE':'AI-05','EV-ASSOC':'AI-04'})) {
    assert.equal(node(id).task, task);
    const definition = taskData.tasks.find(t => t.id === task && t.version === node(id).taskVersion);
    assert.equal(definition.reviewed, true);
    assert.equal(definition.name, node(id).name);
  }
  assert.match(node('EV-VARIABLE').ruleDetail, /Target 确认不是识别前提/);
  assert.match(node('EV-VARIABLE').ruleDetail, /定义与具体值分离/);
  assert.ok(node('EV-P2').next.some(edge => edge.to === 'EV-ASSOC-PREP'));
  assert.ok(node('EV-P2').next.some(edge => edge.to === 'EV-DELIVER'));
  assert.ok(!node('EV-ASSOC-SAVE').next.some(edge => edge.to === 'EV-P2'));
  assert.ok(!node('EV-DELIVER').next.some(edge => edge.to === 'EV-ASSOC-PREP'));
  assert.ok(!node('EV-ASSOC-SAVE').next.some(edge => edge.to === 'EV-DELIVER'));
  assert.equal(node('RATE-A1').task, null);
  assert.equal(node('EV-USAGE').task, null);
  for (const id of ['RATE-DECIDE','RATE-A1','RATE-CALC','EV-USAGE']) assert.equal(node(id).source, 'FINANCIAL');
  assert.match(graph.sources.FINANCIAL.path, /^\/pipeline\/documents\/[a-f0-9]+$/);
});
