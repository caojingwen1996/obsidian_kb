export const SOURCES = Object.freeze({
  eastmoneyKline: { name: '东方财富指数行情', url: 'https://push2his.eastmoney.com' },
  csindex: { name: '中证指数官网', url: 'https://www.csindex.com.cn' },
  eastmoneyTreasury: { name: '东方财富中美国债收益率', url: 'https://datacenter.eastmoney.com' },
  eastmoneyMarket: { name: '东方财富沪深A股行情', url: 'https://push2.eastmoney.com' },
  jin10Margin: { name: '金十融资融券历史汇总', url: 'https://cdn.jin10.com' },
});

export const INDEX_IDS = Object.freeze({
  shanghai: '1.000001',
  csi300: '1.000300',
  csiAll: '1.000985',
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildEastmoneyKlineUrl(secid, limit = 3000) {
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
  url.search = new URLSearchParams({
    secid,
    klt: '101',
    fqt: '1',
    lmt: String(limit),
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
  }).toString();
  return url.toString();
}

export function buildCsindexPerformanceUrl(startDate, endDate, indexCode = '000300') {
  const url = new URL('https://www.csindex.com.cn/csindex-home/perf/index-perf');
  url.search = new URLSearchParams({ indexCode, startDate, endDate }).toString();
  return url.toString();
}

export function buildTreasuryUrl(page = 1) {
  const url = new URL('https://datacenter.eastmoney.com/api/data/get');
  url.search = new URLSearchParams({
    type: 'RPTA_WEB_TREASURYYIELD',
    sty: 'ALL',
    st: 'SOLAR_DATE',
    sr: '-1',
    token: '894050c76af8597a853f5b408b759f5d',
    p: String(page),
    ps: '500',
    pageNo: String(page),
    pageNum: String(page),
  }).toString();
  return url.toString();
}

export function buildMarketSnapshotUrl() {
  const url = new URL('https://push2.eastmoney.com/api/qt/clist/get');
  url.search = new URLSearchParams({
    pn: '1',
    pz: '6000',
    po: '1',
    np: '1',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
    fields: 'f3,f6,f12,f14,f18',
  }).toString();
  return url.toString();
}

export function parseEastmoneyKlines(payload) {
  const rows = payload?.data?.klines;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    const fields = String(row).split(',');
    const close = finiteNumber(fields[2]);
    return fields[0] && close !== null ? [{ date: fields[0], close }] : [];
  });
}

export function parseCsindexPerformance(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.flatMap(row => {
    const date = Array.isArray(row) ? row[0] : row.tradeDate ?? row.date ?? row.trade_date;
    const close = finiteNumber(Array.isArray(row) ? row[9] : row.close ?? row.closePrice);
    const ttmPe = finiteNumber(Array.isArray(row) ? row[15] : row.rollingPES ?? row.rollingPE ?? row.rollingPe);
    const turnover = finiteNumber(Array.isArray(row) ? row[13] : row.tradingAmount ?? row.turnover ?? row.amount);
    return date && close !== null ? [{ date: String(date).slice(0, 10), close, ttmPe, turnover }] : [];
  });
}

export function parseTreasuryYield(payload) {
  const rows = Array.isArray(payload?.result?.data) ? payload.result.data : [];
  return rows.flatMap(row => {
    const value = finiteNumber(row.EMM00166466);
    return row.SOLAR_DATE && value !== null
      ? [{ date: String(row.SOLAR_DATE).slice(0, 10), value }]
      : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function limitPercent(code, name) {
  if (/ST/i.test(name)) return 5;
  if (/^(300|301|688|689)/.test(code)) return 20;
  if (/^(4|8|92)/.test(code)) return 30;
  return 10;
}

export function parseMarketSnapshot(payload) {
  const rows = Array.isArray(payload?.data?.diff) ? payload.data.diff : [];
  const result = {
    advancers: 0,
    decliners: 0,
    unchanged: 0,
    limitUp: 0,
    limitDown: 0,
    turnover: 0,
    universe: 0,
  };
  rows.forEach(row => {
    const percent = finiteNumber(row.f3);
    const code = String(row.f12 ?? '');
    const name = String(row.f14 ?? '');
    if (percent === null || !code) return;
    result.universe += 1;
    if (percent > 0) result.advancers += 1;
    else if (percent < 0) result.decliners += 1;
    else result.unchanged += 1;
    const threshold = limitPercent(code, name);
    if (percent >= threshold - 0.15) result.limitUp += 1;
    if (percent <= -threshold + 0.15) result.limitDown += 1;
    const turnover = finiteNumber(row.f6);
    if (turnover !== null && turnover > 0) result.turnover += turnover;
  });
  return result;
}

export function parseMarginReport(payload) {
  const values = payload?.values;
  if (!values || typeof values !== 'object') return [];
  return Object.entries(values).flatMap(([date, row]) => {
    const value = finiteNumber(Array.isArray(row) ? row[1] : null);
    return value !== null ? [{ date, value }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

export function jsonp(url, callbackParam = 'cb', timeoutMs = 12000) {
  if (typeof document === 'undefined') return Promise.reject(new Error('JSONP requires a browser document'));
  return new Promise((resolve, reject) => {
    const callbackName = `__aShareDashboard_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const target = new URL(url);
    target.searchParams.set(callbackParam, callbackName);
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      script.remove();
      delete globalThis[callbackName];
    };
    globalThis[callbackName] = payload => {
      cleanup();
      resolve(payload);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error(`JSONP request failed: ${target.hostname}`));
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`JSONP request timed out: ${target.hostname}`));
    }, timeoutMs);
    script.src = target.toString();
    document.head.append(script);
  });
}

export async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).hostname}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadIndexHistory(secid, limit = 3000) {
  return parseEastmoneyKlines(await jsonp(buildEastmoneyKlineUrl(secid, limit), 'cb'));
}

export async function loadCsindexPerformance(startDate, endDate, indexCode = '000300') {
  return parseCsindexPerformance(await fetchJson(buildCsindexPerformanceUrl(startDate, endDate, indexCode)));
}

export async function loadTreasuryHistory() {
  return parseTreasuryYield(await jsonp(buildTreasuryUrl(), 'callback'));
}

export async function loadMarketSnapshot() {
  return parseMarketSnapshot(await jsonp(buildMarketSnapshotUrl(), 'cb'));
}

export async function loadMarginHistory() {
  const urls = [
    'https://cdn.jin10.com/data_center/reports/fs_1.json',
    'https://cdn.jin10.com/data_center/reports/fs_2.json',
  ];
  const reports = await Promise.all(urls.map(url => fetchJson(`${url}?_=${Date.now()}`)));
  const totals = new Map();
  reports.flatMap(parseMarginReport).forEach(point => {
    totals.set(point.date, (totals.get(point.date) ?? 0) + point.value);
  });
  return [...totals.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
