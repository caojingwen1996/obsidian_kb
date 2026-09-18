// Build-time view; the NDX 2026 row is refreshed after each month-end.
export function renderIndexDayChart(csv, code) {
  const names = { 'H30269.CSI': '中证红利低波动（H30269）', NDX: '纳斯达克100（NDX）' };
  if (!names[code]) throw new Error('Unsupported index');
  const rows = csv.trim().split(/\r?\n/).slice(1).map(line => line.split(','))
    .filter(row => row[0] === code).map(row => ({ year: Number(row[2]), counts: row.slice(3, 6).map(Number), total: Number(row[6]), lastDate: row[11] }));
  if (rows.length !== 11 || rows.some((r, i) => r.year !== 2016 + i || r.counts.some(n => !Number.isInteger(n) || n < 0) || r.total <= 0 || r.counts.reduce((a, b) => a + b, 0) !== r.total)) throw new Error('Invalid annual index statistics');
  const totals = [0, 1, 2].map(i => rows.slice(0, 10).reduce((sum, r) => sum + r.counts[i], 0));
  const total = totals.reduce((a, b) => a + b, 0);
  const labels = ['上涨 > +0.5%', '震荡 ±0.5%内', '下跌 < −0.5%'];
  const lastDate = rows[10].lastDate;
  if (!/^2026\d{4}$/.test(lastDate)) throw new Error('Invalid 2026 cutoff date');
  const cutoff = `${lastDate.slice(0, 4)}-${lastDate.slice(4, 6)}-${lastDate.slice(6, 8)}`;
  return `<section class="panel index-day-chart" data-index-day-chart="${code}">
    <h3>${names[code]} · 逐年涨跌震荡天数</h3>
    ${code === 'H30269.CSI' ? '<p class="index-day-boundary">对照指数：本图为中证红利低波动 H30269，并非本页股息率信号使用的中证红利 000922。</p>' : ''}
    <p>2016—2025十个完整年度；2026*截至${cutoff}。${code === 'NDX' ? '2026年累计数据每月月末统计一次，次月1日北京时间08:00更新。' : '静态统计快照，不随实时行情刷新。'}</p>
    <div class="index-day-summary">${totals.map((n, i) => `<div><small>${labels[i]}</small><strong>年均 ${(n / 10).toFixed(1)} 天</strong><span>占 ${(n / total * 100).toFixed(1)}%</span></div>`).join('')}</div>
    <p>绿涨 / 蓝震荡 / 红跌；右侧依次为三类天数。悬停色块查看占比。</p>
    ${rows.map(r => `<div class="index-day-row"><span>${r.year}${r.year === 2026 ? '*' : ''}</span><div class="index-day-bar" role="img" aria-label="${r.year}年：上涨${r.counts[0]}天，震荡${r.counts[1]}天，下跌${r.counts[2]}天"><span title="上涨 ${r.counts[0]}天，占${(r.counts[0] / r.total * 100).toFixed(2)}%" style="width:${r.counts[0] / r.total * 100}%"></span><span title="震荡 ${r.counts[1]}天，占${(r.counts[1] / r.total * 100).toFixed(2)}%" style="width:${r.counts[1] / r.total * 100}%"></span><span title="下跌 ${r.counts[2]}天，占${(r.counts[2] / r.total * 100).toFixed(2)}%" style="width:${r.counts[2] / r.total * 100}%"></span></div><span>${r.counts.join(' / ')}</span></div>`).join('')}
    <p>按价格指数收盘相对前收盘计算，±0.5%边界计入震荡；不含红利再投资。年均与占比不含2026。${code === 'NDX' ? '来源：Yahoo日线；尚未完成独立美国交易日历逐日复核。' : '来源：Tushare日线，已逐日核对SSE开市日历。'}</p>
  </section>`;
}
