import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const results = [];
const check = (name, value) => { assert.ok(value, name); results.push(name); };
const modules = ['06-2-M1信源管理中心UI设计', '06-3-M2风险源管理中心UI设计', '06-4-M3策略管理中心UI设计'];
const entries = ['M1信源管理中心交互原型.html', 'M2风险源管理中心交互原型.html', 'M3策略管理中心交互原型.html'];
for (let i = 0; i < modules.length; i++) {
  const html = read(modules[i] + '/' + entries[i]);
  check(entries[i] + ': shared stylesheet loaded last', html.lastIndexOf('<link') === html.indexOf('<link rel="stylesheet" href="../原型资源/top-actions.css">'));
  check(entries[i] + ': shared script runs after module script', html.indexOf('../原型资源/top-actions.js') > html.indexOf('原型资源/app.js'));
}

// A small tree fixture tests node relocation, lifecycle and form association without a browser.
let mutations = 0;
const all = [];
class Node {
  constructor(tag = 'div', classes = '') { this.tag = tag; this.children = []; this.attrs = {}; this.classes = new Set(classes.split(' ').filter(Boolean)); all.push(this); }
  get classList() { return { add: value => this.classes.add(value) }; }
  set className(value) { this.classes = new Set(value.split(' ')); }
  set id(value) { this.attrs.id = value; }
  get id() { return this.attrs.id; }
  get isConnected() { return this === docRoot || !!this.parentElement?.isConnected; }
  get form() { return this.attrs.form ? all.find(n => n.id === this.attrs.form && n.isConnected) : this.parentElement?.closest('form'); }
  setAttribute(key, value) { this.attrs[key] = value; }
  hasAttribute(key) { return key in this.attrs; }
  matches(selector) { return selector.split(',').some(value => { const s = value.trim(); return s === this.tag || s[0] === '.' && this.classes.has(s.slice(1)) || s[0] === '[' && this.hasAttribute(s.slice(1, -1)); }); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  append(node) { node.remove(); this.children.push(node); node.parentElement = this; mutations++; }
  insertBefore(node, next) { node.remove(); const index = this.children.indexOf(next); this.children.splice(index < 0 ? this.children.length : index, 0, node); node.parentElement = this; mutations++; }
  before(node) { this.parentElement.insertBefore(node, this); }
  remove() { if (!this.parentElement) return; const list = this.parentElement.children; list.splice(list.indexOf(this), 1); this.parentElement = null; mutations++; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) {
    if (selector === '#page-tools') return null;
    if (selector.startsWith(':scope > ')) return this.children.find(n => n.matches(selector.slice(9))) || null;
    return selector.split(', ').map(s => this.querySelectorAll(s)[0]).find(Boolean) || null;
  }
}
const add = (parent, tag, classes) => { const n = new Node(tag, classes); parent.append(n); return n; };
const docRoot = new Node('body');
const header = add(docRoot, 'header', 'topbar');
add(header, 'div', 'm1-breadcrumb'); add(header, 'div', 'top-actions');
const pageBody = add(docRoot, 'main');
const source = add(pageBody, 'section');
const create = add(source, 'button'); create.id = 'create'; create.clickHandler = () => 'new';
const pageCandidates = [create], dialogCandidates = [];
const api = {};
const portalContext = vm.createContext({
  document: {
    body: docRoot,
    querySelector: () => header,
    querySelectorAll: selector => (selector.includes('#search-form') ? pageCandidates : dialogCandidates).filter(n => n.isConnected),
    createElement: tag => new Node(tag),
    createComment: () => new Node('comment'),
  },
  window: { addEventListener() {} },
  MutationObserver: class { observe() {} },
  api,
});
vm.runInContext(read('原型资源/top-actions.js').replace('const observer =', 'Object.assign(api,{sync,moved,pageSelectors,dialogSelectors}); const observer ='), portalContext);
check('page action moved into global header', create.closest('header') === header);
check('moving preserves the original button listener', create.clickHandler() === 'new');
const local = add(pageBody, 'div'); local.setAttribute('data-local-actions', '');
const localAction = add(local, 'button'); localAction.clickHandler = () => 'local';
pageCandidates.push(localAction); api.sync();
check('contextual list action stays in its original group', localAction.parentElement === local);
check('contextual action is not registered for relocation', !api.moved.has(localAction));
check('contextual action retains its original listener', localAction.clickHandler() === 'local');

const before = mutations; api.sync(); api.sync();
check('repeated synchronization is stable', mutations === before);

const dialog = add(docRoot, 'dialog'); dialog.open = true;
const dialogHeader = add(dialog, 'header', 'dialog-header'); add(dialogHeader, 'h2');
const form = add(dialog, 'form'); form.id = 'edit-form';
const footer = add(form, 'footer', 'dialog-footer');
const actions = add(footer, 'div', 'actions');
const submit = add(actions, 'button'); submit.setAttribute('type', 'submit'); submit.setAttribute('name', 'intent'); submit.setAttribute('value', 'review');
dialogCandidates.push(actions); api.sync();
check('dialog actions move into their own header', actions.closest('header') === dialogHeader);
check('submit retains the original owning form', submit.form === form && submit.attrs.form === 'edit-form');
check('submit intent and type are preserved', submit.attrs.type === 'submit' && submit.attrs.value === 'review' && submit.attrs.name === 'intent');
dialog.open = false; api.sync();
check('closed dialog actions do not leak into global toolbar', actions.closest('dialog') === dialog);
dialog.open = true; api.sync();
check('reopening does not duplicate buttons', dialog.querySelectorAll('button').length === 1);

const detail = add(pageBody, 'section');
const detailHeader = add(detail, 'div', 'detail-heading'); add(detailHeader, 'div');
const detailActions = add(detail, 'div', 'detail-actions'); add(detailActions, 'button');
pageCandidates.push(detailActions); api.sync();
check('desktop source detail actions join global toolbar', detailActions.closest('header') === header);
const mobile = add(docRoot, 'dialog'); mobile.id = 'detail-modal'; mobile.open = true; mobile.append(detail); api.sync();
check('mobile source detail actions join modal heading', detailActions.parentElement.parentElement === detailHeader);
mobile.open = false; api.sync();
check('closing mobile detail restores global actions', detailActions.closest('header') === header);
footer.remove(); api.sync();
check('replacing a form removes stale modal actions', !actions.isConnected && !api.moved.has(actions));
source.remove(); api.sync();
check('page rerender removes stale top actions', !create.isConnected && !api.moved.has(create));
for (const selector of ['#group-actions', '#rh-content > .r-back', '#rh-detail > .r-detail-footer > .r-flex', '#rh-content > #rh-edit > .r-form-actions button']) {
  check('page rule: ' + selector, api.pageSelectors.includes(selector));
}
for (const selector of ['dialog .r-governance-actions button', 'dialog .r-indicator-actions button', 'dialog.r-new-dialog .r-form-actions button', 'dialog .modal-foot button']) {
  check('overlay rule: ' + selector, api.dialogSelectors.includes(selector));
}

// Run incumbent render functions against a storage-only DOM fixture. This checks
// emitted states and permissions, not browser layout or selector integration.
function rendererContext() {
  const nodes = new Map();
  const get = key => {
    if (!nodes.has(key)) nodes.set(key, { innerHTML: '', textContent: '', value: '', dataset: {}, style: { setProperty() {} }, children: [], hidden: false, setAttribute() {}, addEventListener() {}, querySelector: get, querySelectorAll: () => [], classList: { add() {}, toggle() {} } });
    return nodes.get(key);
  };
  const window = { addEventListener() {} };
  const context = vm.createContext({ window, document: { getElementById: get, querySelector: get, querySelectorAll: () => [], addEventListener() {} }, structuredClone, URL, setTimeout: () => 0, clearTimeout() {}, matchMedia: () => ({ matches: false }), console });
  return { context, get, run: source => vm.runInContext(source, context) };
}
const m1 = rendererContext();
m1.run(read('../../../src/data/source-catalog.js')); m1.run(read('../../../src/data/source-demo.js')); m1.run(read(modules[0] + '/原型资源/app.js'));
for (const view of ['all', 'verify', 'monitor', 'research']) {
  m1.run(`ctx().view='${view}';render();`);
  check('M1/' + view + ': grouping tools retain their visibility rule', m1.get('group-actions').hidden === (view === 'all'));
}
for (const role of ['both', 'admin', 'operator', 'researcher']) {
  for (const tab of ['archive', 'tech', 'relations', 'history']) {
    m1.run(`Object.assign(state,{role:'${role}',scene:'normal',tab:'${tab}'});ctx().selected=records[0].id;renderDetail();`);
    const detail = m1.get('detail').innerHTML;
    check(`M1/${role}/${tab}: edit permission`, detail.includes('data-action="edit"') === ['both', 'admin'].includes(role));
    check(`M1/${role}/${tab}: status permission`, detail.includes('data-action="status"') === ['both', 'operator'].includes(role));
  }
}
for (const scene of ['loading', 'error', 'denied']) {
  m1.run(`state.scene='${scene}';renderDetail();`);
  check('M1/' + scene + ': no actionable detail emitted', !m1.get('detail').innerHTML.includes('data-action='));
}
const m2 = rendererContext();
m2.run(read(modules[1] + '/原型资源/app.js').replace(/\}\)\(\);\s*$/, 'globalThis.api={state,render,current};})();'));
for (const view of ['sources', 'variables', 'types', 'indicators']) {
  for (const tab of ['definition', ...(view === 'variables' ? ['observations'] : []), 'history']) {
    m2.run(`Object.assign(api.state,{view:'${view}',tab:'${tab}',workspace:null,variableMode:'formal'});api.render();`);
    check(`M2/${view}/${tab}: definition actions emitted`, m2.get('#rh-detail').innerHTML.includes('data-action="edit"') && m2.get('#rh-detail').innerHTML.includes('data-action="feedback"'));
  }
}
for (const workspace of ['revision', 'revisions', 'feedback']) {
  m2.run(`Object.assign(api.state,{view:'variables',workspace:'${workspace}',editing:api.current(),isNew:false});api.render();`);
  check('M2/' + workspace + ': return action emitted', m2.get('#rh-content').innerHTML.includes('data-action="back"'));
}
m2.run("Object.assign(api.state,{view:'variables',workspace:null,variableMode:'candidates'});api.render();");
check('M2/candidates: candidate catalog remains available', m2.get('#rh-content').innerHTML.includes('rh-candidate-rows'));

const report = { date: '2026-10-22', checks: results.length, results, limitation: 'No browser layout, pixel screenshots, or end-to-end browser regression executed; fixtures validate relocation lifecycle, form ownership and incumbent render states.' };
writeFileSync(new URL('三中心操作栏验证结果.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`${results.length} checks passed. Browser visual verification not included.`);
