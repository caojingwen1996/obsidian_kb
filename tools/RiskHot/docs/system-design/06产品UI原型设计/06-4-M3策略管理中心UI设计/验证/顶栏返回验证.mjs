import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real render and delegated navigation without launching a browser.
const root = new URL('../', import.meta.url);
const elements = new Map();
const listeners = new Map();
const element = selector => {
  if (!elements.has(selector)) elements.set(selector, { hidden: true, innerHTML: '', style: {}, addEventListener() {}, showModal() {} });
  return elements.get(selector);
};
const context = vm.createContext({
  document: {
    querySelector: element,
    querySelectorAll: () => [],
    addEventListener(type, handler) { listeners.set(type, handler); },
  },
  setTimeout: () => 0,
  clearTimeout() {},
});
const html = readFileSync(new URL('M3策略管理中心交互原型.html', root), 'utf8');
for (const [, file] of html.matchAll(/<script defer src="([^"]+)"/g)) {
  // The shared DOM relocation has its own tree-fixture suite.
  if (file === '../原型资源/top-actions.js') continue;
  vm.runInContext(readFileSync(new URL(file, root), 'utf8'), context, { filename: file });
}
let checks = 0;
const check = (name, condition) => { assert.ok(condition, name); checks++; };
const run = code => vm.runInContext(code, context);
check('one return button in the workspace toolbar', /<section class="workspace-toolbar"[^>]*>[^]*id="top-back"[^]*<\/section>/.test(html) && (html.match(/data-action="back"/g) || []).length === 1);
check('return button has a full accessible name', /aria-label="返回策略目录" hidden/.test(html));
for (const view of ['catalog', 'ai', 'evaluation', 'detail', 'panorama']) {
  run(`state.view=${JSON.stringify(view)}; render();`);
  check(view + ': contextual visibility', element('#top-back').hidden === view !== 'detail');
  check(view + ': no duplicate return row', !/data-action="back"|class="strategy-context"/.test(element('#content').innerHTML));
}
for (const role of ['系统管理员', '授权阅读者']) {
  for (const view of ['detail']) {
    run(`Object.assign(state,{view:${JSON.stringify(view)},role:${JSON.stringify(role)},query:'状态',layer:'L2',version:'1.2'}); render();`);
    const before = run('JSON.stringify(strategies)');
    listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'back' }, disabled: false }) } });
    check(role + '/' + view + ': returns to catalog and hides back', run('state.view') === 'catalog' && element('#top-back').hidden);
    check(role + '/' + view + ': preserves filters and version', run("state.query==='状态' && state.layer==='L2' && state.version==='1.2'"));
    check(role + '/' + view + ': preserves strategy records', run('JSON.stringify(strategies)') === before);
  }
}
const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset, disabled: false }) } });
const change = (id, value) => listeners.get('change')({ target: { id, value } });
const tools = () => element('#page-tools').innerHTML;
const body = () => element('#content').innerHTML;
const button = action => tools().match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0];
check('page tools are part of the workspace toolbar', /<section class="workspace-toolbar"[^>]*>[^]*id="page-tools"[^]*<\/section>/.test(html));
const scenes = [
  ['catalog', {}, ['new']],
  ['detail', { detail: 'flow' }, ['copy', 'save', 'validate', 'add-node']],
  ['detail', { detail: 'basic' }, ['copy', 'save']],
  ['detail', { detail: 'dependencies' }, ['copy', 'save']],
  ['detail', { detail: 'history' }, ['copy', 'save', 'review']],
  ['panorama', {}, []],
  ['ai', {}, ['edit-task']],
  ['evaluation', { evalTab: 'compare' }, ['new-eval']],
  ['evaluation', { evalTab: 'datasets' }, ['new-eval', 'revise-dataset']],
  ['evaluation', { evalTab: 'metrics' }, ['new-eval']],
  ['evaluation', { evalTab: 'history' }, ['new-eval']],
];
for (const role of ['系统管理员', '授权阅读者']) {
  for (const [view, extra, actions] of scenes) {
    run(`Object.assign(state,${JSON.stringify({ view, role, selected: 'STR-L2-01', version: '2.0', ...extra })});render();`);
    const actual = [...tools().matchAll(/data-action="([^"]+)"/g)].map(match => match[1]);
    check(`${role}/${view}/${JSON.stringify(extra)}: correct contextual tools`, JSON.stringify(actual) === JSON.stringify(actions));
    for (const action of actions) {
      check(action + ': no duplicate in body', !body().includes(`data-action="${action}"`) || action === 'open');
      if (run(`writeActions.has(${JSON.stringify(action)})`)) check(action + ': original role permission', button(action).includes('disabled') === (role === '授权阅读者'));
    }
    check('version picker stays unique', (tools() + body()).match(/id="version"/g)?.length === (view === 'detail' ? 1 : undefined));
  }
}
run("Object.assign(state,{view:'detail',role:'系统管理员',selected:'STR-L2-01',version:'2.0',detail:'flow'});render();");
change('version', 'V1.2');
check('version change updates top actions and edit permission', !!button('revision') && !button('save') && !run('editable()'));
const original = run('JSON.stringify(record())');
click({ action: 'revision' });
check('create revision updates top toolbar to draft', !!button('save') && !button('revision') && run('editable()'));
check('create revision preserves original version', run("JSON.stringify(strategy().records['1.2'])") === original);
click({ action: 'save' });
check('save still records the audit entry', run("record().audit.at(-1).includes('保存草稿')"));
click({ detail: 'history' });
check('tab switch updates toolbar to governance actions', !!button('review') && !button('add-node') && !button('validate'));
for (const [status, actions] of [['审核中', ['activate', 'return-review']], ['已生效', ['disable']], ['已停用', []]]) {
  run(`record().state=${JSON.stringify(status)};render();`);
  check(status + ': correct governance controls', ['review', 'activate', 'return-review', 'disable'].filter(action => button(action)).join() === actions.join());
}
click({ action: 'panorama' });
check('panorama opens the full system without top controls', tools() === '' && !run('editable()') && run('blueprint()===SYSTEM_PANORAMA'));
click({ view: 'catalog' });
click({ action: 'open', id: 'STR-L0-01', version: '1.0' });
check('pipeline navigation keeps the selected version', run("state.view==='detail' && state.version==='1.0'") && !!button('revision'));
run("Object.assign(state,{view:'ai',role:'系统管理员'});render();");
click({ action: 'edit-task' });
check('task revision still opens the intended form', element('#modal').innerHTML.includes('id="task-form"'));
console.log(`${checks} checks passed. Browser layout verification not included.`);
