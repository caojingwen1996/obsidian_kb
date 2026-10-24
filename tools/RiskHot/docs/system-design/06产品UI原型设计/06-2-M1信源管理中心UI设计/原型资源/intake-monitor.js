// M1 任务运行入口（本地启停演示）：复用当前在册信源；任务记录为本地快照，不执行采集。
(() => {
  'use strict';
  const host = document.getElementById('intake-workspace');
  const labels = { running: '运行中', failed: '失败', queued: '待执行', completed: '已完成', blocked: '已阻断', paused: '已暂停' };
  const steps = ['核对信源资格与接入条件', '获取原始资料', '正文读取与资料标准化', '识别重复与资料版本', '保存标准化资料', '交付标准化资料'];
  const initialTasks = [
    { id: 'L0-1024-006', sources: [{source:'demo-source-4',status:'running',step:3,count:null},{source:'demo-source-1',status:'failed',step:2,count:null}], date:'2026-10-24', source: 'demo-source-4', status: 'running', time: '14:30', step: 3, count: null, detail: '原件已取得，正在读取正文并检查标准化字段。', next: '完成标准化检查后进入资料版本识别。' },
    { id: 'L0-1024-005', sources: [{source:'demo-source-4',status:'completed',step:6,count:8},{source:'demo-source-1',status:'failed',step:2,count:null}], date:'2026-10-24', source: 'demo-source-1', status: 'failed', time: '14:00', step: 2, count: null, detail: '原始资料读取超时，未取得完整内容。', next: '检查来源连接与运行记录，由运行侧恢复；未保存资料不会交付事件分析。' },
    { id: 'L0-1024-004', sources: [{source:'demo-source-4',status:'queued',step:0,count:null}], date:'2026-10-24', source: 'demo-source-4', status: 'queued', time: '15:00', step: 0, count: null, detail: '已安排下一轮接入，尚未开始执行。', next: '预计 14:45 执行，实际时间以运行侧调度结果为准。' },
    { id: 'L0-1024-003', sources: [{source:'demo-source-4',status:'completed',step:6,count:8}], date:'2026-10-24', source: 'demo-source-4', status: 'completed', time: '13:30', step: 6, count: 8, detail: '8 份标准化资料已保存，交付已确认。', next: '后续事件分析由 F02 处理；交付完成不代表事件分析完成。' },
    { id: 'L0-1024-002', sources: [{source:'demo-source-2',status:'blocked',step:1,count:null}], date:'2026-10-24', source: 'demo-source-2', status: 'blocked', time: '13:00', step: 1, count: null, detail: '信源业务状态为停用，本次接入未通过资格核对。', next: '先核对信源启用资格；启用信源不自动重启本次任务。' },
    { id: 'L0-1024-001', sources: [{source:'demo-source-4',status:'completed',step:6,count:5}], date:'2026-10-23', source: 'demo-source-4', status: 'completed', time: '16:00', step: 6, count: 5, detail: '5 份标准化资料已保存，交付已确认。', next: '可在执行详情中核对本次六步处理结果。' }
  ];
  let seed = structuredClone(initialTasks);
  let pendingControl = null, feedback = '';
  let query = '', filter = 'all', fromDate = '2026-10-24', toDate = '2026-10-24', selection = null, busy = false, refreshed = false;
  let refreshTimer;
  const source = task => records.find(item => item.id === task.source);
  const badge = task => `<span class="intake-status ${task.status}">${labels[task.status]}</span>`;
  const isOpen = () => location.hash === '#intake-tasks';
  const inRange = task => task.date >= fromDate && task.date <= toDate;
  const hasException = task => task.sources.some(item => ['failed', 'blocked'].includes(item.status));
  const taskTitle = task => `${task.date} ${task.time} 接入批次`;
  const summary = task => `${task.sources.filter(item => item.status === 'completed').length} / ${task.sources.length} 个信源完成`;
  const savedCount = task => task.sources.reduce((total, item) => total + (item.count || 0), 0);
  const taskRows = () => seed.filter(task => inRange(task) && (filter === 'all' || (filter === 'attention' ? hasException(task) : task.status === filter)) && `${taskTitle(task)} ${task.id}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const canControl = () => ['both', 'operator'].includes(document.getElementById('role').value);
  function controlError(task, action) {
    if (!canControl()) return '当前角色没有任务启停权限。';
    if (document.getElementById('scene').value !== 'normal') return '当前无法确认运行状态，恢复连接后再操作。';
    if (busy) return '正在刷新状态，请稍候再操作。';
    if (action === 'pause') return ['running', 'queued'].includes(task.status) ? '' : '当前任务状态不支持暂停。';
    if (!['queued', 'paused', 'failed', 'blocked'].includes(task.status)) return '当前任务状态不支持开启。';
    const pending = task.sources.filter(item => task.status === 'paused' ? item.status === 'paused' : item.status !== 'completed');
    for (const entry of pending) {
      const item = source(entry);
      if (!item || item.status !== 'ACTIVE') return '批次内有信源未启用，暂不能开启任务。';
      if (item.mode !== 'auto' || !item.tech.ready) return '批次内有信源接入未就绪，暂不能开启任务。';
    }
    return '';
  }
  function controlButtons(task) {
    if (!canControl() || task.status === 'completed') return '';
    const actions = task.status === 'running' ? ['pause'] : task.status === 'queued' ? ['start', 'pause'] : ['start'];
    return actions.map(action => {
      const reason = controlError(task, action);
      const name = action === 'pause' ? '暂停任务' : task.status === 'paused' ? '继续任务' : '开启任务';
      return `<div class="intake-control-item"><button class="${action === 'pause' ? 'secondary' : 'primary'}" data-task-control="${action}" data-task-id="${task.id}" ${reason ? 'disabled' : ''}>${name}</button>${reason ? `<small>${esc(reason)}</small>` : ''}</div>`;
    }).join('');
  }
  function confirmation() {
    if (!pendingControl) return '';
    const task = seed.find(t => t.id === pendingControl.id);
    const pause = pendingControl.action === 'pause';
    const name = pause ? '暂停任务' : task.status === 'paused' ? '继续任务' : '开启任务';
    return `<section class="intake-confirm" aria-labelledby="intake-confirm-title"><h3 id="intake-confirm-title" tabindex="-1">确认${name}</h3><p>${taskTitle(task)} · ${task.id}</p><p>${pause ? '暂停后保留当前进度，后续步骤停止推进；不会停用信源，也不会删除已保存资料。' : '本操作作用于整个时间批次。开启前核对批次内待处理信源；继续时从各信源保留的进度恢复。'}</p><p class="muted">本次仅演示状态变化，不会实际执行采集或调度。</p><div class="intake-confirm-actions"><button class="secondary" data-task-confirm="cancel">取消</button><button class="primary" data-task-confirm="apply">确认${name}</button></div></section>`;
  }
  function applyControl() {
    const command = pendingControl; if (!command) return;
    const task = seed.find(t => t.id === command.id);
    const reason = controlError(task, command.action);
    if (reason || task.status !== command.status) {
      pendingControl = null; feedback = reason || '任务状态已变化，请重新核对后操作。'; render();
      document.getElementById('intake-feedback').focus(); return;
    }
    const before = task.status;
    for (const item of task.sources) {
      if (command.action === 'pause' && ['running','queued'].includes(item.status)) item.status = 'paused';
      else if (command.action === 'start' && (before === 'paused' ? item.status === 'paused' : item.status !== 'completed')) { item.status = 'running'; if (!item.step) item.step = 1; }
    }
    if (command.action === 'pause') {
      task.beforePause = { detail: task.detail, next: task.next };
      task.status = 'paused';
      task.detail = task.step ? `任务已暂停，进度保留在 Step ${task.step}。` : '任务已暂停，尚未开始执行。';
      task.next = '可继续任务；开启前将重新核对信源状态和接入条件。';
    } else {
      task.status = 'running';
      if (before === 'paused' && task.step > 0) {
        task.detail = task.beforePause.detail; task.next = task.beforePause.next;
      } else {
        task.step = 1; task.count = null;
        task.detail = '任务已开启，正在核对信源资格与接入条件。';
        task.next = '资格核对通过后获取原始资料。';
      }
    }
    const actionName = command.action === 'pause' ? '暂停' : before === 'paused' ? '继续' : '开启';
    task.actions = [...(task.actions || []), `${actionName}任务：${labels[before]} → ${labels[task.status]}（本地模拟）`];
    pendingControl = null; feedback = `${task.id} 已${actionName}（本地模拟）。`; render();
    document.getElementById('intake-feedback').focus();
  }
  function render() {
    if (!isOpen()) return;
    const scene = document.getElementById('scene').value;
    const available = ['normal','offline'].includes(scene);
    const tasks = taskRows(), period = seed.filter(inRange);
    host.innerHTML = `<div class="intake-heading"><div><h2 id="intake-title" tabindex="-1">L0 信息接入任务</h2><p>按计划时间查看接入批次，展开批次核对各信源结果。</p></div><div class="intake-refresh"><span role="status">${refreshed ? '已重新读取本地快照' : '2026-10-24 14:30 · 示例快照'}</span><button class="secondary" id="intake-refresh" ${busy || scene === 'denied' ? 'disabled' : ''}>${busy ? '读取中…' : '刷新状态'}</button></div></div>
    <p class="intake-context">一个任务对应一个计划执行批次，可包含多个信源。启停按批次操作，仅模拟本页状态。</p>
    <p id="intake-feedback" class="intake-feedback" role="status" tabindex="-1" ${feedback ? '' : 'hidden'}>${esc(feedback)}</p>
    <section class="intake-list-section" aria-label="批次查询"><form id="intake-filter-form" class="intake-filters"><label>开始日期<input type="date" id="intake-from" value="${fromDate}" required></label><label>结束日期<input type="date" id="intake-to" value="${toDate}" required></label><label>任务编号<input type="search" id="intake-search" value="${esc(query)}" placeholder="搜索任务编号或计划时间"></label><label>批次状态<select id="intake-status"><option value="all">全部状态</option>${[['attention','含异常的批次'],...Object.entries(labels)].map(([id,name])=>`<option value="${id}" ${filter===id?'selected':''}>${name}</option>`).join('')}</select></label><button class="primary" type="submit">查询</button><button class="quiet" type="button" data-intake-action="clear">重置筛选</button></form><p class="muted">按计划日期统计 · ${fromDate} 至 ${toDate}</p></section>
    ${available ? `<div class="intake-metrics" aria-label="日期范围内任务概览"><div><span>任务批次</span><strong>${period.length}</strong><p>所选日期范围</p></div><div><span>运行中批次</span><strong>${period.filter(t=>t.status==='running').length}</strong><p>已暂停 ${period.filter(t=>t.status==='paused').length} 批</p></div><div><span>含异常批次</span><strong class="intake-warning-number">${period.filter(hasException).length}</strong><p>含失败或阻断的信源</p></div><div><span>待执行批次</span><strong>${period.filter(t=>t.status==='queued').length}</strong><p>按计划时间等待执行</p></div></div><section class="intake-alert"><div><h3>${scene==='offline'?'离线 · 显示上次快照':`所选日期内 ${period.filter(hasException).length} 个批次含异常`}</h3><p>批次状态与信源结果分别记录；运行中的批次也可能包含信源异常。</p></div><button class="secondary" data-intake-action="attention">查看异常批次</button></section>` : ''}
    <section class="intake-list-section" aria-labelledby="intake-list-title"><div class="intake-section-heading"><h3 id="intake-list-title">接入任务批次</h3><span class="muted">按计划时间倒序 · 示例记录</span></div>${available ? `<p id="intake-result" role="status">${tasks.length} 个符合条件的批次</p>${tasks.length ? `<div class="intake-table-wrap"><table class="intake-table"><thead><tr><th scope="col">计划时间 / 任务批次</th><th scope="col">批次状态</th><th scope="col">执行汇总</th><th scope="col">已保存资料</th><th scope="col">操作</th></tr></thead><tbody>${tasks.map(task=>`<tr ${selection===task.id?'class="selected"':''}><td data-label="计划时间 / 任务批次"><strong>${task.date} ${task.time}</strong><small>${task.id}</small></td><td data-label="批次状态">${badge(task)}</td><td data-label="执行汇总">${summary(task)}<small>${task.sources.filter(i=>['failed','blocked'].includes(i.status)).length} 个信源异常</small></td><td data-label="已保存资料">${savedCount(task)} 份<small>仅计已确认保存</small></td><td data-label="操作"><div class="intake-row-actions">${controlButtons(task)}<button class="link-button" data-intake-detail="${task.id}" aria-expanded="${selection===task.id}" aria-controls="intake-detail" aria-label="查看 ${task.id} 批次详情">批次详情</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="intake-empty"><h3>没有符合条件的批次</h3><p>请调整日期、状态或任务编号。</p><button class="secondary" data-intake-action="clear">重置筛选</button></div>'}` : renderUnavailable(scene)}</section>
    ${confirmation()}<section id="intake-detail" class="intake-detail" aria-labelledby="intake-detail-title" ${!selection||!available?'hidden':''}></section>`;
    if (selection && available) renderDetail();
  }
  function renderUnavailable(scene) {
    const states = { loading: ['正在读取任务', '请稍候；当前尚未取得任务状态。'], empty: ['暂无接入任务', '当前查询范围内尚无执行记录。'], error: ['任务读取失败', '未能取得运行状态，请重新读取。'], denied: ['无任务读取权限', '请联系管理员授予运行记录查看权限。'] };
    const [title, message] = states[scene] || states.error;
    return `<div class="intake-empty" role="status"><h3>${title}</h3><p>${message}</p>${scene === 'error' ? '<button class="secondary" data-intake-action="retry">重新读取</button>' : ''}</div>`;
  }
  function renderDetail() {
    const task = seed.find(t=>t.id===selection); if (!task) return;
    document.getElementById('intake-detail').innerHTML = `<div class="intake-section-heading"><div><h3 id="intake-detail-title" tabindex="-1">${taskTitle(task)} · 批次详情</h3><p>${task.id} · ${labels[task.status]} · ${summary(task)}</p></div><button class="secondary" data-intake-action="close-detail">收起详情</button></div><h4>本批次信源执行结果</h4><div class="intake-batch-sources">${task.sources.map(item=>`<details class="intake-source-result"><summary><strong>${esc(source(item)?.name||'原信源未找到')}</strong>${badge(item)}<span>${item.step ? `Step ${item.step} · ${steps[item.step-1]}` : '尚未执行'}</span></summary><p>${item.status==='failed'?'原始资料读取超时，未取得完整内容。':item.status==='blocked'?'信源停用，资格核对未通过。':item.status==='paused'?'已暂停，保留当前步骤。':item.status==='completed'?`已保存 ${item.count} 份资料，交付已确认。`:'等待后续处理。'}</p><ol class="intake-steps">${steps.map((name,i)=>`<li><span class="intake-step-number">${i+1}</span><div><strong>${name}</strong><small>${item.status==='completed'||i+1<item.step?'已完成':i+1===item.step?labels[item.status]:'未开始'}</small></div></li>`).join('')}</ol></details>`).join('')}</div><div class="intake-row-actions">${controlButtons(task)}</div>${task.actions?.length?`<h4>本页批次操作记录</h4><ul>${task.actions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}<p class="intake-detail-note">启停作用于本批次可继续的信源，已完成结果保留，失败与阻断单独呈现。所有操作均为本地演示。</p>`;
  }
  function route(focus = false) {
    const open = isOpen();
    pendingControl = null;
    document.body.dataset.m1Page = open ? 'intake' : 'sources';
    document.getElementById('source-workspace').hidden = open; host.hidden = !open;
    document.getElementById('main').setAttribute('aria-label', open ? 'L0 信息接入任务监控' : '信源目录');
    for (const [id, current] of [['source-workspace-link', !open], ['intake-workspace-link', open]]) {
      const a = document.getElementById(id); if (current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    render();
    if (focus) document.getElementById(open ? 'intake-title' : 'source-workspace-link')?.focus();
  }
  host.addEventListener('submit', event => { if (event.target.id !== 'intake-filter-form') return; event.preventDefault(); query = document.getElementById('intake-search').value.trim(); const start = document.getElementById('intake-from').value, end = document.getElementById('intake-to').value; if (start > end) { feedback = '开始日期不能晚于结束日期。'; render(); document.getElementById('intake-feedback').focus(); return; } fromDate = start; toDate = end; feedback = ''; selection = null; render(); document.getElementById('intake-search').focus(); });
  host.addEventListener('change', event => { if (event.target.id === 'intake-status') filter = event.target.value; else return; pendingControl = null; query = document.getElementById('intake-search').value.trim(); selection = null; const id = event.target.id; render(); document.getElementById(id).focus(); });
  host.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.taskControl) {
      const task = seed.find(t => t.id === button.dataset.taskId);
      if (!task || controlError(task, button.dataset.taskControl)) return;
      query = document.getElementById('intake-search').value.trim();
      pendingControl = { id: task.id, action: button.dataset.taskControl, status: task.status };
      render(); document.getElementById('intake-confirm-title').focus(); return;
    }
    if (button.dataset.taskConfirm === 'apply') { applyControl(); return; }
    if (button.dataset.taskConfirm === 'cancel') {
      const old = pendingControl; pendingControl = null; render();
      host.querySelector(`[data-task-id="${old.id}"][data-task-control="${old.action}"]`)?.focus(); return;
    }
    if (button.dataset.intakeDetail) { selection = button.dataset.intakeDetail; render(); document.getElementById('intake-detail-title').focus(); return; }
    const action = button.dataset.intakeAction;
    if (action === 'close-detail') { const old = selection; selection = null; render(); host.querySelector(`[data-intake-detail="${old}"]`)?.focus(); }
    if (action === 'clear' || action === 'attention') { pendingControl = null; feedback = ''; query = ''; if (action === 'clear') fromDate = toDate = '2026-10-24'; filter = action === 'attention' ? 'attention' : 'all'; selection = null; render(); document.getElementById('intake-status').focus(); }
    if (action === 'retry') { document.getElementById('scene').value = 'normal'; document.getElementById('scene').dispatchEvent(new Event('change')); }
    if (button.id === 'intake-refresh') { busy = true; refreshed = false; render(); clearTimeout(refreshTimer); refreshTimer = setTimeout(() => {busy = false; refreshed = true; render(); if (isOpen()) document.getElementById('intake-refresh')?.focus();}, 450); }
  });
  for (const id of ['scene', 'role']) document.getElementById(id).addEventListener('change', () => { selection = null; pendingControl = null; render(); });
  document.getElementById('reset').addEventListener('click', () => { seed = structuredClone(initialTasks); pendingControl = null; feedback = ''; query = ''; filter = 'all'; fromDate = toDate = '2026-10-24'; selection = null; refreshed = busy = false; clearTimeout(refreshTimer); render(); });
  window.addEventListener('hashchange', () => route(true));
  route();
})();
