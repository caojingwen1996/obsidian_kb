import { DAILY_DROP_REFERENCE } from './daily-drop-reference.mjs';

const dailyDropEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dailyDropContexts = new Map();
const dailyDropSelections = new Map();
const dailyDropNames = {nasdaq:'纳斯达克100',dividend:'中证红利指数',spdividend:'南方红利低波50ETF'};
const dailyDropAnnotations = new Map(DAILY_DROP_REFERENCE.rows.map(row => [row.date, row]));

// Shared by the summary and the detail so threshold boundaries and skipped samples agree.
export function dailyDropComparisons(points, previousPoint = null) {
  const comparisons = [];
  let previous = previousPoint;
  for (const point of points) {
    if (!Number.isFinite(point?.close) || point.close <= 0) { previous = null; continue; }
    const gap = previous ? (Date.parse(point.date) - Date.parse(previous.date)) / 86400000 : NaN;
    if (Number.isFinite(previous?.close) && previous.close > 0 && gap > 0 && gap <= 7) {
      comparisons.push({...point,change:(point.close / previous.close - 1) * 100});
    }
    previous = point;
  }
  return comparisons;
}

export function buildDailyDropDetail(rows, {threshold = 5, year = 'all', namespace = 'nasdaq'} = {}) {
  if (![5,8,10].includes(Number(threshold))) throw new Error('不支持的单日跌幅阈值');
  let previous = null;
  const points = [], events = [];
  for (const row of [...rows].sort((a,b)=>a.year-b.year)) {
    const closed = (row.chartPoints ?? []).filter(p => !row.isIntraday || p.date !== row.endDate);
    points.push(...closed);
    events.push(...dailyDropComparisons(closed,previous).filter(p => -p.change > Number(threshold) + 1e-9 && (year === 'all' || Number(p.date.slice(0,4)) === Number(year))));
    previous = closed.at(-1) ?? null;
  }
  const positions = new Map(), peaks = [];
  let peak = 0;
  points.forEach((p,i)=>{ positions.set(p.date,i); peak=Math.max(peak,p.close);peaks.push(peak); });
  return events.map(event => {
    const index=positions.get(event.date);
    const forward = offset => {
      const target=points[index+offset];
      if (!target) return {value:null,reason:'后续交易日不足'};
      for(let i=index+1;i<=index+offset;i++) {
        const gap=(Date.parse(points[i].date)-Date.parse(points[i-1].date))/86400000;
        if(gap<=0 || gap>7) return {value:null,reason:'区间日线不连续'};
      }
      return {value:(target.close/event.close-1)*100,date:target.date};
    };
    const annotation = namespace === 'nasdaq' ? dailyDropAnnotations.get(event.date) : null;
    return {...event, drawdown:(event.close/peaks[index]-1)*100, forward:[1,5,250].map(forward),
      annotation,group:annotation?.group ?? `${event.date.slice(0,4)} 其他事件`,tone:annotation?.tone ?? 'blue'};
  });
}

function dailyDropPercent(value, digits = 1) {
  if(!Number.isFinite(value)) return '—';
  const rounded=Number(value.toFixed(digits));
  return `${rounded>0?'+':rounded<0?'−':''}${Math.abs(rounded).toFixed(digits)}%`;
}

