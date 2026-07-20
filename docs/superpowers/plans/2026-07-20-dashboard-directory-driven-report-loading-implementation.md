# Dashboard Directory-Driven Report Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the A-share dashboard discover, classify, link, and filter industry HTML reports from the reorganized `sources/automations/{战略资源,新兴产业,支柱产业}/` directory tree without title-keyword mappings.

**Architecture:** Keep the three top-level industry pages fixed, but replace the four hard-coded report loaders with one generic recursive scanner. The scanner returns first-level directory tags, industry-level full reports, and ordinary feed reports; `build.mjs` renders all three into category-specific template placeholders.

**Tech Stack:** Node.js ES modules, `node:fs/promises`, static HTML templates, Node built-in test runner.

---

## File map

- Modify `tools/a-share-market-dashboard/tests/build.test.mjs`: define the new directory-driven behavior and old-path regressions.
- Modify `tools/a-share-market-dashboard/src/index.html`: replace static filter buttons and hard-coded industry boards with three sets of build placeholders.
- Modify `tools/a-share-market-dashboard/scripts/build.mjs`: recursively discover reports, derive first-level tags, render boards/cards, and replace the new placeholders.
- Modify `tools/a-share-market-dashboard/README.md`: document the directory contract used by the builder.
- Regenerate `tools/a-share-market-dashboard/a-share-market-dashboard.html`: checked-in standalone artifact.
- Modify `log.md`: record the dashboard automation behavior change.

No source automation files are moved or edited by this implementation.

---

### Task 1: Define the new directory-driven behavior in a failing build test

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: Replace old hard-coded tag expectations**

In `industry panels use Ice Ice Xiaomei three-industry classification`, keep the three category names and replace the old static child-tag list with the current first-level directories:

```js
for (const term of [
  '战略资源',
  '电解铝',
  '铜',
  '新兴产业',
  '商业航天',
  '机器人',
  '算力',
  '支柱产业',
  '电网',
]) {
  assert.match(html, new RegExp(term));
}

for (const staleTerm of [
  '黄金',
  '稀土',
  '锂',
  '集成电路',
  '生物医药',
  '低空经济',
  '新型储能',
  '成熟制造业龙头',
]) {
  assert.doesNotMatch(html, new RegExp(`data-filter="${staleTerm}"`));
}
```

- [ ] **Step 2: Replace old report-path assertions with new nested paths**

In `industry panels use the approved feed layout without the tracking card`, require these markers:

```js
for (const marker of [
  'data-filter="电解铝"',
  'data-filter="铜"',
  'data-filter="商业航天"',
  'data-filter="机器人"',
  'data-filter="算力"',
  'data-filter="电网"',
  '../../sources/automations/战略资源/电解铝/2026-07-15-1921-云铝股份机构级决策研报.html',
  '../../sources/automations/新兴产业/商业航天/商业航天产业完整分析报告.html',
  '../../sources/automations/新兴产业/算力/2026-07-20-算力产业完整分析报告.html',
  '../../sources/automations/支柱产业/电网/2026-07-17-十五五电网投资与电网行业完整分析报告.html',
  '../../sources/automations/支柱产业/2026-07-18-中国中车机构级决策研报.html',
  '来源目录：sources/automations/战略资源/电解铝',
  '来源目录：sources/automations/新兴产业/商业航天',
  '来源目录：sources/automations/支柱产业/电网',
]) {
  assert.match(html, new RegExp(marker));
}
```

Add structural assertions:

```js
assert.match(html, /<section class="industry-research-board" data-filters="商业航天">[\s\S]*商业航天产业完整分析报告/);
assert.match(html, /<section class="industry-research-board" data-filters="算力">[\s\S]*算力产业完整分析报告/);
assert.match(html, /<section class="industry-research-board" data-filters="电网">[\s\S]*十五五电网投资与电网行业完整分析报告/);
assert.match(html, /<article class="industry-report" data-filters="">[\s\S]*中国中车机构级决策研报/);
assert.doesNotMatch(html, /<article class="industry-report"[^>]*>[\s\S]*算力产业完整分析报告/);
assert.doesNotMatch(html, /sources\/automations\/(?:商业航天|电网产业)\//);
```

Require the new generic builder surface and reject the old loaders:

