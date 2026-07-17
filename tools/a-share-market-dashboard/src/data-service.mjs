import {
  INDEX_IDS,
  SOURCES,
  buildTreasuryUrl,
  fetchJson,
  isLocalProxyLocation,
  loadCsindexPerformance,
  loadIndexHistory,
  loadMarginHistory,
  loadMarketSnapshot,
  loadTreasuryHistory,
  parseTreasuryYield,
} from './adapters.mjs';

export const CACHE_PREFIX = 'a-share-dashboard:';

export function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
  };
}

function cacheKey(id) {
  return `${CACHE_PREFIX}${id}`;
}

function readCache(storage, id) {
  try {
    const value = storage?.getItem(cacheKey(id));
    if (!value) return null;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed : null;
  } catch {
    return null;
  }
}

function errorMessage(provider, error) {
  return `${provider}: ${error instanceof Error ? error.message : String(error)}`;
}

export async function loadDomain({
  id,
  providers = [],
  validate = data => data !== null && data !== undefined,
  storage = globalThis.localStorage,
  now = Date.now,
  maxAgeMs = 24 * 60 * 60 * 1000,
}) {
  const errors = [];
  for (const provider of providers) {
    try {
      const data = await provider.load();
      if (!validate(data)) throw new Error('validation failed');
      const fetchedAt = now();
      const dataAt = provider.dataAt?.(data) ?? fetchedAt;
      const envelope = { data, source: provider.name, savedAt: fetchedAt, dataAt };
      storage?.setItem(cacheKey(id), JSON.stringify(envelope));
      return { id, ...envelope, fetchedAt, status: 'latest', errors };
    } catch (error) {
      errors.push(errorMessage(provider.name, error));
    }
  }

  const cached = readCache(storage, id);
  if (!cached) {
    return { id, data: null, source: null, dataAt: null, fetchedAt: now(), status: 'missing', errors };
  }
  const referenceTime = Number(cached.dataAt ?? cached.savedAt);
  const expired = !Number.isFinite(referenceTime) || now() - referenceTime > maxAgeMs;
  return {
    id,
    ...cached,
    fetchedAt: now(),
    status: expired ? 'expired' : 'snapshot',
    errors,
  };
}

export async function refreshDomains(definitions, options = {}) {
  const entries = await Promise.all(definitions.map(async definition => {
    const result = await loadDomain({ ...definition, ...options });
    return [definition.id, result];
  }));
  return Object.fromEntries(entries);
}

