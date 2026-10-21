const dividendTaskStates = {
  success: ['执行成功', 'success'], verified: ['产物已核验', 'success'],
  'verified-warning': ['产物已核验·有提醒', 'warning'],
  warning: ['完成·有提醒', 'warning'], partial: ['部分完成', 'warning'],
  failed: ['执行失败', 'error'], running: ['正在执行', 'running'],
  pending: ['待执行', 'muted'], overdue: ['逾期未确认', 'warning'],
  unconfirmed: ['状态待确认', 'warning'], historical: ['有信号记录', 'muted'],
};

function taskEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function dividendTaskStatus(status) {
  return dividendTaskStates[status] ?? ['状态待确认', 'warning'];
}

function taskTimestamp(value) {
  const date = new Date(value || 'invalid');
  if (!Number.isFinite(date.getTime())) return '历史未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function taskStatusHtml(status) {
  const [label, tone] = dividendTaskStatus(status);
  return `<span class="task-status is-${tone}"><span class="task-status-dot" aria-hidden="true"></span>${label}</span>`;
}

function taskIcon(name, extraClass = '') {
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    minus: '<path d="M7 12h10"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M15 11h1M8 15h1M15 15h1M8 19h1M15 19h1"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
    shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z"/><path d="m8 12 3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    alert: '<path d="m12 3 10 18H2zM12 9v4M12 17h.01"/>',
    spinner: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
  };
  return `<svg class="task-icon ${extraClass}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}

const taskStepDefinitions = [
  ['collect', '数据采集', 'database'], ['calculate', '信号计算', 'calculator'],
  ['write', '文件写入', 'file'], ['validate', '结果校验', 'shield'],
];
const taskStepLabels = { done: '已完成', active: '进行中', failed: '失败', paused: '待确认', pending: '待执行', unknown: '未记录' };

export function dividendTaskSteps(run, validation) {
  const states = ['pending', 'pending', 'pending', 'pending'];
  if (run.source === 'artifact') {
    states.fill('unknown');
    if (typeof validation.ok === 'boolean') states[3] = validation.ok ? 'done' : 'failed';
  } else if (run.source === 'execution') {
    const stage = run.stage || '';
    const current = /核验|校验/.test(stage) ? 3 : /写入/.test(stage) ? 2 : /计算|生成信号/.test(stage) ? 1 : 0;
    if (['success', 'warning'].includes(run.status)) states.fill('done');
    else {
      for (let i = 0; i < current; i++) states[i] = 'done';
      states[current] = ['failed', 'partial'].includes(run.status) ? 'failed' : run.status === 'running' ? 'active' : 'paused';
    }
  }
  return taskStepDefinitions.map(([id, label, icon], index) => ({ id, label, icon, state: states[index] }));
}

function taskClock(value) {
  const date = new Date(value || 'invalid');
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
}

function taskDateTag(name, value) {
  const valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return `<li class="${valid ? '' : 'is-missing'}" title="${name}日期：${taskEscape(valid ? value : '待核验')}"><span>${name}</span>${valid ? `<time datetime="${taskEscape(value)}" aria-label="${taskEscape(value)}">${taskEscape(value.slice(5))}</time>` : `${taskIcon('alert')}<span>${value ? '待核验' : '未取得'}</span>`}</li>`;
}

function taskOverview(payload) {
  const { current: run, validation } = payload;
  const [label, tone] = dividendTaskStatus(run.status);
  const statusIcon = tone === 'success' ? 'check' : tone === 'error' ? 'close' : tone === 'warning' ? 'alert' : run.status === 'running' ? 'spinner' : 'clock';
  const steps = dividendTaskSteps(run, validation);
  const checks = validation.checks ?? [];
  const passed = checks.filter(item => item.ok).length;
  const stamp = run.source === 'artifact' ? run.recordedAt : run.endedAt || run.startedAt;
  const stampLabel = run.source === 'artifact' ? '信号记录时间' : run.endedAt ? '结束时间' : '开始时间';
  const dates = [
    ['记录', validation.recordDate], ['估值', validation.dates.index],
    ['国债', validation.dates.bond], ['行情', validation.dates.quote],
  ];
  return `<header class="task-overview-heading"><h2 id="task-monitor-name">中证红利每日信号</h2><span class="task-state-badge is-${tone}" role="status">${taskIcon(statusIcon, run.status === 'running' ? 'is-spinning' : '')}${taskEscape(label)}</span></header>
    <div class="task-overview-meta">
      <span class="task-meta-item" title="任务日期">${taskIcon('calendar')}<time datetime="${taskEscape(run.runDate)}">${taskEscape(run.runDate)}</time></span>
      <span class="task-meta-item" title="每天执行，Asia/Shanghai，包含周末与节假日">${taskIcon('clock')}<span>${taskEscape(payload.schedule.time)}</span><span class="task-meta-muted">每日</span></span>
      ${stamp ? `<span class="task-meta-item" title="${stampLabel}：${taskEscape(taskTimestamp(stamp))}">${taskIcon('clock')}<time datetime="${taskEscape(stamp)}">${taskClock(stamp)}</time><span class="task-meta-muted">${run.source === 'artifact' ? '记录' : run.endedAt ? '结束' : '开始'}</span></span>` : ''}
      ${Number.isFinite(run.durationSeconds) ? `<span class="task-meta-item" title="执行耗时">${taskIcon('clock')}<span>${run.durationSeconds}s</span></span>` : ''}
      ${run.source === 'artifact' ? `<span class="task-evidence-hint" tabindex="0" role="note" aria-label="执行凭证未记录，仅核验现存产物" title="执行凭证未记录；采集、计算和写入步骤显示未记录，仅最后的产物校验可确认。">${taskIcon('info')}<span>无执行凭证</span></span>` : ''}
      <span class="task-checked-at" title="最近核对：${taskEscape(taskTimestamp(payload.checkedAt))}">${taskIcon('clock')}<time data-task-check-time datetime="${taskEscape(payload.checkedAt)}">${taskClock(payload.checkedAt)}</time></span>
    </div>
    ${run.error ? `<span class="sr-only">${taskEscape(run.error)}</span>` : ''}
    <div class="task-flow-row"><ol class="task-stepper" aria-label="任务执行步骤">${steps.map(item => `<li class="task-step is-${item.state}" data-step-state="${item.state}" title="${item.label}：${taskStepLabels[item.state]}${item.state === 'unknown' ? '（缺少执行凭证）' : ''}"><span class="task-step-icon">${taskIcon(({ done: 'check', failed: 'close', active: 'spinner', paused: 'pause', unknown: 'minus' })[item.state] || item.icon, item.state === 'active' ? 'is-spinning' : '')}</span><span class="task-step-label">${item.label}</span><span class="sr-only">${taskStepLabels[item.state]}</span></li>`).join('')}</ol>
      <div class="task-validation-meter"><div class="task-meter-label"><span>产物校验</span><strong>${passed}<span> / ${checks.length || '—'}</span></strong></div><div class="task-meter-segments" role="progressbar" aria-label="产物校验通过数" aria-valuemin="0" aria-valuemax="${checks.length || 1}" aria-valuenow="${passed}">${checks.map(item => `<span class="${item.ok ? 'is-pass' : 'is-fail'}" title="${taskEscape(item.label)}：${item.ok ? '通过' : '未通过'}"></span>`).join('')}</div></div>
    </div>
    <div class="task-overview-footer"><ul class="task-date-tags" aria-label="来源数据日期">${dates.map(([name, value]) => taskDateTag(name, value)).join('')}</ul>
      <details class="task-overview-details"><summary>${taskIcon('info')}<span>运行详情</span></summary><div class="task-overview-detail-body">
        ${taskFacts(run.source === 'artifact' ? [['信号记录时间', taskTimestamp(run.recordedAt)], ['执行凭证', '历史未记录，按现存产物核验']] : [['开始时间', taskTimestamp(run.startedAt)], ['结束时间', taskTimestamp(run.endedAt)], ['执行阶段', run.stage], ['耗时', Number.isFinite(run.durationSeconds) ? `${run.durationSeconds} 秒` : '未取得']])}
        ${run.error ? `<p class="task-error">${taskEscape(run.error)}</p>` : ''}
        ${run.status === 'overdue' ? `<p class="task-help">计划时间后 ${payload.schedule.graceMinutes} 分钟仍未取得今日执行凭证，请检查任务是否启动。</p>` : ''}
        <p class="task-help">北京时间，每天执行，包含周末与节假日。执行日期与数据日期分别核对；上一交易日数据不视为漏跑。</p>
      </div></details>
    </div>`;
}

function taskFacts(items) {
  return `<dl class="task-facts">${items.map(([label, value]) => `<div><dt>${taskEscape(label)}</dt><dd>${taskEscape(value || '未取得')}</dd></div>`).join('')}</dl>`;
}

function taskChecks(checks = []) {
  return `<ul class="task-checks">${checks.map(item => `<li><span class="task-check-result ${item.ok ? 'is-pass' : 'is-fail'}">${item.ok ? '通过' : '未通过'}</span><div><strong>${taskEscape(item.label)}</strong><p>${taskEscape(item.detail)}</p></div></li>`).join('')}</ul>`;
}

function taskRunDetails(run) {
  return `<div class="task-run-detail">
    ${run.source === 'artifact' ? '<p class="task-help">历史信号只证明已有产物；开始、结束及耗时没有执行凭证。</p>' : ''}
    ${taskFacts([
      ['开始时间', taskTimestamp(run.startedAt)], ['结束时间', taskTimestamp(run.endedAt)],
      ['耗时', Number.isFinite(run.durationSeconds) ? `${run.durationSeconds} 秒` : '历史未记录'], ['执行阶段', run.stage],
    ])}
    ${run.error ? `<p class="task-error">${taskEscape(run.error)}</p>` : ''}
    ${run.validation ? taskChecks(run.validation.checks) : ''}
    ${run.receiptHref ? `<a class="task-file-link" href="${taskEscape(encodeURI(run.receiptHref))}" target="_blank" rel="noopener">打开本次运行记录</a>` : ''}
  </div>`;
}

export function renderDividendTaskSummary(payload, error = '') {
  const run = payload?.current;
  const content = error ? `<span class="task-summary-warning">${taskEscape(error)}</span>`
    : run ? `${taskStatusHtml(run.status)}<span>${taskEscape(run.source === 'artifact' ? `信号记录 ${taskTimestamp(run.recordedAt)}` : run.endedAt ? `完成 ${taskTimestamp(run.endedAt)}` : run.runDate)}</span>`
      : '<span>任务状态尚未读取</span>';
  return `<div class="task-summary-line"><span class="task-summary-label">每日任务</span>${content}<button type="button" class="task-text-button" data-dividend-view="dividend-task-monitor-view">查看任务监控</button></div>`;
}

export function renderDividendTaskMonitor(payload, error = '') {
  if (!payload) return `<article class="panel task-monitor-panel"><header class="task-overview-heading"><h2>中证红利每日信号</h2></header>${error ? `<p class="task-error">${taskEscape(error)}</p>` : '<div class="task-loading" aria-label="正在读取任务状态"><span class="sr-only">正在读取任务状态…</span><div class="task-skeleton-meta"></div><div class="task-skeleton-flow" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div>'}</article>`;
  const validation = payload.validation;
  const history = payload.history ?? [];
  return `<article class="panel task-monitor-panel" aria-labelledby="task-monitor-name">
    ${taskOverview(payload)}
    ${error ? `<p class="task-error" role="alert">${taskEscape(error)} 当前保留上次读取结果。</p>` : ''}
    <div class="task-output-section"><h3>本次输出核验</h3><p class="task-help">策略 ${taskEscape(validation.strategyVersion || '待核验')} · 检查当前保存的文件</p>
      <ul class="task-artifacts">${validation.artifacts.map(item => `<li><span class="task-check-result ${item.ok ? 'is-pass' : 'is-fail'}">${item.ok ? '通过' : '待处理'}</span><div><a class="task-file-link" href="${taskEscape(encodeURI(item.href))}" target="_blank" rel="noopener">${taskEscape(item.name)}</a><p>${taskEscape(item.message)}</p></div></li>`).join('')}</ul>
      <details class="task-validation-details"><summary>查看逐项校验</summary>${taskChecks(validation.checks)}</details>
      ${validation.warnings.length ? `<div class="task-warning"><strong>需留意</strong>${validation.warnings.map(item => `<p>${taskEscape(item)}</p>`).join('')}</div>` : ''}
      ${(payload.errors ?? []).map(item => `<p class="task-error">${taskEscape(item)}</p>`).join('')}
    </div>
  </article>
  <article class="panel task-monitor-panel task-history-panel" aria-labelledby="task-history-title">
    <header class="task-monitor-heading"><div><h2 id="task-history-title">最近运行记录</h2><p>每次执行独立保留；补跑不会覆盖原失败记录。最多展示60条。</p></div></header>
    ${history.length ? `<div class="task-history-head" aria-hidden="true"><span>记录日期</span><span>执行结果</span><span>时间（北京时间）</span><span></span></div>${history.map((item, index) => `<details class="task-run" data-task-run-id="${taskEscape(item.id || index)}"><summary><span>${taskEscape(item.runDate)}</span>${taskStatusHtml(item.status)}<span class="task-run-time">${taskEscape(item.source === 'artifact' ? item.recordedAt ? `信号 ${taskTimestamp(item.recordedAt)}` : '历史未记录' : taskTimestamp(item.endedAt || item.startedAt))}</span><span class="task-run-action"><span class="task-open-label">查看详情</span><span class="task-close-label">收起详情</span></span></summary>${taskRunDetails(item)}</details>`).join('')}` : '<p class="task-help">暂无执行或信号记录。下一次任务启动后会记录执行过程。</p>'}
    <p class="task-history-boundary">${taskEscape(payload.boundary)}</p>
  </article>`;
}
