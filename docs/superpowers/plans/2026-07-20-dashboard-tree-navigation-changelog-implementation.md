# 看板树形导航与更新日志实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将看板左侧改为“温度计 / 产业 / 更新日志”一级树形导航，并新增由独立数据文件驱动的更新日志页面。

**Architecture:** 保留现有单文件构建方式；`src/changelog.json` 只负责日志数据，`build.mjs` 负责校验、分组和 HTML 转义，`index.html` 负责树形导航与日志页面骨架，`app.mjs` 负责互斥展开和视图状态。现有温度计与产业功能继续复用原页面和事件处理逻辑。

**Tech Stack:** HTML、CSS、原生 JavaScript ES modules、Node.js 构建与测试、Python 本地代理测试。

---

## 文件职责

- Create: `tools/a-share-market-dashboard/src/changelog.json` — 看板专用更新日志数据。
- Modify: `tools/a-share-market-dashboard/src/index.html` — 树形侧栏和更新日志页面骨架。
- Modify: `tools/a-share-market-dashboard/src/styles.css` — 树形导航、日志时间线和移动端样式。
- Modify: `tools/a-share-market-dashboard/src/app.mjs` — 一级树节点切换、互斥展开和页面状态恢复。
- Modify: `tools/a-share-market-dashboard/scripts/build.mjs` — 读取、校验并渲染日志数据。
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs` — 结构、数据渲染和单文件产物回归。
- Modify: `tools/a-share-market-dashboard/tests/data-service.test.mjs` — 复用现有 Node 测试入口验证导航纯逻辑（若实现放在 `app.mjs`，测试直接从该模块导入）。
- Modify: `tools/a-share-market-dashboard/README.md` — 说明树形导航和日志维护方式。
- Modify: `log.md` — 记录本次看板变更。

### Task 1: 建立树形导航与日志页面失败测试

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: 写入结构失败测试**

新增断言，要求源码模板包含：

```js
for (const treeId of ['tree-thermometer', 'tree-industry']) {
  assert.match(html, new RegExp(`id="${treeId}"`));
}
for (const domain of ['thermometer', 'industry', 'changelog']) {
  assert.match(html, new RegExp(`data-tree-domain="${domain}"`));
}
assert.match(html, /id="changelog-view"/);
assert.doesNotMatch(html, /class="shell-switcher"/);
```

- [ ] **Step 2: 写入日志内容失败测试**

对构建产物要求：

```js
for (const title of [
  '产业研报改为目录自动加载',
  '修复本地服务器无法打开产业研报',
  '产业研报链接改为在新标签页打开',
]) {
  assert.match(output, new RegExp(title));
}
assert.doesNotMatch(output, /<!-- CHANGELOG_ENTRIES -->/);
```

- [ ] **Step 3: 运行失败测试**

Run:

```powershell
node --test tools/a-share-market-dashboard/tests/build.test.mjs
```

Expected: FAIL，缺少 `data-tree-domain`、`changelog-view` 或日志标题。

### Task 2: 新增日志数据与构建渲染

**Files:**
- Create: `tools/a-share-market-dashboard/src/changelog.json`
- Modify: `tools/a-share-market-dashboard/scripts/build.mjs`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: 新增三条首批日志数据**

数据文件采用数组：

```json
[
  {
    "date": "2026-07-20",
    "weekday": "星期一",
    "time": "",
    "type": "更新",
    "title": "产业研报链接改为在新标签页打开",
    "summary": "点击顶部产业报告或普通研报标题时，将在新标签页打开，当前看板保持不动。",
    "details": ["全部研报链接统一应用", "增加安全的新窗口隔离属性"]
  },
  {
    "date": "2026-07-20",
    "weekday": "星期一",
    "time": "",
    "type": "修复",
    "title": "修复本地服务器无法打开产业研报",
    "summary": "本地启动器现在可以安全读取自动化目录中的 HTML 研报。",
    "details": ["非 HTML 文件继续禁止访问", "目录外路径继续禁止访问"]
  },
  {
    "date": "2026-07-20",
    "weekday": "星期一",
    "time": "",
    "type": "更新",
    "title": "产业研报改为目录自动加载",
    "summary": "一级目录自动生成产业标签，并递归加载下级 HTML 研报。",
    "details": ["完整分析报告进入顶部研报区", "普通报告进入日期信息流"]
  }
]
```

- [ ] **Step 2: 在构建脚本中读取并校验 JSON**

把 `changelog.json` 加入现有 `Promise.all` 读取流程，并实现：

```js
function validateChangelog(entries) {
  if (!Array.isArray(entries)) throw new Error('Changelog must be an array');
  const required = ['date', 'weekday', 'type', 'title', 'summary'];
  entries.forEach((entry, index) => {
    for (const field of required) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) {
        throw new Error(`Invalid changelog entry ${index}: ${field}`);
      }
    }
    if (entry.time != null && typeof entry.time !== 'string') throw new Error(`Invalid changelog entry ${index}: time`);
    if (entry.details != null && (!Array.isArray(entry.details) || entry.details.some(item => typeof item !== 'string'))) {
      throw new Error(`Invalid changelog entry ${index}: details`);
    }
  });
  return entries;
}
```

- [ ] **Step 3: 分组并转义渲染日志 HTML**

实现 `renderChangelog(entries)`：按日期降序分组，同日保持输入顺序；时间为空时不渲染空时间元素；所有字段通过现有 `escapeHtml()`。

- [ ] **Step 4: 替换日志占位符并运行构建测试**

Run:

```powershell
node tools/a-share-market-dashboard/scripts/build.mjs
node --test tools/a-share-market-dashboard/tests/build.test.mjs
```

Expected: 日志标题相关断言通过；树形结构断言仍失败。

### Task 3: 改造树形侧栏和日志页面模板

**Files:**
- Modify: `tools/a-share-market-dashboard/src/index.html`
- Modify: `tools/a-share-market-dashboard/src/styles.css`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: 用树形导航替换顶部切换器和双侧栏面板**

模板结构使用：

```html
<nav class="tree-nav" aria-label="主导航">
  <section class="tree-group is-expanded" data-tree-group="thermometer">
    <button class="tree-root" type="button" data-tree-domain="thermometer" aria-expanded="true" aria-controls="tree-thermometer">
      <span>温度计</span><span class="tree-chevron" aria-hidden="true"></span>
    </button>
    <div class="tree-children" id="tree-thermometer">…原温度计叶子节点…</div>
  </section>
  <section class="tree-group" data-tree-group="industry">
    <button class="tree-root" type="button" data-tree-domain="industry" aria-expanded="false" aria-controls="tree-industry">
      <span>产业</span><span class="tree-chevron" aria-hidden="true"></span>
    </button>
    <div class="tree-children" id="tree-industry" hidden>…原产业叶子节点…</div>
  </section>
  <button class="tree-root tree-leaf" type="button" data-tree-domain="changelog" data-view="changelog-view">更新日志</button>
