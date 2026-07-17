# A 股大盘估值分位监控面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a directly-openable single-file HTML dashboard that automatically refreshes A-share position, valuation, ERP, and transparent sentiment metrics, then produces an auditable 0–100 buy-point score.

**Architecture:** Keep testable calculation, adapter, cache, and UI modules under `tools/a-share-market-dashboard/src/`; a dependency-free Node build script strips ESM imports/exports and embeds those modules, CSS, and HTML into one runtime artifact. The browser starts from an embedded demonstrative snapshot, then refreshes each independent public-data domain and fails closed to validated `localStorage` snapshots without inventing values.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, ES modules, Node.js built-in test runner, inline SVG/CSS visualizations, public HTTPS/JSONP data endpoints, browser `localStorage`.

---

## File map

- `tools/a-share-market-dashboard/package.json`: dependency-free test/build commands.
- `tools/a-share-market-dashboard/src/core.mjs`: pure SMA, percentile, position, valuation, emotion, weight, score, and conclusion functions.
- `tools/a-share-market-dashboard/src/adapters.mjs`: public endpoint builders, JSONP/fetch transport, response parsers, and source metadata.
- `tools/a-share-market-dashboard/src/data-service.mjs`: cache envelopes, staleness, provider fallback, refresh isolation, and example snapshot.
- `tools/a-share-market-dashboard/src/app.mjs`: state, navigation, window changes, rendering, status, audit details, and refresh scheduling.
- `tools/a-share-market-dashboard/src/index.html`: semantic dashboard shell.
- `tools/a-share-market-dashboard/src/styles.css`: fixed-sidebar responsive presentation.
- `tools/a-share-market-dashboard/scripts/build.mjs`: deterministic single-file bundler.
- `tools/a-share-market-dashboard/tests/*.test.mjs`: unit, adapter, cache, and artifact contract tests.
- `tools/a-share-market-dashboard/a-share-market-dashboard.html`: final standalone artifact.
- `tools/a-share-market-dashboard/README.md`: scope, operation, formulas, sources, and known limitations.
- `log.md`: repository maintenance entry.

### Task 1: Scaffold the dependency-free tool and prove the test harness

**Files:**
- Create: `tools/a-share-market-dashboard/package.json`
- Create: `tools/a-share-market-dashboard/tests/core.test.mjs`
- Create: `tools/a-share-market-dashboard/src/core.mjs`

- [ ] **Step 1: Write the failing import test**

```js
// tests/core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp } from '../src/core.mjs';

test('clamp keeps a score inside 0 to 100', () => {
  assert.equal(clamp(-5), 0);
  assert.equal(clamp(42.5), 42.5);
  assert.equal(clamp(105), 100);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/core.test.mjs
```

Expected: FAIL because `src/core.mjs` or `clamp` does not exist.

- [ ] **Step 3: Add the minimal module and package commands**

```js
// src/core.mjs
export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}
```

```json
{
  "name": "a-share-market-dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "build": "node scripts/build.mjs"
  }
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Expected: 1 test passes, 0 fails.

- [ ] **Step 5: Commit the scaffold**

```powershell
git add tools/a-share-market-dashboard/package.json tools/a-share-market-dashboard/src/core.mjs tools/a-share-market-dashboard/tests/core.test.mjs
git commit -m "test: scaffold A-share dashboard core"
```

### Task 2: Implement position and percentile calculations with TDD

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/core.test.mjs`
- Modify: `tools/a-share-market-dashboard/src/core.mjs`

- [ ] **Step 1: Add failing tests for percentile, MA250 warmup, and window selection**

