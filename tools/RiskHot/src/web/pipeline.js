const content = document.querySelector('#content');

try {
  const [viewer, store, layout, { default: graph }] = await Promise.all([
    import('./pipeline-view.js'), import('./pipeline-state.js'), import('./pipeline-layout.js'),
    import('./pipeline-data.js'),
  ]);
  const { state } = store;
  const $ = selector => document.querySelector(selector);
  const node = id => graph.system.nodes.find(item => item.id === id);
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  const locationFor = id => graph.system.stages.find(stage => stage.items.some(item =>
    typeof item === 'string' ? item === id : item.lanes.some(lane => lane.nodes.includes(id))));
  let panorama, panoramaScroll = 0, taskRoute = null, pendingScroll = false;

  function notify(message) {
    $('#feedback').textContent = message;
    $('#feedback').hidden = false;
  }
  function activateLayer(code) {
    state.panoramaLayer = code;
    document.querySelectorAll('[data-stage-target]').forEach(button => {
      const active = document.getElementById(button.dataset.stageTarget)?.dataset.stage === code;
      button.classList.toggle('current', active);
      if (active) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-stage]').forEach(layer => layer.classList.toggle('current-layer', layer.dataset.stage === code));
  }
  function expandNode(target) {
    for (const [selector, key, attribute] of [['[data-flow-layer]', 'panoramaLayersCollapsed', 'flowLayer'], ['.module-card', 'panoramaCollapsed', 'flowModule']]) {
      const ancestor = target?.closest(selector);
      if (!ancestor) continue;
      ancestor.open = true;
      state[key] = state[key].filter(code => code !== ancestor.dataset[attribute]);
    }
  }
  function selectNode(id, reveal = false) {
    const selected = node(id);
    if (!selected) { notify('未找到此步骤，请从流程中重新选择。'); return; }
    state.node = id; state.nodeConfig = false; state.nodeTaskTab = 'definition'; state.nodeTaskKey = '';
    document.querySelectorAll('[data-node]').forEach(button => {
      button.classList.toggle('selected', button.dataset.node === id);
      button.setAttribute('aria-pressed', String(button.dataset.node === id));
    });
    $('.node-detail').outerHTML = viewer.nodeDetail(selected);
    const target = $('[data-node="' + CSS.escape(id) + '"]');
    expandNode(target); activateLayer(locationFor(id)?.code ?? 'M');
    target?.focus({ preventScroll: true });
    const mobile = matchMedia('(max-width:760px)').matches;
    const destination = mobile ? $('.node-detail') : reveal ? target : null;
    destination?.scrollIntoView({ block: mobile ? 'start' : 'center', behavior: motion() });
    if (mobile) $('.node-detail')?.focus({ preventScroll: true });
  }
  function selectNodeTab(tab) {
    const selected = node(state.node), task = selected && viewer.referencedTask(selected);
    if (!task || !viewer.taskTabs.some(([key]) => key === tab)) return;
    state.nodeTaskTab = tab;
    document.querySelectorAll('[data-node-task-tab]').forEach(button => {
      const active = button.dataset.nodeTaskTab === tab;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    const panel = $('#node-task-content');
    panel.innerHTML = viewer.taskContent(task, tab, { embedded: true });
    panel.setAttribute('aria-labelledby', 'node-task-tab-' + tab);
  }
  function renderTask(tab = 'definition') {
    content.innerHTML = viewer.taskPage(taskRoute[1], taskRoute[2], tab);
    document.title = 'RiskHot · AI 任务定义';
  }
  function route() {
    const hash = location.hash || '#panorama';
    if (hash === '#panorama') {
      taskRoute = null;
      if (panorama) {
        content.replaceChildren(panorama); panorama = null;
        window.scrollTo(0, panoramaScroll);
      } else if (!content.querySelector('.system-panorama')) content.innerHTML = viewer.panoramaView();
      layout.observeF01Layout(); document.title = 'RiskHot · 流水线全景';
      if (state.node) $('[data-node="' + CSS.escape(state.node) + '"]')?.focus({ preventScroll: true });
      return;
    }
    if (!panorama && content.querySelector('.system-panorama')) {
      panoramaScroll = window.scrollY;
      panorama = document.createDocumentFragment();
      panorama.append(...content.childNodes);
    }
    layout.disconnectLayout();
    taskRoute = /^#ai\/([A-Z0-9-]+)\/([A-Za-z0-9.-]+)$/.exec(hash);
    if (taskRoute) renderTask();
    else content.innerHTML = '<section class="panel" tabindex="-1"><h2>页面位置不可用</h2><p>请返回全景重新选择步骤或任务。</p><a class="link" href="#panorama">返回流水线全景</a></section>';
    content.querySelector('section.panel')?.focus(); window.scrollTo(0, 0);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.stageTarget) {
      const target = document.getElementById(button.dataset.stageTarget);
      if (target?.matches('details')) target.open = true;
      if (target) activateLayer(target.dataset.stage);
      target?.scrollIntoView({ block: 'start', behavior: motion() });
    } else if (button.dataset.node || button.dataset.selectNode) selectNode(button.dataset.node || button.dataset.selectNode, Boolean(button.dataset.selectNode));
    else if (button.dataset.nodeTaskTab) selectNodeTab(button.dataset.nodeTaskTab);
    else if (button.dataset.taskTab && taskRoute) {
      renderTask(button.dataset.taskTab); $('#task-tab-' + button.dataset.taskTab)?.focus({ preventScroll: true });
    } else if (button.dataset.action === 'return-step') {
      const target = $('[data-node="' + CSS.escape(state.node) + '"]');
      expandNode(target); target?.scrollIntoView({ block: 'center', behavior: motion() }); target?.focus({ preventScroll: true });
    }
  });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab), last = tabs.length - 1;
    tabs[event.key === 'Home' ? 0 : event.key === 'End' ? last : (index + (event.key === 'ArrowRight' ? 1 : last)) % tabs.length].click();
    const key = tab.dataset.nodeTaskTab ? '[data-node-task-tab="' + state.nodeTaskTab + '"]' : '#task-tab-' + state.taskTab;
    $(key)?.focus({ preventScroll: true });
  });
  document.addEventListener('toggle', event => {
    const target = event.target;
    if (!target.isConnected) return;
    if (target.matches('[data-flow-layer]')) {
      state.panoramaLayersCollapsed = state.panoramaLayersCollapsed.filter(code => code !== target.dataset.flowLayer);
      if (!target.open) state.panoramaLayersCollapsed.push(target.dataset.flowLayer);
    }
    if (target.matches('.module-card')) {
      state.panoramaCollapsed = state.panoramaCollapsed.filter(code => code !== target.dataset.flowModule);
      if (!target.open) state.panoramaCollapsed.push(target.dataset.flowModule);
      target.querySelector('[data-module-toggle]').textContent = target.open ? '收起' : '展开';
    }
  }, true);
  document.addEventListener('scroll', () => {
    if (taskRoute || pendingScroll) return;
    pendingScroll = true;
    requestAnimationFrame(() => {
      pendingScroll = false;
      const nav = $('.system-panorama .stage-nav'); if (!nav) return;
      const threshold = nav.getBoundingClientRect().bottom + 28;
      const layers = [...document.querySelectorAll('.system-panorama [data-stage]')];
      const current = layers.filter(layer => layer.getBoundingClientRect().top <= threshold).at(-1) || layers[0];
      if (current) activateLayer(current.dataset.stage);
    });
  }, { passive: true, capture: true });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', layout.disconnectLayout);
  route();
} catch (error) {
  content.innerHTML = '<section class="panel" role="alert"><h2>流水线全景加载失败</h2><p>页面资料暂时无法读取，请重新加载。</p><a class="link" href="/pipeline">重新加载</a></section>';
}
