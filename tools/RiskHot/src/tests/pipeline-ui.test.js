import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { readFileSync } from 'node:fs';
import { panoramaView, nodeDetail, taskPage } from '../web/pipeline-view.js';
import { state } from '../web/pipeline-state.js';
import graph from '../web/pipeline-data.js';
import taskData from '../web/pipeline-tasks.js';
import { readPipelineTasks } from '../runtime/pipeline-prompts.ts';

Object.assign(taskData.prompts, (await readPipelineTasks()).prompts);

test('initial panorama renders all nodes exactly once with independent layer and module disclosures', () => {
  state.node = '';
  const $ = load(panoramaView());
  assert.equal($('[data-flow-layer][open]').length, 4);
  assert.equal($('[data-flow-module]').length, 8);
  assert.equal($('[data-flow-module][open]').length, 0);
  assert.equal($('.node.selected').length, 0);
  assert.equal($('[data-node]').length, graph.system.nodes.length);
  assert.equal(new Set($('[data-node]').map((_, node) => $(node).attr('data-node')).get()).size, graph.system.nodes.length);
  assert.match($('.node-detail').text(), /展开模块并选择步骤/);
  assert.equal($('[style],[onclick],form').length, 0);
  assert.equal($('[data-stage-target]').length, 5);
});

test('each node has readable detail, reachable successors, safe sources and no editing or execution controls', () => {
  for (const node of graph.system.nodes) {
    state.node = node.id;
    const $ = load(nodeDetail(node));
    assert.equal($('.node-detail h2').length, 1, node.id);
    assert.ok($('.node-detail h2').text().includes(node.name), node.id);
    assert.equal($('form,input,select,textarea,[style],[onclick]').length, 0, node.id);
    for (const edge of node.next) assert.ok($('[data-select-node]').toArray().some(element => $(element).attr('data-select-node') === edge.to), `${node.id} → ${edge.to}`);
    for (const anchor of $('a[href]').toArray()) assert.match($(anchor).attr('href'), /^(?:\/pipeline\/documents\/[a-f0-9]{16}|#ai\/)/, node.id);
    if (node.type === 'AI' && node.task) {
      assert.equal($('[data-node-task-tab]').length, 4, node.id);
      assert.equal($('.task-prompt-disclosure[open]').length, 0);
      assert.equal($('.task-prompt-disclosure').length, taskData.prompts[node.task] ? 1 : 0);
    }
  }
  state.node = '';
});

test('fixed task routes never substitute an unavailable version and every valid task tab renders', () => {
  assert.match(taskPage('AI-01', '99.0'), /AI 任务版本不可用/);
  for (const task of taskData.tasks) for (const tab of ['definition', 'schema', 'constraints', 'usage']) {
    const $ = load(taskPage(task.id, task.version, tab));
    assert.equal($('#task-page-content').length, 1);
    assert.ok($('#task-page-content').text().trim(), task.id + '/' + tab);
    assert.equal($('form,[data-action="open"],[style]').length, 0);
  }
});

test('all product shells place the real pipeline entry in the configuration group', () => {
  for (const path of ['src/web/index.html', 'src/web/events.html', 'src/web/pipeline.html']) {
    const $ = load(readFileSync(path, 'utf8'));
    assert.equal($('[aria-labelledby="nav-config"] a[href="/pipeline"]').length, 1, path);
    assert.equal($('[aria-labelledby="nav-content"] a[href="/pipeline"]').length, 0, path);
  }
});

test('prompt tab displays current document text safely without changing task versions', () => {
  const $ = load(taskPage('AI-01', '1.0', 'prompt'));
  const prompt = taskData.prompts['AI-01'];
  assert.equal($('.task-prompt-reference .pre').text(), prompt.body);
  assert.ok($('.task-prompt-reference h3').text().includes(prompt.version));
  assert.equal($('script').length, 0);
  assert.match($('.callout').text(), /未绑定当前 AI 任务版本/);
});


test('reviewed F02 AI detail and tabs never display the legacy task contract', () => {
  for (const node of graph.system.nodes.filter(n => n.module === 'F02' && n.type === 'AI')) {
    state.node = node.id;
    const $ = load(nodeDetail(node));
    assert.ok(!$('.node-detail').text().includes('引用版本不可用'), node.id);
    if (!node.task) { assert.match($('.node-detail').text(), /任务编号待定/); continue; }
    for (const tab of ['definition','schema','constraints','usage']) {
      const text = load(taskPage(node.task, node.taskVersion, tab))('#task-page-content').text();
      assert.ok(text.trim());
      if (tab === 'schema') {
        assert.ok(text.includes(node.inputDescription));
        assert.ok(text.includes(node.outputDescription));
        assert.ok(!text.includes('字段片段草案'));
      }
    }
  }
  state.node = '';
});
