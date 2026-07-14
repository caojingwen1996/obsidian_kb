# 冰冰小美风险提示明细表实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在风险曲线下方增加一个按日期倒序展示日期、累计次数和风险原因的明细表。

**Architecture:** 继续使用现有 `/api/dashboard` 响应，不修改后端数据契约。HTML 提供语义化空表格骨架，`app.js` 负责安全地重建表格行并处理空状态和错误清理，`styles.css` 负责沿用黑底白框视觉与窄屏表格容器滚动。

**Tech Stack:** Flask、原生 HTML/CSS/JavaScript、pytest、ECharts

---

### Task 1: 明细表语义结构

**Files:**
- Modify: `tools/bbxm-risk-dashboard/tests/test_app.py`
- Modify: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/index.html`

- [ ] **Step 1: 写失败测试**

在 `test_app.py` 新增：

```python
def test_root_contains_risk_detail_table(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    html = app.test_client().get("/").get_data(as_text=True)

    assert 'class="risk-detail-panel"' in html
    assert '<caption>风险提示明细</caption>' in html
    assert 'id="risk-table-body"' in html
    assert '<th scope="col">日期</th>' in html
    assert '<th scope="col">当日累计风险提示次数</th>' in html
    assert '<th scope="col">风险原因</th>' in html
```

- [ ] **Step 2: 确认测试按预期失败**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests/test_app.py::test_root_contains_risk_detail_table -v`

Expected: FAIL，页面尚无 `risk-detail-panel`。

- [ ] **Step 3: 写最小 HTML 骨架**

在图例之后、`chart-panel` 结束标签之前加入：

```html
<section class="risk-detail-panel" aria-labelledby="risk-detail-title">
  <h2 id="risk-detail-title">风险提示明细</h2>
  <div class="risk-table-scroll" tabindex="0" aria-label="风险提示明细表滚动区域">
    <table class="risk-table">
      <caption>风险提示明细</caption>
      <thead>
        <tr>
          <th scope="col">日期</th>
          <th scope="col">当日累计风险提示次数</th>
          <th scope="col">风险原因</th>
        </tr>
      </thead>
      <tbody id="risk-table-body"></tbody>
    </table>
  </div>
</section>
```

- [ ] **Step 4: 运行结构测试**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests/test_app.py::test_root_contains_risk_detail_table -v`

Expected: PASS。

### Task 2: 倒序渲染、空状态和错误清理

**Files:**
- Modify: `tools/bbxm-risk-dashboard/tests/test_app.py`
- Modify: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/app.js`

- [ ] **Step 1: 写失败测试**

新增静态行为契约测试，确认脚本包含独立渲染函数、不修改原数组、按 `risk_date` 倒序、使用 `textContent`、提供缺失原因回退，并在成功和失败路径调用：

```python
def test_risk_table_script_sorts_renders_and_clears_rows(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    javascript = app.test_client().get("/static/app.js").get_data(as_text=True)

    assert "function renderRiskTable(points)" in javascript
    assert "[...points].sort" in javascript
    assert "right.risk_date.localeCompare(left.risk_date)" in javascript
    assert "riskTableBody.replaceChildren()" in javascript
    assert "cell.textContent" in javascript
    assert "point.reason || '未填写原因'" in javascript
    assert "renderRiskTable(payload.risk_points)" in javascript
    assert "renderRiskTable([])" in javascript
```

- [ ] **Step 2: 确认测试按预期失败**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests/test_app.py::test_risk_table_script_sorts_renders_and_clears_rows -v`

Expected: FAIL，`renderRiskTable` 尚不存在。

- [ ] **Step 3: 实现最小渲染逻辑**

在 DOM 引用区域增加：

```javascript
const riskTableBody = document.getElementById('risk-table-body');
```

新增渲染函数：

```javascript
function renderRiskTable(points) {
  riskTableBody.replaceChildren();
  if (!points.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.className = 'risk-table-empty';
    cell.textContent = '暂无风险提示记录';
    row.appendChild(cell);
    riskTableBody.appendChild(row);
    return;
  }

  [...points]
    .sort((left, right) => right.risk_date.localeCompare(left.risk_date))
    .forEach((point) => {
      const row = document.createElement('tr');
      [point.risk_date, point.count, point.reason || '未填写原因'].forEach(
        (value, index) => {
          const cell = document.createElement('td');
          cell.textContent = String(value);
          if (index === 1) cell.className = 'risk-count';
          row.appendChild(cell);
        },
      );
      riskTableBody.appendChild(row);
    });
}
```

在 `showError()` 清理图表后调用 `renderRiskTable([])`；在 `loadDashboard()` 成功设置图表后调用 `renderRiskTable(payload.risk_points)`。

- [ ] **Step 4: 运行行为契约测试**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests/test_app.py::test_risk_table_script_sorts_renders_and_clears_rows -v`

Expected: PASS。

### Task 3: 黑底白框和窄屏样式

**Files:**
- Modify: `tools/bbxm-risk-dashboard/tests/test_app.py`
- Modify: `tools/bbxm-risk-dashboard/bbxm_dashboard/static/styles.css`

- [ ] **Step 1: 写失败测试**

新增样式契约测试：

```python
def test_risk_table_styles_preserve_dark_responsive_layout(tmp_path):
    app = create_app({"TESTING": True, "DATA_DIR": tmp_path})
    css = app.test_client().get("/static/styles.css").get_data(as_text=True)

    assert ".risk-detail-panel" in css
    assert ".risk-table-scroll" in css
    assert "overflow-x: auto" in css
    assert ".risk-count" in css
    assert "font-variant-numeric: tabular-nums" in css
    assert "white-space: pre-wrap" in css
```

- [ ] **Step 2: 确认测试按预期失败**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests/test_app.py::test_risk_table_styles_preserve_dark_responsive_layout -v`

Expected: FAIL，表格样式尚不存在。

- [ ] **Step 3: 实现最小 CSS**

添加表格区上边框和间距、100% 宽表格、灰色表头、行分隔线、红色次数、原因换行和空状态居中；核心声明为：

```css
.risk-detail-panel { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px; }
.risk-table-scroll { max-width: 100%; overflow-x: auto; }
.risk-table { width: 100%; min-width: 620px; border-collapse: collapse; }
.risk-table th, .risk-table td { border: 1px solid var(--grid); padding: 10px 12px; text-align: left; }
.risk-table th { background: #15181c; color: var(--text); }
.risk-table td:first-child, .risk-count { font-variant-numeric: tabular-nums; }
.risk-count { color: var(--risk); font-weight: 700; }
.risk-table td:last-child { white-space: pre-wrap; line-height: 1.6; }
.risk-table tbody tr:hover { background: #111418; }
.risk-table-empty { color: var(--muted); text-align: center !important; }
```

- [ ] **Step 4: 运行样式测试和全量测试**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests -v`

Expected: 20 项测试全部通过。

### Task 4: 浏览器验收与维护记录

**Files:**
- Modify: `log.md`

- [ ] **Step 1: 启动并检查桌面布局**

运行工具，在桌面宽度确认明细表位于曲线下方、按日期倒序、三列内容完整、右侧为空。

- [ ] **Step 2: 检查窄屏和错误边界**

在 720px 和 375px 宽度确认页面无整体横向溢出，表格容器可横向滚动；触发错误状态后确认旧行被清空并显示空状态。

- [ ] **Step 3: 更新维护日志**

在 `log.md` 追加 2026-07-14 `tool / dashboard` 条目，列出 `index.html`、`styles.css`、`app.js`、测试和设计/计划文档，说明新增倒序风险明细表且右侧保持空白。

- [ ] **Step 4: 最终验证**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests -v`

Run: `python -m compileall bbxm_dashboard run.py`

Run: `git diff --check`

Expected: 20 项测试通过、编译检查通过、无空白错误。
