const indexMonthSelection = new Map();
const chartEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chartPercent = value => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '—';

export function indexYearPoints(input, annual) {
  const unique = new Map();
  for (const p of input ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p?.date ?? '') || !Number.isFinite(p.close) || p.close <= 0) continue;
    const date = new Date(`${p.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== p.date) continue;
    if (p.date < annual.startDate || p.date > annual.endDate) continue;
    if (unique.has(p.date) && unique.get(p.date).close !== p.close) return [];
    unique.set(p.date, { date: p.date, close: p.close });
  }
  const points = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2 || points[0].date !== annual.startDate || points.at(-1).date !== annual.endDate) return [];
  if (Number.isFinite(annual.annualReturn) && Math.abs((points.at(-1).close / points[0].close - 1) * 100 - annual.annualReturn) > 0.02) return [];
  return points;
}

export function renderMonthlyIndexChart(annual, { namespace, points = [], months, status, error, period = 'month', rows = [] } = {}) {
  const names = { nasdaq: '纳斯达克100指数', dividend: '中证红利指数', spdividend: '南方红利低波50ETF' };
  const etf = namespace === 'spdividend';
  const payload = { etf, year: period === 'year' ? 'all' : annual.year, namespace, points, months: months ?? [], period, rows };
  const message = status === 'loading' ? '正在读取所选年份指数日线…' : error ? `日线读取失败：${error}` : '可用指数日线不足或与日历区间不一致，请刷新数据后重试。';
  return `<section class="monthly-index-chart" data-index-chart="${chartEscape(JSON.stringify(payload))}" aria-label="${names[namespace]}走势">
    <div class="monthly-index-head"><div><h3>${names[namespace]}走势</h3><p>${period === 'year' ? '完整历史' : annual.year + '年'} · ${chartEscape(annual.startDate)} 至 ${chartEscape(annual.endDate)} · ${etf ? '前复权收盘价（元）' : '日收盘点位'}${annual.isIntraday ? ' · 盘中暂估' : ''}</p></div><button type="button" data-index-clear disabled>取消高亮</button></div>
    ${points.length >= 2 ? `<div class="monthly-index-summary" aria-live="polite"></div><div class="monthly-index-legend"><span><i></i>${period === 'year' ? '完整历史' : '全年走势'}</span><span><i></i>${period === 'year' ? '所选年度' : '所选月份'}</span></div><svg class="monthly-index-svg" tabindex="0" role="img" aria-label="${etf ? 'ETF前复权日收盘价格' : '指数日收盘走势'}；左右方向键查看"></svg><div class="monthly-index-readout">移至折线查看日期与${etf ? 'ETF价格' : '指数点位'}；支持左右方向键</div>` : `<p class="monthly-index-empty" role="status">${chartEscape(message)}</p>${namespace === 'dividend' && status !== 'loading' ? '<button type="button" data-dividend-calendar-retry>重新读取日线</button>' : ''}`}
  </section>`;
}

export function initMonthlyIndexCharts(root = document) {
  const registered = new Set();
  const geometry = new WeakMap();
  const payloadFor = el => JSON.parse(el.dataset.indexChart);
  const selectionFor = data => {
    const saved = indexMonthSelection.get(data.namespace + ':' + data.period);
    if (!saved || saved.year !== data.year) { indexMonthSelection.set(data.namespace + ':' + data.period, { year: data.year, month: null }); return null; }
    return saved.month;
  };
  const draw = el => {
    if (!el.isConnected) return;
    const data = payloadFor(el), points = data.points, svg = el.querySelector('svg');
    if (!svg || !points.length || el.clientWidth === 0) return;
    const annualMode = data.period === 'year';
    const field = annualMode ? 'indexYear' : 'indexMonth';
    const valueFor = p => Number(annualMode ? p.date.slice(0, 4) : p.date.slice(5, 7));
    let selected = selectionFor(data);
    if (selected !== null && points.filter(p => valueFor(p) === selected).length < 2) selected = null;
    const monthPoints = points.filter(p => valueFor(p) === selected);
    const monthly = annualMode ? data.rows.find(r => r.year === selected) : data.months.find(m => m.month === selected);
    el.querySelector('[data-index-clear]').disabled = selected === null;
    const row = el.closest('.monthly-index-row');
    row?.querySelectorAll(annualMode ? '[data-index-year]' : '[data-index-month]').forEach(button => {
      button.setAttribute('aria-pressed', Number(button.dataset[field]) === selected);
      button.disabled = points.filter(p => valueFor(p) === Number(button.dataset[field])).length < 2;
    });
    const unit = annualMode ? '年' : '月';
    el.querySelector('.monthly-index-summary').innerHTML = selected === null ? `<b>${annualMode ? '完整历史走势' : '全年走势'}</b><span>点击${annualMode ? '年份' : '月份'}，高亮相应价格区间</span>` : `<b>${selected}${unit}已高亮</b><span>${monthPoints[0].date} — ${monthPoints.at(-1).date}</span><span>${annualMode ? '年度' : '月度'}收益 <strong>${chartPercent(annualMode ? monthly?.annualReturn : monthly?.value)}</strong></span><span>${annualMode ? '年度' : '月度'}最大回撤 <strong>${chartPercent(monthly?.maxDrawdown)}</strong></span>${annualMode ? `<button type="button" data-${data.namespace}-year="${selected}">查看${selected}年月度</button>` : ''}`;
    const width = el.clientWidth, height = 290, left = 64, right = 18, top = 20, bottom = 36;
    const start = Date.parse(points[0].date), end = Date.parse(points.at(-1).date);
    const min = Math.min(...points.map(p => p.close)), max = Math.max(...points.map(p => p.close));
    const pad = Math.max((max - min) * 0.08, max * 0.005), low = Math.max(0, min - pad), high = max + pad;
    const x = date => left + (Date.parse(date) - start) / (end - start) * (width - left - right);
    const y = close => top + (high - close) / (high - low) * (height - top - bottom);
    // Long gaps are explicitly broken, including possible long exchange holidays.
    const path = list => list.map((p, i) => `${!i || Date.parse(p.date) - Date.parse(list[i - 1].date) > 7 * 86400000 ? 'M' : 'L'}${x(p.date).toFixed(2)},${y(p.close).toFixed(2)}`).join(' ');
    let content = `<title>${data.etf ? 'ETF前复权价格走势' : '指数日收盘走势'}</title>`;
    if (selected !== null) {
      const a = Math.max(start, annualMode ? Date.UTC(selected, 0, 1) : Date.UTC(data.year, selected - 1, 1)), b = Math.min(end, annualMode ? Date.UTC(selected + 1, 0, 1) : Date.UTC(data.year, selected, 1));
      content += `<rect x="${x(new Date(a).toISOString())}" y="${top}" width="${Math.max(0, x(new Date(b).toISOString()) - x(new Date(a).toISOString()))}" height="${height-top-bottom}" fill="#eaf1fb"/>`;
    }
    for (let i = 0; i < 5; i++) {
      const v = low + (high - low) * i / 4;
      content += `<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#dfe5e9"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#53616c">${v.toLocaleString('zh-CN', { minimumFractionDigits: data.etf ? 3 : 0, maximumFractionDigits: data.etf ? 3 : 0 })}</text>`;
    }
    const monthStarts = points.filter((p, i) => !i || (annualMode ? p.date.slice(0, 4) !== points[i - 1].date.slice(0, 4) : p.date.slice(0, 7) !== points[i - 1].date.slice(0, 7)));
    const tickEvery = Math.max(1, Math.ceil(monthStarts.length / (width < 500 ? 4 : 7)));
    monthStarts.forEach((p, i) => { if (i % tickEvery) return; content += `<text x="${x(p.date)}" y="${height-10}" text-anchor="middle" font-size="12" fill="#53616c">${annualMode ? p.date.slice(0,4) : Number(p.date.slice(5,7)) + '月'}</text>`; });
    content += `<path class="monthly-index-line" d="${path(points)}" fill="none" stroke="${selected === null ? '#2464bf' : '#7b8da1'}" stroke-width="1.6"/>`;
    if (selected !== null) {
      content += `<path class="monthly-index-highlight" d="${path(monthPoints)}" fill="none" stroke="#2464bf" stroke-width="3"/>`;
      for (const p of [monthPoints[0], monthPoints.at(-1)]) content += `<circle cx="${x(p.date)}" cy="${y(p.close)}" r="3.5" fill="#2464bf" stroke="white"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = content + '<g data-index-cursor visibility="hidden"><line stroke="#53616c" stroke-dasharray="3 3"/><circle r="4" fill="#2464bf" stroke="white"/></g>';
    geometry.set(el, { x, y, width, left, right, start, end, index: 0 });
  };
  const resize = new ResizeObserver(entries => entries.forEach(({target}) => draw(target)));
  const scan = () => {
    for (const el of registered) if (!el.isConnected) { resize.unobserve(el); registered.delete(el); }
    root.querySelectorAll('[data-index-chart]').forEach(el => { if (!registered.has(el)) { registered.add(el); resize.observe(el); draw(el); } });
  };
  const observer = new MutationObserver(records => { if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches?.('[data-index-chart]') || node.querySelector?.('[data-index-chart]'))))) scan(); });
  observer.observe(root, {childList: true, subtree: true}); scan();
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-index-month], [data-index-year], [data-index-clear]');
    if (!button || button.disabled) return;
    const el = button.closest('.monthly-index-row')?.querySelector('[data-index-chart]');
    if (!el) return;
    const data = payloadFor(el), month = button.hasAttribute('data-index-clear') ? null : Number(data.period === 'year' ? button.dataset.indexYear : button.dataset.indexMonth);
    indexMonthSelection.set(data.namespace + ':' + data.period, { year: data.year, month: selectionFor(data) === month ? null : month });
    draw(el);
    if (button.hasAttribute('data-index-clear')) el.querySelector('svg')?.focus({preventScroll:true});
    else if (getComputedStyle(el.closest('.monthly-index-row')).gridTemplateColumns.split(' ').length === 1) el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  });
  const inspect = (el, index) => {
    const g = geometry.get(el), data = payloadFor(el);
    if (!g) return;
    g.index = Math.max(0, Math.min(data.points.length - 1, index));
    const p = data.points[g.index], cursor = el.querySelector('[data-index-cursor]');
    cursor.setAttribute('visibility','visible');
    const line = cursor.querySelector('line'), circle = cursor.querySelector('circle');
    for (const name of ['x1','x2']) line.setAttribute(name,g.x(p.date));
    line.setAttribute('y1',20); line.setAttribute('y2',254);
    circle.setAttribute('cx',g.x(p.date)); circle.setAttribute('cy',g.y(p.close));
    el.querySelector('.monthly-index-readout').textContent = `${p.date} · 收盘 ${p.close.toLocaleString('zh-CN',{minimumFractionDigits:data.etf ? 3 : 2,maximumFractionDigits:data.etf ? 3 : 2})} ${data.etf ? '元（前复权）' : '点'}`;
  };
  root.addEventListener('pointermove', event => {
    const svg = event.target.closest('.monthly-index-svg'), el = svg?.closest('[data-index-chart]'), g = geometry.get(el);
    if (!g) return;
    const date = g.start + (event.clientX - svg.getBoundingClientRect().left - g.left) / (g.width - g.left - g.right) * (g.end - g.start);
    const points = payloadFor(el).points;
    let index = 0; points.forEach((p, i) => { if (Math.abs(Date.parse(p.date) - date) < Math.abs(Date.parse(points[index].date) - date)) index = i; });
    inspect(el,index);
  });
  root.addEventListener('keydown', event => {
    const svg = event.target.closest('.monthly-index-svg');
    if (!svg || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault(); const el = svg.closest('[data-index-chart]');
    inspect(el,(geometry.get(el)?.index ?? 0)+(event.key === 'ArrowLeft' ? -1 : 1));
  });
}