export function renderDailyDropDetail(context, selection) {
  const {rows,namespace,source} = context;
  const {threshold,year} = selection;
  const events=buildDailyDropDetail(rows,{threshold,year,namespace});
  const groups=new Map();
  for(const event of events){if(!groups.has(event.group))groups.set(event.group,[]);groups.get(event.group).push(event);}
  const years=rows.map(row=>row.year).sort((a,b)=>b-a);
  const range=years.length?`${years.at(-1)}—${years[0]}`:'暂无历史';
  const percentCell=result=>`<td class="${result.value>0?'drop-positive':result.value<0?'drop-negative':'drop-muted'}" title="${dailyDropEscape(result.date?`截至${result.date}收盘`:result.reason)}">${dailyDropPercent(result.value)}</td>`;
  const annotationCount=events.filter(event=>event.annotation).length;
  return `<div class="daily-drop-detail-head">
    <div class="daily-drop-detail-tools"><button type="button" class="button-secondary" data-daily-drop-back>返回回撤统计</button>
    <div class="daily-drop-filters"><div role="group" aria-label="单日跌幅筛选">${[5,8,10].map(t=>`<button type="button" data-daily-drop-filter="${t}" aria-pressed="${Number(threshold)===t}">&gt;${t}%</button>`).join('')}</div>
    <label>年份 <select data-daily-drop-year><option value="all"${year==='all'?' selected':''}>全部年份</option>${years.map(y=>`<option value="${y}"${String(year)===String(y)?' selected':''}>${y}年</option>`).join('')}</select></label></div></div>
    <h2 tabindex="-1" data-daily-drop-heading>${events.length} 次单日跌幅 &gt; ${threshold}%：日期 · 跌幅 · 估值 · 成因</h2>
    <p>${dailyDropNames[namespace] ?? '指数'} · ${year==='all'?range:`${year}年`} · 按周期分组 · 收盘对收盘（红涨绿跌）</p>
    ${namespace==='nasdaq'?`<p class="daily-drop-reference-note"><strong>参考图估算／事件归纳</strong>：PE、估值分位与成因来自参考图，未独立核验。<a href="${dailyDropEscape(DAILY_DROP_REFERENCE.sourcePath)}" target="_blank" rel="noopener">查看参考原图</a></p><p class="daily-drop-valuation-key">分位色阶：<span class="drop-high">≥80 高估</span> · <span class="drop-middle">40—79 中性</span> · <span class="drop-low">&lt;40 低估</span> · ${annotationCount}/${events.length} 条有参考注释</p>`:'<p class="daily-drop-reference-note">当前标的未提供历史估值和事件注释；估值列显示“—”，事件注释显示“待补充”。</p>'}
  </div>
  <p class="daily-drop-scroll-hint">横向滚动可查看估值、后续收益与事件成因；纵向滚动查看全部记录。</p>
  <div class="daily-drop-detail-scroll" tabindex="0" role="region" aria-label="单日回撤事件明细，可横向滚动">
    <table class="daily-drop-detail-table"><caption class="sr-only">${dailyDropNames[namespace]}单日跌幅事件明细</caption>
      <thead><tr>${['日期','单日跌幅','收盘','距高点<small>样本内</small>','PE–TTM<small>参考图估算</small>','估值分位<small>参考图估算</small>','后1天<small>1交易日</small>','后1周<small>5交易日</small>','后1年<small>250交易日</small>','发生了什么<small>参考图事件归纳</small>','事件性质'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead>
      ${[...groups].map(([label,items])=>`<tbody><tr class="daily-drop-group tone-${items[0].tone}"><th colspan="11" scope="rowgroup"><span>${dailyDropEscape(label)}</span><small>${items.length} 次</small></th></tr>${items.map(event=>{
        const a=event.annotation;
        const valuationTone=a?(a.percentileEstimate>=80?'drop-high':a.percentileEstimate>=40?'drop-middle':'drop-low'):'';
        return `<tr data-daily-drop-date="${event.date}"><th scope="row">${event.date}</th><td class="drop-negative">${dailyDropPercent(event.change,2)}</td><td>${event.close.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td class="drop-muted">${dailyDropPercent(event.drawdown)}</td>
        <td title="参考图重建估算，非已核验的历史PE">${a?a.peEstimate.toFixed(1):'—'}</td><td>${a?`<span class="daily-drop-percentile ${valuationTone}" title="参考图全样本估算分位，非当时可得分位">${a.percentileEstimate}</span>`:'—'}</td>
        ${event.forward.map(percentCell).join('')}<td class="daily-drop-cause">${dailyDropEscape(a?.note??'待补充：暂无该日期的事件归纳')}</td><td><span class="daily-drop-tag tone-${event.tone}">${dailyDropEscape(a?.kind??'待补充')}</span></td></tr>`;
      }).join('')}</tbody>`).join('')}
    </table>
    ${events.length?'':'<p class="daily-drop-detail-empty" role="status">所选年份暂无超过该阈值的可统计事件，可切换阈值或查看全部年份。</p>'}
  </div>
  <div class="daily-drop-detail-notes"><p>单日跌幅＝当日收盘÷上一交易日收盘−1，沿用统计表严格超过阈值的口径。距高点使用已加载样本内、截至当日的最高收盘价，首年以前历史不在计算范围内；${namespace==='spdividend'?'收盘为ETF前复权价格（元）':'收盘为指数点位'}。来源：${dailyDropEscape(source||'当前页面已加载日线')}。</p>
  <p>后1天／后1周／后1年为其后第1／5／250个交易日收盘相对事件日收盘的累计涨跌幅，按可用日线计算；不含分红再投资。盘中估算排除，缺少前值或相邻样本超过7天跳过。后续日线不足或区间不连续显示“—”，不作预测。</p>
  ${namespace==='nasdaq'?'<p>参考图称PE由公开锚点与点位重建、误差约±15%，该方法与误差未独立核验。估值分位沿用参考图1996-01至2026-11全样本口径，包含事后信息，不能作为当时可得的交易信号。周期分组、事件成因与性质均为参考图事后归纳。</p>':''}</div>`;
}

