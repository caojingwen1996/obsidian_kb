const STARTUP_STATUS_LABELS = Object.freeze({ loading: '检查中', passed: '通过', warning: '待验证', failed: '失败' });
const STARTUP_STATUS_MARKERS = Object.freeze({ loading: '[··]', passed: '[OK]', warning: '[待验证]', failed: '[失败]' });

const MARKET_STARTUP_ITEMS = Object.freeze({
  shanghaiHistory: ['上证指数', '/api/eastmoney-kline'],
  csi300History: ['沪深300', '/api/eastmoney-kline、/api/csindex-performance'],
  csiAllHistory: ['中证全指', '/api/eastmoney-kline、/api/csindex-performance'],
  csi300Stats: ['沪深300估值', '/api/csindex-performance'],
  turnoverHistory: ['成交额历史', '/api/csindex-performance'],
  forwardPe: ['预测市盈率', ''],
  treasury: ['中国国债收益率', '/api/treasury'],
  usTreasury10y: ['美国国债收益率', '/api/us-treasury-yield'],
  usDollarIndex: ['美元指数', '/api/us-dollar-index'],
  usdJpy: ['美元兑日元', '/api/usd-jpy'],
  market: ['全市场行情', '/api/market'],
  margin: ['融资余额', '/api/margin'],
});

export function marketStartupResult(snapshot, definitions) {
  const entries = definitions.map(definition => ({ definition, entry: snapshot?.domains?.[definition.id] }));
  const latest = entries.filter(({ entry }) => snapshot?.mode === 'live' && entry?.status === 'latest').length;
  const pending = entries.filter(({ entry }) => snapshot?.mode === 'live' && entry?.status === 'loading').length;
  const issues = entries.filter(({ entry }) => snapshot?.mode !== 'live' || !['latest', 'loading'].includes(entry?.status));
  const lines = issues.map(({ definition, entry }) => {
    const [label, endpoint] = MARKET_STARTUP_ITEMS[definition.id] ?? [definition.id, ''];
    if (!definition.providers?.length) return `${label}：未配置数据源，未发起接口请求。`;
    const state = ({ loading: '正在读取', snapshot: '仅有缓存', expired: '缓存已过期', missing: '读取失败', example: '仅有示例数据' })[entry?.status] ?? '尚未取得真实数据';
    const reason = entry?.errors?.length ? entry.errors.join('；') : '未取得可验证的最新结果';
    return `${label}：${state}；${endpoint || definition.providers.map(provider => provider.name).join(' / ')}\n${reason}`;
  });
  return {
    status: entries.length > 0 && !issues.length && !pending ? 'passed' : 'warning',
    detail: [`${latest} / ${entries.length} 项最新数据${pending ? `；${pending} 项读取中` : ''}${issues.length ? `；${issues.length} 项未取得最新数据，明细如下：` : pending ? '。' : '，已重算指标。'}`, ...lines].join('\n'),
  };
}

export function startupCheckSummary(items) {
  const completed = items.filter(item => item.status !== 'loading').length;
  const issues = items.filter(item => ['warning', 'failed'].includes(item.status)).length;
  return { completed, total: items.length, issues, ready: completed === items.length, passed: items.length > 0 && completed === items.length && issues === 0 };
}

export function renderStartupChecks(items) {
  const escapeStartupText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  return items.map(item => {
    const state = Object.hasOwn(STARTUP_STATUS_LABELS, item.status) ? item.status : 'failed';
    return `<li class="startup-check is-${state}"><strong class="startup-check-label">${escapeStartupText(item.label)}...</strong><p><span class="startup-check-state" aria-label="${STARTUP_STATUS_LABELS[state]}">${STARTUP_STATUS_MARKERS[state]}</span><span class="startup-check-detail">${escapeStartupText(item.detail)}</span></p></li>`;
  }).join('');
}

export async function runStartupChecks(checks, { onUpdate = () => {}, timeoutMs = 65_000 } = {}) {
  if (new Set(checks.map(check => check.id)).size !== checks.length) throw new Error('启动检查项目重复');
  const items = checks.map(check => ({ id: check.id, label: check.label, status: 'loading', detail: '正在读取…' }));
  const emit = () => onUpdate(items.map(item => ({ ...item })));
  emit();
  await Promise.all(checks.map(async (check, index) => {
    let settled = false;
    let timer;
    let timedOut = false;
    const reconcile = result => {
      if (!result || !['passed', 'warning', 'failed'].includes(result.status)) throw new Error('检查结果无效');
      if (timedOut) {
        Object.assign(items[index], { status: result.status, detail: String(result.detail ?? '') });
        emit();
      }
      return result;
    };
    const report = detail => {
      if (settled) return;
      items[index].detail = String(detail);
      emit();
    };
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => check.run(report)).then(reconcile).catch(error => {
          if (timedOut) reconcile({ status: 'failed', detail: error instanceof Error ? error.message : String(error) });
          throw error;
        }),
        new Promise(resolve => {
          timer = setTimeout(() => {
            timedOut = true;
            resolve({ status: 'warning', detail: '检查超时，最新数据尚未确认；可重新检查，或查看已取得的数据。后台结果返回后会更新状态。' });
          }, timeoutMs);
        }),
      ]);
      if (!result || !['passed', 'warning', 'failed'].includes(result.status)) throw new Error('检查结果无效');
      Object.assign(items[index], { status: result.status, detail: String(result.detail ?? '') });
    } catch (error) {
      Object.assign(items[index], { status: 'failed', detail: error instanceof Error ? error.message : String(error) });
    } finally {
      settled = true;
      clearTimeout(timer);
      emit();
    }
  }));
  return items;
}