```js
const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
assert.match(buildSource, /scanIndustryReports/);
assert.match(buildSource, /renderFilterTabs/);
assert.match(buildSource, /renderResearchBoards/);
assert.doesNotMatch(buildSource, /commercialSpaceDir|electricGridDir|pillarFilters|strategicResourceFilters/);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tools/a-share-market-dashboard/tests/build.test.mjs
```

Expected: FAIL because the checked-in artifact still contains old root-level paths and the builder still contains `commercialSpaceDir`, `electricGridDir`, and keyword filter functions.

- [ ] **Step 4: Commit the failing test**

```powershell
git add -- tools/a-share-market-dashboard/tests/build.test.mjs
git commit -m "test: require directory-driven industry reports"
```

---

### Task 2: Replace static template tabs and boards with category placeholders

**Files:**
- Modify: `tools/a-share-market-dashboard/src/index.html`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: Replace each static filter-button list**

Keep the existing `<nav class="industry-filter-tabs">` elements, retain the `全部` button, and replace all other buttons with one category placeholder:

```html
<nav class="industry-filter-tabs" aria-label="战略资源细分方向">
  <button class="is-active" type="button" data-filter="all" aria-pressed="true">全部</button>
  <!-- STRATEGY_FILTER_TABS -->
</nav>
```

```html
<nav class="industry-filter-tabs" aria-label="新兴产业细分方向">
  <button class="is-active" type="button" data-filter="all" aria-pressed="true">全部</button>
  <!-- EMERGING_FILTER_TABS -->
</nav>
```

```html
<nav class="industry-filter-tabs" aria-label="支柱产业细分方向">
  <button class="is-active" type="button" data-filter="all" aria-pressed="true">全部</button>
  <!-- PILLAR_FILTER_TABS -->
</nav>
```

- [ ] **Step 2: Replace hard-coded research boards and old feed placeholders**

Use these placeholders inside the three workbenches:

```html
<!-- STRATEGY_RESEARCH_BOARDS -->
<!-- STRATEGY_REPORTS -->
```

```html
<!-- EMERGING_RESEARCH_BOARDS -->
<!-- EMERGING_REPORTS -->
```

```html
<!-- PILLAR_RESEARCH_BOARDS -->
<!-- PILLAR_REPORTS -->
```

Keep the existing count placeholders `STRATEGY_REPORT_COUNT`, `EMERGING_REPORT_COUNT`, and `PILLAR_REPORT_COUNT`. Remove `COMMERCIAL_SPACE_REPORTS` and `ELECTRIC_GRID_REPORTS`.

- [ ] **Step 3: Do not run the full test yet**

The template now contains new placeholders that the old builder cannot replace. This is an intentional intermediate RED state resolved in Task 3.

---

### Task 3: Implement generic recursive discovery and rendering

**Files:**
- Modify: `tools/a-share-market-dashboard/scripts/build.mjs`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: Replace old directory constants with category definitions**

Keep `repoRoot` and add:

```js
const automationsDir = join(repoRoot, 'sources', 'automations');
const industryDefinitions = [
  { key: 'STRATEGY', directoryName: '战略资源' },
  { key: 'EMERGING', directoryName: '新兴产业' },
  { key: 'PILLAR', directoryName: '支柱产业' },
];
```

Delete `strategicResourceDir`, `commercialSpaceDir`, `pillarDir`, and `electricGridDir`.

- [ ] **Step 2: Replace `readReportFilenames` with a recursive scanner**

Add these functions after `timeFromFilename`:

```js
async function walkHtmlFiles(directory, pathParts = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const nextParts = [...pathParts, entry.name];
    if (entry.isDirectory()) return walkHtmlFiles(join(directory, entry.name), nextParts);
    if (!entry.isFile() || !entry.name.toLocaleLowerCase('en-US').endsWith('.html')) return [];
    return [{
      filename: entry.name,
      relativePath: nextParts.join('/'),
      filter: pathParts[0] ?? '',
      sourceDirectory: pathParts.length ? pathParts.join('/') : '',
    }];
  }));
  return nested.flat();
}

async function scanIndustryReports(directoryName) {
  const directory = join(automationsDir, directoryName);
  const entries = await readdir(directory, { withFileTypes: true });
  const filters = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const files = (await walkHtmlFiles(directory))
    .sort((left, right) => right.relativePath.localeCompare(left.relativePath, 'zh-CN'));
  return {
    directoryName,
    filters,
    researchReports: files.filter(report => report.filename.includes('完整分析报告')),
    feedReports: files.filter(report => !report.filename.includes('完整分析报告')),
  };
}
```