```js
import {
  percentileRank,
  deviationSeries,
  calculatePositionMetric,
  tradingDaysForWindow,
} from '../src/core.mjs';

test('percentileRank uses the inclusive empirical rank', () => {
  assert.equal(percentileRank([1, 2, 3, 4], 2), 50);
});

test('deviationSeries starts only after the moving-average warmup', () => {
  const points = Array.from({ length: 252 }, (_, index) => ({
    date: `d${index}`,
    close: index + 1,
  }));
  const result = deviationSeries(points, 250);
  assert.equal(result.length, 3);
  assert.equal(result[0].date, 'd249');
});

test('calculatePositionMetric reverses a high deviation percentile', () => {
  const points = Array.from({ length: 260 }, (_, index) => ({ date: `d${index}`, close: 100 + index }));
  const result = calculatePositionMetric(points, 1, 250);
  assert.equal(result.percentile, 100);
  assert.equal(result.score, 0);
});

test('window labels map to explicit trading-day counts', () => {
  assert.deepEqual([1, 3, 5, 10].map(tradingDaysForWindow), [250, 750, 1250, 2500]);
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the four functions are not exported.

- [ ] **Step 3: Implement the minimum pure calculations**

```js
export function percentileRank(values, current) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length || !Number.isFinite(current)) return null;
  return clamp((valid.filter(value => value <= current).length / valid.length) * 100);
}

export function tradingDaysForWindow(years) {
  const map = { 1: 250, 3: 750, 5: 1250, 10: 2500 };
  if (!map[years]) throw new RangeError(`Unsupported window: ${years}`);
  return map[years];
}

export function deviationSeries(points, period = 250) {
  const output = [];
  let rolling = 0;
  points.forEach((point, index) => {
    rolling += point.close;
    if (index >= period) rolling -= points[index - period].close;
    if (index >= period - 1) {
      const average = rolling / period;
      output.push({ date: point.date, close: point.close, deviation: point.close / average - 1 });
    }
  });
  return output;
}

export function calculatePositionMetric(points, years, period = 250) {
  const series = deviationSeries(points, period);
  const sample = series.slice(-tradingDaysForWindow(years));
  if (!sample.length) return null;
  const current = sample.at(-1);
  const percentile = percentileRank(sample.map(point => point.deviation), current.deviation);
  return { ...current, percentile, score: clamp(100 - percentile), sampleSize: sample.length };
}
```

- [ ] **Step 4: Run and verify GREEN**

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tools/a-share-market-dashboard/src/core.mjs tools/a-share-market-dashboard/tests/core.test.mjs
git commit -m "feat: calculate A-share trend deviation percentiles"
```

### Task 3: Implement valuation, emotion, weighting, and conclusion rules with TDD

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/core.test.mjs`
- Modify: `tools/a-share-market-dashboard/src/core.mjs`

- [ ] **Step 1: Add failing rule tests**

```js
import {
  calculateValuationMetrics,
  calculateGreedMetrics,
  calculateWeightedScore,
  conclusionForScore,
} from '../src/core.mjs';

test('valuation calculates earnings yield and ERP in percentage points', () => {
  const result = calculateValuationMetrics({ ttmPeHistory: [10, 12, 15], forwardPeHistory: [10, 12.5, 20], bond10yHistory: [2, 2, 2] });
  assert.equal(result.forwardEarningsYield.value, 5);
  assert.equal(result.erp.value, 3);
});

test('emotion converts greed into a reversed buy-point score', () => {
  const result = calculateGreedMetrics({ advancers: 20, decliners: 80, limitUp: 1, limitDown: 9, turnoverPercentile: 30, marginChangePercentile: 40 });
  assert.equal(result.greed, 25);
  assert.equal(result.buyScore, 75);
});

test('missing metrics are removed and remaining weights are normalized', () => {
  const result = calculateWeightedScore([
    { id: 'a', score: 80, weight: 60 },
    { id: 'b', score: null, weight: 40 },
  ]);
  assert.equal(result.score, 80);
  assert.equal(result.coverage, 60);
  assert.equal(result.items[0].effectiveWeight, 100);
});