export function dailyDropViewState(rows, namespace, source) {
  const context={rows,namespace,source};
  dailyDropContexts.set(namespace,context);
  const selection=dailyDropSelections.get(namespace);
  return {active:Boolean(selection),html:selection?renderDailyDropDetail(context,selection):''};
}

export function bindDailyDropDetails(root) {
  const update = (host, selection, focusSelector='[data-daily-drop-heading]') => {
    const key=host.dataset.dailyDropView, context=dailyDropContexts.get(key);
    if(!context)return;
    dailyDropSelections.set(key,selection);
    host.querySelector('[data-daily-drop-overview]').hidden=true;
    const detail=host.querySelector('[data-daily-drop-detail]');
    detail.hidden=false;detail.innerHTML=renderDailyDropDetail(context,selection);
    detail.querySelector(focusSelector)?.focus({preventScroll:true});
    host.scrollIntoView({block:'start',behavior:'instant'});
  };
  root.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-daily-drop-threshold],[data-daily-drop-filter],[data-daily-drop-back]');
    const host=button?.closest('[data-daily-drop-view]');
    if(!host)return;
    const key=host.dataset.dailyDropView;
    if(button.hasAttribute('data-daily-drop-back')){
      const selection=dailyDropSelections.get(key);dailyDropSelections.delete(key);
      host.querySelector('[data-daily-drop-detail]').hidden=true;
      host.querySelector('[data-daily-drop-overview]').hidden=false;
      const target=host.querySelector(`[data-daily-drop-threshold="${selection?.originThreshold}"][data-daily-drop-scope="${selection?.originYear}"]`);
      target?.focus();return;
    }
    if(button.hasAttribute('data-daily-drop-filter')){
      update(host,{...dailyDropSelections.get(key),threshold:Number(button.dataset.dailyDropFilter)},`[data-daily-drop-filter="${button.dataset.dailyDropFilter}"]`);return;
    }
    const threshold=Number(button.dataset.dailyDropThreshold),year=button.dataset.dailyDropScope;
    update(host,{threshold,year,originThreshold:threshold,originYear:year});
  });
  root.addEventListener('change',event=>{
    const select=event.target.closest?.('[data-daily-drop-year]'),host=select?.closest('[data-daily-drop-view]');
    if(host)update(host,{...dailyDropSelections.get(host.dataset.dailyDropView),year:select.value},'[data-daily-drop-year]');
  });
}