The initial `readdir` intentionally throws when a required industry root is missing.

- [ ] **Step 3: Replace keyword-based render helpers**

Delete `pillarFilters`, `strategicResourceFilters`, `renderReports`, and the four category-specific render functions. Replace `renderReportCards` with record-based rendering:

```js
function reportHref(industry, report) {
  return `../../sources/automations/${industry.directoryName}/${report.relativePath}`;
}

function sourceDirectoryLabel(industry, report) {
  return report.sourceDirectory
    ? `${industry.directoryName}/${report.sourceDirectory}`
    : industry.directoryName;
}

function renderReportCards(industry) {
  return industry.feedReports.map(report => {
    const title = titleFromFilename(report.filename);
    const type = title.includes('资金面') ? '资金面' : '研报';
    const label = report.filter
      ? `${industry.directoryName} · ${report.filter}`
      : industry.directoryName;
    const tag = report.filter || industry.directoryName;
    return `              <article class="industry-report" data-filters="${escapeHtml(report.filter)}">
                <span class="industry-time">${escapeHtml(timeFromFilename(report.filename))}</span><span class="industry-dot"></span>
                <div class="industry-report-meta"><span>${escapeHtml(label)} <b>${escapeHtml(type)}</b></span><span>自动</span></div>
                <h3><a class="industry-report-link" href="${escapeHtml(reportHref(industry, report))}">${escapeHtml(title)}</a></h3>
                <p>从${escapeHtml(sourceDirectoryLabel(industry, report))}目录自动读取，点击标题打开对应 HTML 研报。</p>
                <div class="industry-tags">#${escapeHtml(tag)} #目录自动读取 #${escapeHtml(type)}</div>
                <div class="industry-reason">来源目录：sources/automations/${escapeHtml(sourceDirectoryLabel(industry, report))}</div>
              </article>`;
  }).join('\n');
}

function renderFilterTabs(industry) {
  return industry.filters.map(filter =>
    `            <button type="button" data-filter="${escapeHtml(filter)}" aria-pressed="false">${escapeHtml(filter)}</button>`
  ).join('\n');
}

function renderResearchBoards(industry) {
  return industry.researchReports.map(report => {
    const title = titleFromFilename(report.filename);
    const scope = report.filter
      ? `${industry.directoryName} / ${report.filter}`
      : industry.directoryName;
    return `          <section class="industry-research-board" data-filters="${escapeHtml(report.filter)}">
            <div><p class="eyebrow">产业研报</p><h3><a class="industry-report-link" href="${escapeHtml(reportHref(industry, report))}">${escapeHtml(title)}</a></h3></div>
            <span>${escapeHtml(scope)}</span>
          </section>`;
  }).join('\n');
}
```

- [ ] **Step 4: Scan and replace all three category outputs**

Replace the four old render calls with:

```js
const industries = await Promise.all(
  industryDefinitions.map(definition => scanIndustryReports(definition.directoryName))
);
```

After creating `output`, apply category placeholders in a loop before inserting styles and scripts:

```js
let output = template;
for (const [index, definition] of industryDefinitions.entries()) {
  const industry = industries[index];
  output = output
    .replace(`<!-- ${definition.key}_FILTER_TABS -->`, renderFilterTabs(industry))
    .replace(`<!-- ${definition.key}_RESEARCH_BOARDS -->`, renderResearchBoards(industry))
    .replace(`<!-- ${definition.key}_REPORTS -->`, renderReportCards(industry))
    .replace(`<!-- ${definition.key}_REPORT_COUNT -->`, String(industry.feedReports.length));
}
output = output
  .replace('<!-- DASHBOARD_STYLES -->', `<style>${styles.trim()}</style>`)
  .replace('<!-- DASHBOARD_SCRIPT -->', `<script type="module">${bundle}</script>`);
```

Keep the existing unresolved-placeholder and local-import validation after this block.

- [ ] **Step 5: Build the dashboard**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools/a-share-market-dashboard/scripts/build.mjs
```

Expected: `Built ...a-share-market-dashboard.html (...)` with exit code 0.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tools/a-share-market-dashboard/tests/build.test.mjs
```