export function createStartupScreen() {
  const screen = document.getElementById('startup-screen');
  const shell = document.getElementById('dashboard-shell');
  const status = document.getElementById('startup-status');
  const summary = document.getElementById('startup-summary');
  const list = document.getElementById('startup-checks');
  const enterButton = document.getElementById('startup-enter');
  const retryButton = document.getElementById('startup-retry');
  const reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const rows = new Map();
  let dismissed = false;
  let canEnter = false;
  enterButton.disabled = true;
  let autoEnterTimer;
  const actions = enterButton.parentElement;
  const cancelAutoEnter = () => {
    if (!autoEnterTimer) return;
    clearTimeout(autoEnterTimer);
    autoEnterTimer = undefined;
    summary.textContent = '[OK] 检查通过，请选择进入面板或重新检查。';
  };
  const syncVisibility = () => screen.classList.toggle('is-background', document.hidden);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  const animate = (element, keyframes, options) => {
    if (reducedMotion.matches || document.hidden || !element.animate) return;
    element.getAnimations().forEach(animation => animation.cancel());
    element.animate(keyframes, { duration: 260, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards', ...options });
  };
  const enter = () => {
    if (dismissed || !canEnter) return;
    dismissed = true;
    clearTimeout(autoEnterTimer);
    actions.removeEventListener('pointerenter', cancelAutoEnter);
    actions.removeEventListener('focusin', cancelAutoEnter);
    actions.removeEventListener('pointerdown', cancelAutoEnter);
    document.removeEventListener('visibilitychange', syncVisibility);
    screen.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    screen.inert = true;
    screen.setAttribute('aria-hidden', 'true');
    screen.classList.add('is-leaving');
    if (reducedMotion.matches || document.hidden) screen.hidden = true;
    else setTimeout(() => { screen.hidden = true; }, 180);
    shell.hidden = false;
    shell.inert = false;
    document.body.classList.remove('is-starting');
    const title = document.getElementById('page-title');
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  };
  enterButton.addEventListener('click', enter);
  retryButton.addEventListener('click', () => globalThis.location.reload());
  actions.addEventListener('pointerenter', cancelAutoEnter);
  actions.addEventListener('focusin', cancelAutoEnter);
  actions.addEventListener('pointerdown', cancelAutoEnter);
  screen.focus({ preventScroll: true });
  const update = items => {
    if (dismissed) return;
    if (!rows.size) list.replaceChildren();
    const activeIds = new Set();
    items.forEach((item, index) => {
      const key = item.id ?? index;
      activeIds.add(key);
      let row = rows.get(key);
      if (!row) {
        const template = document.createElement('template');
        template.innerHTML = renderStartupChecks([item]);
        row = template.content.firstElementChild;
        rows.set(key, row);
        list.append(row);
        animate(row, [{ opacity: .25, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: Math.min(index * 24, 168) });
      } else {
        const state = Object.hasOwn(STARTUP_STATUS_LABELS, item.status) ? item.status : 'failed';
        const marker = row.querySelector('.startup-check-state');
        const detail = row.querySelector('.startup-check-detail');
        row.querySelector('.startup-check-label').textContent = `${item.label ?? ''}...`;
        const changed = row.className !== `startup-check is-${state}` || detail.textContent !== String(item.detail ?? '');
        row.className = `startup-check is-${state}`;
        marker.textContent = STARTUP_STATUS_MARKERS[state];
        marker.setAttribute('aria-label', STARTUP_STATUS_LABELS[state]);
        detail.textContent = String(item.detail ?? '');
        if (changed) animate(detail, [{ opacity: .4 }, { opacity: 1 }], { duration: 180 });
      }
    });
    for (const [key, row] of rows) if (!activeIds.has(key)) { row.remove(); rows.delete(key); }
    const result = startupCheckSummary(items);
    screen.classList.toggle('is-complete', result.ready && result.total > 0);
    list.setAttribute('aria-busy', String(!result.ready));
    screen.style.setProperty('--startup-progress', String(result.total ? result.completed / result.total : 0));
    status.textContent = result.ready ? result.passed ? '系统就绪' : '检查完成' : '初始化中...';
    summary.textContent = result.ready
      ? result.passed ? `[OK] ${result.total} 项检查通过，请选择操作。` : `> ${result.issues} 组检查存在异常，具体数据与原因见上方明细。可重新检查，或查看已取得的数据。`
      : `> 已完成 ${result.completed} / ${result.total} 项检查，正在读取数据`;
    retryButton.hidden = !result.ready;
    canEnter = result.ready && result.total > 0;
    enterButton.disabled = !canEnter;
    enterButton.textContent = !canEnter ? '正在检查数据…' : result.passed ? '进入面板' : '查看已取得的数据';
  };
  return {
    enter,
    fail(error) {
      update([{ label: '面板初始化', status: 'failed', detail: error instanceof Error ? error.message : String(error) }]);
    },
    async run(checks) {
      const items = await runStartupChecks(checks, { onUpdate: update });
      if (startupCheckSummary(items).passed && !dismissed && !actions.matches(':hover, :focus-within')) {
        summary.textContent = `[OK] ${items.length} 项检查通过，3 秒后自动进入；操作按钮可暂停。`;
        autoEnterTimer = setTimeout(enter, 3000);
      }
      return items;
    },
  };
}