</nav>
```

- [ ] **Step 2: 新增更新日志页面骨架**

```html
<section class="view changelog-view" id="changelog-view" data-shell-content="changelog" aria-labelledby="changelog-heading">
  <div class="changelog-page">
    <header class="changelog-hero">
      <p class="eyebrow">CHANGELOG</p>
      <h2 id="changelog-heading">更新日志</h2>
      <p>最近发生了什么——新功能、调整与修复，都写在这里。</p>
    </header>
    <!-- CHANGELOG_ENTRIES -->
  </div>
</section>
```

- [ ] **Step 3: 添加桌面树形导航与日志时间线样式**

使用现有 `--nav`、`--blue`、`--muted`、`--line`、`--paper` 变量；一级按钮最小高度 44px；展开箭头通过 CSS 旋转；日志内容最大宽度约 920px；条目采用 110px 时间栏与正文栏。

- [ ] **Step 4: 添加移动端样式**

在现有 `@media (max-width: 760px)` 中让日志条目变为单列，隐藏固定时间栏分隔线，正文不产生横向滚动。

- [ ] **Step 5: 构建并验证结构测试转绿**

Run:

```powershell
node tools/a-share-market-dashboard/scripts/build.mjs
node --test tools/a-share-market-dashboard/tests/build.test.mjs
```

Expected: PASS。

### Task 4: 实现互斥展开与状态恢复

**Files:**
- Modify: `tools/a-share-market-dashboard/src/app.mjs`
- Modify: `tools/a-share-market-dashboard/tests/data-service.test.mjs`

- [ ] **Step 1: 新增导航状态纯函数失败测试**

从 `app.mjs` 导入 `resolveTreeNavigation` 并验证：

```js
assert.deepEqual(
  resolveTreeNavigation({ thermometer: 'position-view', industry: 'industry-emerging' }, 'industry'),
  { domain: 'industry', viewId: 'industry-emerging' },
);
assert.deepEqual(
  resolveTreeNavigation({}, 'changelog'),
  { domain: 'changelog', viewId: 'changelog-view' },
);
assert.deepEqual(
  resolveTreeNavigation({}, 'unknown'),
  { domain: 'thermometer', viewId: 'market-summary' },
);
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
node --test tools/a-share-market-dashboard/tests/data-service.test.mjs
```

Expected: FAIL，`resolveTreeNavigation` 未导出。

- [ ] **Step 3: 实现纯状态解析函数**

```js
export function resolveTreeNavigation(activeViews, requestedDomain, requestedView = null) {
  const defaults = {
    thermometer: 'market-summary',
    industry: 'industry-strategy',
    changelog: 'changelog-view',
  };
  const domain = Object.hasOwn(defaults, requestedDomain) ? requestedDomain : 'thermometer';
  return { domain, viewId: requestedView ?? activeViews[domain] ?? defaults[domain] };
}
```

- [ ] **Step 4: 将 DOM 切换逻辑改为树形导航**

`setShell` 使用 `resolveTreeNavigation`，并同步：

```js
document.querySelectorAll('[data-tree-group]').forEach(group => {
  const expanded = group.dataset.treeGroup === domain;
  group.classList.toggle('is-expanded', expanded);
  group.querySelector('.tree-root')?.setAttribute('aria-expanded', String(expanded));
  const children = group.querySelector('.tree-children');
  if (children) children.hidden = !expanded;
});
```

日志域隐藏 `marketActions`、`notice` 和 `sidebarFooter`；温度计域恢复显示。移除 `.shell-switcher` 事件绑定。

- [ ] **Step 5: 运行导航与构建测试**

Run:

```powershell
node --test tools/a-share-market-dashboard/tests/data-service.test.mjs
node tools/a-share-market-dashboard/scripts/build.mjs
node --test tools/a-share-market-dashboard/tests/build.test.mjs
```

Expected: PASS。

### Task 5: 文档、全量回归与产物审计

**Files:**
- Modify: `tools/a-share-market-dashboard/README.md`
- Modify: `log.md`
- Regenerate: `tools/a-share-market-dashboard/a-share-market-dashboard.html`

- [ ] **Step 1: 更新 README**

说明左侧三个一级节点、互斥展开规则，以及编辑 `src/changelog.json` 后需要重新构建。

- [ ] **Step 2: 追加维护日志**

记录树形导航、日志页面、独立数据文件、测试和生成物。

- [ ] **Step 3: 重新构建并运行全部 Node 测试**

Run:

```powershell
node tools/a-share-market-dashboard/scripts/build.mjs
node --test tools/a-share-market-dashboard/tests/*.test.mjs
```

Expected: 全部通过，0 failure。

- [ ] **Step 4: 运行全部 Python 代理测试**

Run from `tools/a-share-market-dashboard`:

```powershell
python -B -m unittest discover -s tests -p test_local_proxy.py -v
```

Expected: 全部通过。

- [ ] **Step 5: 审计生成物**

检查：

```text
一级节点 = 温度计、产业、更新日志
shell-switcher = 0
CHANGELOG_ENTRIES 占位符 = 0
首批日志标题 = 3
产业研报链接 target="_blank" = 全部
乱码标记 = 0
```

- [ ] **Step 6: 检查任务范围差异**

Run:

```powershell
git diff --check -- tools/a-share-market-dashboard docs/superpowers log.md
git status --short
```

Expected: 任务文件无空白错误；用户原有未提交目录调整保持不变。

