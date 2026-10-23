// Move existing controls; preserve their listeners, permissions and form ownership.
(() => {
  'use strict';
  const moved = new Map();
  let formNumber = 0;
  const globalHeader = document.querySelector('.topbar, .r-top, .top');
  if (!globalHeader) return;
  globalHeader.classList.add('unified-top-row');
  let globalTools = globalHeader.dataset?.toolsTarget
    ? document.querySelector(globalHeader.dataset.toolsTarget)
    : globalHeader.querySelector('#page-tools');
  if (!globalTools) {
    globalTools = document.createElement('div');
    globalTools.className = 'unified-tools';
    globalTools.setAttribute('role', 'group');
    globalTools.setAttribute('aria-label', '当前页面操作');
    globalHeader.insertBefore(globalTools, globalHeader.children[1] || null);
  }
  const pageSelectors = [
    '#search-form > #create',
    '#group-actions',
    '#detail .detail-actions',
    '#detail .detail-close',
    '#detail-panel [data-action="refresh-tech"]',
    '#detail-panel > section > [data-action="external"]',
    '#detail-panel > [data-action="relation-error"]',
    '#detail-panel > [data-action="refresh-relations"]',
    '#rh-content > .r-section-title > [data-action="new"]',
    '#rh-content > .r-govern-link > [data-action="governance"]',
    '#rh-content > .r-back',
    '#rh-detail > .r-detail-footer > .r-flex',
    '#rh-detail .r-variable-indicators > .r-between > [data-action="link-indicator"]',
    '#rh-content > #rh-edit > .r-form-actions button',
    '#rh-content > #rh-feedback > .r-form-actions button',
  ];
  const dialogSelectors = [
    'dialog .dialog-footer > .actions',
    'dialog .dialog-footer > button',
    'dialog .r-indicator-actions button',
    'dialog .r-governance-actions button',
    'dialog.r-new-dialog .r-form-actions button',
    'dialog .modal-foot button',
  ];
  function destination(home) {
    const dialog = home.parentElement?.closest('dialog');
    if (!dialog || dialog.id === 'detail-modal' && !dialog.open) return globalTools;
    const header = dialog.querySelector('.dialog-header, .r-dialog-header, .modal-head, .detail-heading');
    if (!header) return null;
    let tools = header.querySelector(':scope > .unified-tools');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'unified-tools';
      tools.setAttribute('role', 'group');
      tools.setAttribute('aria-label', '当前弹层操作');
      header.classList.add('unified-action-header');
      header.insertBefore(tools, header.querySelector(':scope > button'));
    }
    return tools;
  }
  function bindForms(element) {
    const buttons = element.matches('button') ? [element] : element.querySelectorAll('button');
    for (const button of buttons) {
      const form = button.form;
      if (!form || button.hasAttribute('form')) continue;
      if (!form.id) form.id = 'top-actions-form-' + ++formNumber;
      button.setAttribute('form', form.id);
    }
  }
  function move(element) {
    if (moved.has(element) || element.closest('.unified-tools, [data-local-actions]')) return;
    const home = document.createComment('original action position');
    element.before(home);
    bindForms(element);
    moved.set(element, home);
  }
  function sync() {
    for (const [element, home] of moved) {
      if (!home.isConnected || !element.isConnected) {
        element.remove();
        home.remove();
        moved.delete(element);
      }
    }
    for (const element of document.querySelectorAll(pageSelectors.join(','))) move(element);
    // Closed dialogs retain their own controls until they are opened.
    for (const element of document.querySelectorAll(dialogSelectors.join(','))) {
      if (element.closest('dialog')?.open) move(element);
    }
    for (const [element, home] of moved) {
      const target = destination(home);
      if (target && element.parentElement !== target) {
        const active = document.activeElement;
        const restoreFocus = active && element.contains(active);
        target.append(element);
        if (restoreFocus) active.focus({ preventScroll: true });
      }
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  window.addEventListener('resize', sync);
  sync();
})();
