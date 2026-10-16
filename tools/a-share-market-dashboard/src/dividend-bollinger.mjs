import { buildLocalProxyUrl, fetchJson, isLocalProxyLocation, parseCsindexPerformance, requestTimeout } from './adapters.mjs';

export const DIVIDEND_BOLLINGER_PERIOD = 20;
export const DIVIDEND_BOLLINGER_MULTIPLIER = 2;

function dividendTradingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && ![0, 6].includes(date.getUTCDay()) ? date : null;
}

function dividendWeekStart(date) {
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return monday.toISOString().slice(0, 10);
}

function dividendShanghaiClock(asOf) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(asOf).map(part => [part.type, part.value]));
  return { today: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function mergeDividendIndexHistory(...histories) {
  const points = new Map();
  for (const history of histories) {
    for (const point of Array.isArray(history) ? history : []) {
      if (dividendTradingDate(point?.date) && typeof point.close === 'number' && Number.isFinite(point.close) && point.close > 0) {
        points.set(point.date, { date: point.date, close: point.close });
      }
    }
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function dividendBollingerPosition(close, { lower, middle, upper }) {
  const near = value => Math.abs(close - value) <= Math.max(1, Math.abs(value)) * 1e-10;
  if (upper === lower) return { label: '三轨重合', percentB: null };
  const label = near(lower) ? '位于下轨' : near(upper) ? '位于上轨' : near(middle) ? '位于中轨'
    : close < lower ? '下轨下方' : close < middle ? '下轨至中轨' : close < upper ? '中轨至上轨' : '上轨上方';
  return { label, percentB: (close - lower) / (upper - lower) * 100 };
}

export function calculateDividendWeeklyBollinger(points = [], { asOf = new Date() } = {}) {
  const { today, hour } = dividendShanghaiClock(asOf);
  const weeks = new Map();
  for (const point of mergeDividendIndexHistory(points).filter(point => point.date <= today)) {
    const week = dividendWeekStart(dividendTradingDate(point.date));
    weeks.set(week, { ...point, week });
  }
  const weekly = [...weeks.values()];
  const latest = weekly.at(-1);
  const result = { status: latest ? 'insufficient' : 'missing', weeks: weekly.length, period: DIVIDEND_BOLLINGER_PERIOD,
    multiplier: DIVIDEND_BOLLINGER_MULTIPLIER, date: latest?.date ?? null, close: latest?.close ?? null };
  if (weekly.length < DIVIDEND_BOLLINGER_PERIOD) return result;
  const window = weekly.slice(-DIVIDEND_BOLLINGER_PERIOD);
  const middle = window.reduce((sum, point) => sum + point.close, 0) / window.length;
  const deviation = Math.sqrt(window.reduce((sum, point) => sum + (point.close - middle) ** 2, 0) / window.length);
  const lower = middle - DIVIDEND_BOLLINGER_MULTIPLIER * deviation;
  const upper = middle + DIVIDEND_BOLLINGER_MULTIPLIER * deviation;
  const todayDate = new Date(`${today}T00:00:00Z`);
  const weekday = todayDate.getUTCDay();
  const isPartialWeek = latest.week === dividendWeekStart(todayDate) && (weekday >= 1 && weekday <= 4 || weekday === 5 && hour < 15);
  return { ...result, status: 'ready', middle, lower, upper, deviation, isPartialWeek,
    windowStart: window[0].date, ...dividendBollingerPosition(latest.close, { lower, middle, upper }) };
}

export async function loadDividendBollingerHistory({ asOf = new Date(), fetcher = fetchJson, location = globalThis.location } = {}) {
  if (!isLocalProxyLocation(location)) throw new Error('请通过启动面板刷新中证红利周线数据。');
  const { today } = dividendShanghaiClock(asOf);
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 400);
  const payload = await fetcher(buildLocalProxyUrl('/api/csindex-performance', {
    indexCode: '000922', startDate: start.toISOString().slice(0, 10).replaceAll('-', ''), endDate: today.replaceAll('-', ''),
  }, location), requestTimeout(location));
  if (payload?.success === false || payload?.code != null && String(payload.code) !== '200'
    || !Array.isArray(payload?.data) || payload.data.some(row => !Array.isArray(row) && row?.indexCode != null && row.indexCode !== '000922')) {
    throw new Error('中证红利行情数据格式或指数代码无效。');
  }
  const history = mergeDividendIndexHistory(parseCsindexPerformance(payload)).filter(point => point.date <= today);
  if (calculateDividendWeeklyBollinger(history, { asOf }).status !== 'ready') throw new Error('中证红利有效历史不足20周，暂不能更新布林轨道。');
  return history;
}