function exampleDates(count) {
  const dates = [];
  const cursor = new Date('2015-12-01T00:00:00Z');
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function exampleIndex(dates, base, drift, phase) {
  return dates.map((date, index) => ({
    date,
    close: Number((base + index * drift + Math.sin(index / 47 + phase) * base * 0.09 + Math.sin(index / 213) * base * 0.06).toFixed(2)),
  }));
}

function exampleEnvelope(data, source = '内置示例数据') {
  const dataAt = Date.parse('2026-06-16T07:00:00Z');
  return { data, source, savedAt: dataAt, dataAt, fetchedAt: dataAt, status: 'example' };
}

export function createExampleSnapshot() {
  const dates = exampleDates(2750);
  const valuationDates = dates.slice(-1500);
  const ttmPeHistory = valuationDates.map((_, index) => Number((12.8 + Math.sin(index / 73) * 2.6 + Math.sin(index / 211) * 1.3).toFixed(4)));
  const forwardPeHistory = valuationDates.map((_, index) => Number((11.9 + Math.sin(index / 79 + 0.4) * 2.1 + Math.sin(index / 229) * 1.1).toFixed(4)));
  const treasury = valuationDates.map((date, index) => ({
    date,
    value: Number((2.55 - index * 0.00055 + Math.sin(index / 97) * 0.22).toFixed(4)),
  }));
  const turnover = valuationDates.map((date, index) => ({
    date,
    value: Math.round(720_000_000_000 + Math.sin(index / 31) * 180_000_000_000 + index * 115_000_000),
  }));
  const margin = valuationDates.map((date, index) => ({
    date,
    value: Math.round(1_350_000_000_000 + index * 250_000_000 + Math.sin(index / 57) * 55_000_000_000),
  }));
  const csi300Stats = valuationDates.map((date, index) => ({
    date,
    close: 3500,
    ttmPe: ttmPeHistory[index],
  }));

  return {
    mode: 'example',
    generatedAt: '2026-06-16T07:00:00.000Z',
    domains: {
      shanghaiHistory: exampleEnvelope(exampleIndex(dates, 2800, 0.24, 0)),
      csi300History: exampleEnvelope(exampleIndex(dates, 3500, 0.16, 1.1)),
      csiAllHistory: exampleEnvelope(exampleIndex(dates, 4300, 0.19, 2.2)),
      csi300Stats: exampleEnvelope(csi300Stats),
      forwardPe: exampleEnvelope(forwardPeHistory.map((value, index) => ({ date: valuationDates[index], value }))),
      treasury: exampleEnvelope(treasury),
      turnoverHistory: exampleEnvelope(turnover),
      margin: exampleEnvelope(margin),
      market: exampleEnvelope({
        advancers: 1680,
        decliners: 2860,
        unchanged: 138,
        limitUp: 43,
        limitDown: 18,
        turnover: turnover.at(-1).value,
        universe: 4678,
      }),
    },
  };
}

export const EXAMPLE_SNAPSHOT = createExampleSnapshot();

function lastPointTime(points) {
  const date = Array.isArray(points) ? points.at(-1)?.date : null;
  const timestamp = date ? Date.parse(`${date}T07:00:00+08:00`) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function compactDate(date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export function createDefaultDomainDefinitions(nowDate = new Date(), location = globalThis.location) {
  const start = new Date(nowDate);
  start.setUTCFullYear(start.getUTCFullYear() - 12);
  const startDate = compactDate(start);
  const endDate = compactDate(nowDate);
  const sourceName = name => `${name}${isLocalProxyLocation(location) ? '（本地代理）' : ''}`;
  const historyDefinition = (id, secid, providerName, csiCode = null) => ({
    id,
    providers: [
      { name: sourceName(providerName), load: () => loadIndexHistory(secid, 3000), dataAt: lastPointTime },
      ...(csiCode ? [{
        name: sourceName(`${SOURCES.csindex.name} ${csiCode}`),
        load: async () => (await loadCsindexPerformance(startDate, endDate, csiCode))
          .map(({ date, close }) => ({ date, close })),
        dataAt: lastPointTime,
      }] : []),
    ],
    validate: data => Array.isArray(data) && data.length >= 250,
    maxAgeMs: 36 * 60 * 60 * 1000,
  });

  return [
    historyDefinition('shanghaiHistory', INDEX_IDS.shanghai, SOURCES.eastmoneyKline.name),
    historyDefinition('csi300History', INDEX_IDS.csi300, SOURCES.eastmoneyKline.name, '000300'),
    historyDefinition('csiAllHistory', INDEX_IDS.csiAll, SOURCES.eastmoneyKline.name, '000985'),
    {
      id: 'csi300Stats',
      providers: [{ name: sourceName(SOURCES.csindex.name), load: () => loadCsindexPerformance(startDate, endDate), dataAt: lastPointTime }],
      validate: data => Array.isArray(data) && data.some(point => Number.isFinite(point.ttmPe)),
      maxAgeMs: 72 * 60 * 60 * 1000,
    },
    {
      id: 'turnoverHistory',
      providers: [{
        name: sourceName(`${SOURCES.csindex.name} 中证全指`),
        load: async () => (await loadCsindexPerformance(startDate, endDate, '000985'))
          .flatMap(point => Number.isFinite(point.turnover) ? [{ date: point.date, value: point.turnover }] : []),
        dataAt: lastPointTime,
      }],
      validate: data => Array.isArray(data) && data.length >= 250,
      maxAgeMs: 72 * 60 * 60 * 1000,
    },
    {
      id: 'forwardPe',
      providers: [],
      validate: data => Array.isArray(data) && data.some(point => Number.isFinite(point.value)),
      maxAgeMs: 72 * 60 * 60 * 1000,
    },
    {
      id: 'treasury',
      providers: [
        { name: sourceName(`${SOURCES.eastmoneyTreasury.name} JSONP`), load: loadTreasuryHistory, dataAt: lastPointTime },
        { name: sourceName(`${SOURCES.eastmoneyTreasury.name} Fetch`), load: async () => parseTreasuryYield(await fetchJson(buildTreasuryUrl())), dataAt: lastPointTime },
      ],
      validate: data => Array.isArray(data) && data.length >= 20,
      maxAgeMs: 72 * 60 * 60 * 1000,
    },
    {
      id: 'market',
      providers: [{ name: sourceName(SOURCES.eastmoneyMarket.name), load: loadMarketSnapshot }],
      validate: data => Number.isFinite(data?.universe) && data.universe > 1000,
      maxAgeMs: 10 * 60 * 1000,
    },
    {
      id: 'margin',
      providers: [{ name: sourceName(SOURCES.jin10Margin.name), load: loadMarginHistory, dataAt: lastPointTime }],
      validate: data => Array.isArray(data) && data.length >= 20,
      maxAgeMs: 72 * 60 * 60 * 1000,
    },
  ];
}