Expected: every test in `build.test.mjs` passes. If exact report counts changed because the user added files during implementation, calculate expected counts from the current directories rather than restoring stale fixed counts.

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- tools/a-share-market-dashboard/src/index.html tools/a-share-market-dashboard/scripts/build.mjs tools/a-share-market-dashboard/tests/build.test.mjs tools/a-share-market-dashboard/a-share-market-dashboard.html
git commit -m "feat: load industry reports from directory tree"
```

---

### Task 4: Document and fully verify the behavior

**Files:**
- Modify: `tools/a-share-market-dashboard/README.md`
- Modify: `log.md`
- Verify: `tools/a-share-market-dashboard/a-share-market-dashboard.html`

- [ ] **Step 1: Add the directory contract to README**

Add a concise section stating:

```markdown
## 产业研报自动加载

构建脚本固定扫描 `sources/automations/战略资源/`、`新兴产业/` 和 `支柱产业/`。每个根目录的第一级子目录名直接生成筛选标签，目录内 HTML 会被递归加载；根目录直属 HTML 只在“全部”中显示。文件名包含“完整分析报告”的 HTML 显示在产业研报区域，其他 HTML 显示在日期信息流。新增或移动文件后运行 `npm run build` 重新生成看板，不需要维护公司名称或标题关键词映射。
```

- [ ] **Step 2: Append a focused maintenance log entry**

Append a `2026-07-20` entry to `log.md` listing only:

```markdown
### 操作类型

dashboard / automation / refactor

### 修改文件

- `tools/a-share-market-dashboard/scripts/build.mjs`
- `tools/a-share-market-dashboard/src/index.html`
- `tools/a-share-market-dashboard/tests/build.test.mjs`
- `tools/a-share-market-dashboard/README.md`
- `tools/a-share-market-dashboard/a-share-market-dashboard.html`
- `log.md`

### 操作说明

将产业研报自动加载从旧路径和标题关键词映射改为三类产业根目录下的纯目录驱动递归扫描。一级子目录直接生成筛选标签，完整分析报告进入产业研报区域，其余 HTML 进入日期信息流，根目录 HTML 仅在“全部”中显示。
```

- [ ] **Step 3: Run the complete dashboard test suite**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tools/a-share-market-dashboard/tests/*.test.mjs
```

Expected: all Node dashboard tests pass with zero failures.

- [ ] **Step 4: Run the Python proxy tests**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tools.a-share-market-dashboard.tests.test_local_proxy
```

If the dotted module path is not accepted because of the hyphenated directory, run the file directly:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools/a-share-market-dashboard/tests/test_local_proxy.py
```

Expected: all proxy tests pass.

- [ ] **Step 5: Validate the generated artifact**

Run a PowerShell check that fails on old links, unresolved placeholders, or encoding errors:

```powershell
$artifact = Get-Content -LiteralPath 'tools\a-share-market-dashboard\a-share-market-dashboard.html' -Raw -Encoding UTF8
if ($artifact -match '<!-- [A-Z_]+ -->') { throw 'unresolved build placeholder' }
if ($artifact -match 'sources/automations/(商业航天|电网产业)/') { throw 'stale automation path' }
if ($artifact.Contains([char]0xFFFD) -or $artifact -match '鍐|鐭|鎯|灏|[\uE000-\uF8FF]') { throw 'encoding error' }
foreach ($marker in @(
  'data-filter="电解铝"',
  'data-filter="铜"',
  'data-filter="商业航天"',
  'data-filter="机器人"',
  'data-filter="算力"',
  'data-filter="电网"',
  '算力产业完整分析报告'
)) {
  if (-not $artifact.Contains($marker)) { throw "missing marker: $marker" }
}
```

Expected: exit code 0 and no output.

- [ ] **Step 6: Check the scoped diff**

Run:

```powershell
git diff --check -- tools/a-share-market-dashboard log.md
git status --short -- tools/a-share-market-dashboard log.md
```

Expected: no whitespace errors; only current-task dashboard files and the intended `log.md` change are reported in this scope.

- [ ] **Step 7: Commit documentation and log**

```powershell
git add -- tools/a-share-market-dashboard/README.md log.md
git commit -m "docs: describe directory-driven report loading"
```
