import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import graph from '../web/pipeline-data.js';
import taskData from '../web/pipeline-tasks.js';

test('115-node product graph retains every prototype identity, role, branch, dependency and display number', () => {
  const context = vm.createContext({});
  for (const path of [
    'docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/原型资源/flow-data.js',
    'docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/原型资源/system-panorama.js',
  ]) vm.runInContext(readFileSync(path, 'utf8'), context);
  const original = JSON.parse(vm.runInContext('JSON.stringify(SYSTEM_PANORAMA)', context));
  assert.equal(graph.system.nodes.length, 115);
  assert.deepEqual(graph.system.nodes, original.nodes);
  const originalStages = structuredClone(original.stages), stages = structuredClone(graph.system.stages);
  for (const items of [originalStages, stages]) for (const stage of items) for (const module of stage.modules ?? []) {
    if (module.code === 'F02') { delete module.concepts; delete module.conceptSections; }
  }
  assert.deepEqual(stages, originalStages);
  const ids = new Set(graph.system.nodes.map(node => node.id));
  assert.equal(ids.size, 115);
  for (const node of graph.system.nodes) {
    for (const edge of node.next) assert.ok(ids.has(edge.to), `${node.id} → ${edge.to}`);
    for (const id of node.requiresAll ?? []) assert.ok(ids.has(id), id);
    if (node.type === 'AI') assert.ok(taskData.tasks.some(task => task.id === node.task && task.version === node.taskVersion));
  }
});

test('Fact concepts and prompt references use current source paragraphs and retain draft versions', () => {
  const modules = graph.system.stages.flatMap(stage => stage.modules ?? []);
  const concepts = modules.find(module => module.code === 'F02').concepts;
  assert.deepEqual(concepts.map(concept => concept.term), ['Event', 'Fact', 'Target', 'Variable']);
  const source = readFileSync('docs/system-design/03-系统功能架构/F02 事件管理模块功能设计 V1.0.md', 'utf8');
  for (const concept of concepts) assert.ok(source.includes(concept.definition), concept.term);
  assert.equal(taskData.tasks.length, 16);
  assert.equal(Object.keys(taskData.prompts).length, 5);
  for (const prompt of Object.values(taskData.prompts)) {
    assert.ok(readFileSync(prompt.sourcePath, 'utf8').includes(prompt.body));
    assert.match(prompt.sourceHref, /^\/pipeline\/documents\/[a-f0-9]{16}$/);
    assert.ok(prompt.status); assert.ok(prompt.version);
  }
});