test('coverage below 70 suppresses an action conclusion', () => {
  assert.equal(conclusionForScore(90, 69).label, '数据不足，暂不判断');
  assert.equal(conclusionForScore(82, 100).label, '别人恐惧，可以贪婪');
  assert.equal(conclusionForScore(20, 100).label, '市场贪婪，应该恐惧');
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the scoring functions do not exist.

- [ ] **Step 3: Implement explicit rules**

Implementation must use these exact contracts:

```js
const BASE_WEIGHTS = Object.freeze({
  positionShanghai: 10,
  positionCsi300: 15,
  positionCsiAll: 15,
  ttmPe: 12,
  forwardEarningsYield: 10,
  erp: 13,
  breadth: 7,
  limitBalance: 6,
  turnover: 6,
  margin: 6,
});

// breadthGreed = advancers / (advancers + decliners) * 100
// limitGreed = limitUp / (limitUp + limitDown) * 100
// turnoverGreed = current total-turnover percentile
// marginGreed = current 20-trading-day financing-balance change percentile
// emotion buy score = 100 - weighted greed
// forward earnings yield = 100 / forward PE
// ERP percentage points = forward earnings yield - 10Y CGB yield
```

`calculateWeightedScore` must retain each item's original weight, effective weight, score, and contribution. `conclusionForScore` must implement the approved five score bands and the 70% coverage gate.

- [ ] **Step 4: Run and verify GREEN**

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tools/a-share-market-dashboard/src/core.mjs tools/a-share-market-dashboard/tests/core.test.mjs
git commit -m "feat: add transparent A-share buy-point scoring"
```

### Task 4: Implement and test browser data adapters

**Files:**
- Create: `tools/a-share-market-dashboard/tests/adapters.test.mjs`
- Create: `tools/a-share-market-dashboard/src/adapters.mjs`

- [ ] **Step 1: Write failing parser and URL-contract tests**

Tests must cover:

```js
test('Eastmoney kline parser maps date and close', () => {
  assert.deepEqual(parseEastmoneyKlines({ data: { klines: ['2026-07-17,3500,3510,0,0,0,0,0,0,0,0'] } }), [
    { date: '2026-07-17', close: 3510 },
  ]);
});

test('CSI index performance parser keeps rolling PE', () => {
  const row = { tradeDate: '2026-07-17', close: '4000', rollingPES: '12.5' };
  assert.equal(parseCsindexPerformance({ data: [row] })[0].ttmPe, 12.5);
});

test('treasury parser extracts China 10-year yield', () => {
  const payload = { result: { data: [{ SOLAR_DATE: '2026-07-17', EMM00166466: '1.75' }] } };
  assert.deepEqual(parseTreasuryYield(payload), [{ date: '2026-07-17', value: 1.75 }]);
});

test('market snapshot counts breadth, limit status, and turnover', () => {
  const payload = { data: { diff: [
    { f3: 10.1, f6: 100, f12: '600000', f14: '甲', f18: 10 },
    { f3: -10.1, f6: 200, f12: '000001', f14: '乙', f18: 10 },
  ] } };
  assert.deepEqual(parseMarketSnapshot(payload), { advancers: 1, decliners: 1, unchanged: 0, limitUp: 1, limitDown: 1, turnover: 300, universe: 2 });
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because adapter exports do not exist.

- [ ] **Step 3: Implement transport and adapters**

Use the following source contracts:

- Eastmoney index history: `https://push2his.eastmoney.com/api/qt/stock/kline/get`, with `secid=1.000001`, `1.000300`, and `1.000985`, `klt=101`, `fqt=1`, `lmt=3000`, and JSONP callback parameter `cb`.
- CSI 300 close and rolling PE: `https://www.csindex.com.cn/csindex-home/perf/index-perf?indexCode=000300&startDate=YYYYMMDD&endDate=YYYYMMDD`.
- China/US treasury history: `https://datacenter.eastmoney.com/api/data/get?type=RPTA_WEB_TREASURYYIELD&sty=ALL&st=SOLAR_DATE&sr=-1&token=894050c76af8597a853f5b408b759f5d&p=1&ps=500&pageNo=1&pageNum=1`.
- A-share breadth snapshot: `https://push2.eastmoney.com/api/qt/clist/get`, with Shanghai/Shenzhen A-share filters, fields `f3,f6,f12,f14,f18`, and JSONP callback parameter `cb`.
- Shanghai/Shenzhen margin histories: `https://cdn.jin10.com/data_center/reports/fs_1.json` and `fs_2.json`.

Implement `jsonp(url, callbackParam, timeoutMs)` by creating a uniquely named global callback and deleting both the callback and script on resolve, reject, or timeout. Implement `fetchJson(url, timeoutMs)` with `AbortController`. Do not retry indefinitely.

- [ ] **Step 4: Run and verify GREEN**

Expected: adapter tests pass with fixture payloads and no live network dependency.

- [ ] **Step 5: Commit**

```powershell
git add tools/a-share-market-dashboard/src/adapters.mjs tools/a-share-market-dashboard/tests/adapters.test.mjs
git commit -m "feat: add public A-share data adapters"
```

### Task 5: Implement cache, staleness, fallback, and refresh isolation with TDD

**Files:**
- Create: `tools/a-share-market-dashboard/tests/data-service.test.mjs`
- Create: `tools/a-share-market-dashboard/src/data-service.mjs`

- [ ] **Step 1: Write failing cache and fallback tests**

Tests use an in-memory storage object and deterministic clock:

```js
test('a successful provider stores source and timestamps', async () => {
  const result = await loadDomain({ id: 'position', providers: [{ name: 'primary', load: async () => ({ ok: true }) }], storage, now: () => 1000, maxAgeMs: 500 });
  assert.equal(result.status, 'latest');
  assert.equal(result.source, 'primary');
  assert.deepEqual(JSON.parse(storage.getItem('a-share-dashboard:position')).data, { ok: true });
});

test('provider failure returns a non-expired snapshot', async () => {
  storage.setItem('a-share-dashboard:position', JSON.stringify({ data: { cached: true }, source: 'old', savedAt: 900, dataAt: 900 }));
  const result = await loadDomain({ id: 'position', providers: [{ name: 'primary', load: async () => { throw new Error('offline'); } }], storage, now: () => 1000, maxAgeMs: 500 });
  assert.equal(result.status, 'snapshot');
  assert.deepEqual(result.data, { cached: true });
});

test('an expired snapshot is marked expired instead of current', async () => {
  storage.setItem('a-share-dashboard:position', JSON.stringify({ data: {}, source: 'old', savedAt: 1, dataAt: 1 }));
  const result = await loadDomain({ id: 'position', providers: [], storage, now: () => 1000, maxAgeMs: 500 });
  assert.equal(result.status, 'expired');
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because `loadDomain` is missing.

- [ ] **Step 3: Implement deterministic envelopes and example data**

`loadDomain` returns `{ id, data, source, dataAt, fetchedAt, status, errors }`. A provider result is stored only after its `validate` callback passes. Provider failures are collected without preventing other domains from refreshing.

Add `EXAMPLE_SNAPSHOT` containing at least 2,750 generated daily points for each index, five years of daily TTM PE/forward PE/bond values, turnover history, margin history, and current breadth. Generate the arrays at runtime from compact deterministic seeds so the HTML stays small. Example state must have `mode: 'example'` and must never be written to the live cache.

- [ ] **Step 4: Run and verify GREEN**

Expected: cache tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tools/a-share-market-dashboard/src/data-service.mjs tools/a-share-market-dashboard/tests/data-service.test.mjs
git commit -m "feat: add auditable cache and offline fallback"
```

### Task 6: Build the fixed-sidebar dashboard UI

**Files:**
- Create: `tools/a-share-market-dashboard/src/index.html`
- Create: `tools/a-share-market-dashboard/src/styles.css`
- Create: `tools/a-share-market-dashboard/src/app.mjs`

- [ ] **Step 1: Add failing artifact-shell assertions**

Create `tests/build.test.mjs` that initially reads `src/index.html` and asserts the presence of semantic targets:

```js
assert.match(html, /id="market-summary"/);
assert.match(html, /id="window-controls"/);
assert.match(html, /id="layer-scores"/);
assert.match(html, /id="metric-list"/);
assert.match(html, /id="audit-view"/);
assert.match(html, /id="example-mode"/);
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the shell is missing.

- [ ] **Step 3: Implement the semantic shell and responsive CSS**

The shell follows the approved order: fixed sidebar; conclusion and timestamp; score and coverage; 1/3/5/10-year controls; three layer summaries; metric rows with accessible percentile bars; rules; source audit. Sidebar navigation changes the visible section without page reload. At widths below 760px, sidebar becomes a top disclosure and all grids become one column.

CSS must use system fonts, no external assets, `position: sticky` for desktop navigation, visible keyboard focus, text labels alongside every color encoding, and print rules that expand all sections.

- [ ] **Step 4: Implement state rendering in `app.mjs`**

`app.mjs` must:

- initialize immediately from live cache or `EXAMPLE_SNAPSHOT`;
- run independent refresh promises with `Promise.allSettled`;
- recompute all position and composite outputs when the window changes;
- show original weight, effective weight, contribution, formula, source, data date, fetch time, window, and status for each metric;
- suppress the action conclusion below 70% coverage;
- schedule 60-second quote refresh and 5-minute breadth refresh only during A-share trading sessions;
- provide explicit “刷新数据” and “示例数据模式” controls.

- [ ] **Step 5: Run tests and verify GREEN**

Expected: shell assertions and all prior tests pass.

- [ ] **Step 6: Commit**

```powershell
git add tools/a-share-market-dashboard/src tools/a-share-market-dashboard/tests/build.test.mjs
git commit -m "feat: add fixed-sidebar A-share dashboard UI"
```

### Task 7: Build and verify the single-file artifact

**Files:**
- Create: `tools/a-share-market-dashboard/scripts/build.mjs`
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs`
- Create: `tools/a-share-market-dashboard/a-share-market-dashboard.html`

- [ ] **Step 1: Add failing single-file contract tests**

```js
test('built artifact is self-contained and directly openable', () => {
  const output = readFileSync(artifactPath, 'utf8');
  assert.match(output, /^<!doctype html>/i);
  assert.doesNotMatch(output, /<script[^>]+src=/i);
  assert.doesNotMatch(output, /<link[^>]+href=/i);
  assert.doesNotMatch(output, /from\s+['"]\.\//);
  assert.match(output, /A股温度计/);
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the artifact and build script are absent.

- [ ] **Step 3: Implement deterministic bundling**

`build.mjs` reads `index.html`, `styles.css`, and modules in dependency order. It removes only top-level `import` lines and `export` keywords, concatenates modules into one `<script type="module">`, injects CSS into `<style>`, writes UTF-8, then validates that no local runtime imports remain.

- [ ] **Step 4: Build and run all tests**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/build.mjs
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
```

Expected: artifact created, all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tools/a-share-market-dashboard/scripts/build.mjs tools/a-share-market-dashboard/tests/build.test.mjs tools/a-share-market-dashboard/a-share-market-dashboard.html
git commit -m "build: produce standalone A-share dashboard artifact"
```

### Task 8: Document, render, and complete requirement-level verification

**Files:**
- Create: `tools/a-share-market-dashboard/README.md`
- Modify: `log.md`

- [ ] **Step 1: Write the README**

Document direct opening, live/example state, data source priority, refresh cadence, exact formulas, all weights, coverage gate, cache statuses, known public-interface limitations, and how to clear the cache. Explicitly state that the score describes historical cheapness/expensiveness and does not predict tomorrow's return.

- [ ] **Step 2: Append the repository log entry**

Record the tool path, implementation scope, source boundaries, tests, browser verification, and any data domains that remain best-effort because public browser access failed. Do not update `index.md` because the tool is not a formal Wiki page.

- [ ] **Step 3: Run fresh automated verification**

Run the build, all new Node tests, existing 44 risk-dashboard tests, `git diff --check`, and a mojibake scan against all new Chinese files. Expected: all exit 0, 0 failures, no replacement characters.

- [ ] **Step 4: Inspect the artifact in a real browser**

Open the built HTML through the in-app browser or a local static preview. Verify the initial example render, all six navigation targets, 1/3/5/10-year recalculation, refresh status, example-mode toggle, audit expansion, narrow viewport, and browser console. Record screenshots only as verification evidence; do not add them unless useful.

- [ ] **Step 5: Audit every approved requirement**

Create a checklist from the design specification sections 2, 5–12. For each item, cite either an automated test, rendered behavior, or an exact artifact element. Treat any unverified data source as incomplete and either fix it or describe the precise degraded state in the UI and README before completion.

- [ ] **Step 6: Commit documentation and log**

```powershell
git add tools/a-share-market-dashboard/README.md log.md
git commit -m "docs: document A-share valuation dashboard"
```

- [ ] **Step 7: Use `superpowers:finishing-a-development-branch`**

After fresh verification, follow the branch-finishing skill. Because the user requested completion without further routine confirmations, choose the safest non-destructive integration option that preserves the main worktree and report the resulting branch/commit/artifact paths.
