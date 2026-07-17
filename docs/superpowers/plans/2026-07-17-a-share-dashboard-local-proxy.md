# A 股大盘面板本地代理修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用无第三方依赖的本地同源代理修复单文件面板在浏览器中访问东方财富和中证指数接口时的 CORS、JSONP 与响应校验失败。

**Architecture:** Python 标准库服务仅绑定 `127.0.0.1`，静态提供成品 HTML，并把五类固定 `/api` 路由映射到经过白名单校验的上游地址。前端在 `localhost` 环境下自动使用同源 Fetch，其他环境保留现有 JSONP、缓存和示例降级；评分规则与权重不变。

**Tech Stack:** Python 3.11 标准库、Node.js ESM、`node:test`、Python `unittest`、原生 HTML/CSS/JavaScript。

---

## 文件结构

- 新建 `tools/a-share-market-dashboard/scripts/local_proxy.py`：路由白名单、上游请求、静态服务和浏览器启动。
- 新建 `tools/a-share-market-dashboard/启动A股大盘面板.cmd`：发现 Python 并运行本地服务。
- 新建 `tools/a-share-market-dashboard/tests/test_local_proxy.py`：Python 代理单元与本地 HTTP 集成测试。
- 修改 `tools/a-share-market-dashboard/src/adapters.mjs`：本地代理检测、URL 构造和传输切换。
- 修改 `tools/a-share-market-dashboard/src/data-service.mjs`：审计来源标记本地代理。
- 修改 `tools/a-share-market-dashboard/src/app.mjs`：`file://` 启动提示。
- 修改 `tools/a-share-market-dashboard/tests/adapters.test.mjs`、`tests/data-service.test.mjs`、`tests/build.test.mjs`：前端回归测试。
- 修改 `tools/a-share-market-dashboard/README.md`、`log.md`：启动方式、失败边界和维护记录。
- 重建 `tools/a-share-market-dashboard/a-share-market-dashboard.html`。

### Task 1: 固定上游路由和输入校验

**Files:**
- Create: `tools/a-share-market-dashboard/tests/test_local_proxy.py`
- Create: `tools/a-share-market-dashboard/scripts/local_proxy.py`

- [ ] **Step 1: 写路由构造失败测试**

```python
class RouteTests(unittest.TestCase):
    def test_builds_only_allowlisted_index_history_url(self):
        url = build_upstream_url('/api/eastmoney-kline', {'secid': ['1.000300'], 'limit': ['3000']})
        self.assertEqual(urlparse(url).hostname, 'push2his.eastmoney.com')
        self.assertEqual(parse_qs(urlparse(url).query)['secid'], ['1.000300'])

    def test_rejects_unknown_route_and_invalid_index(self):
        with self.assertRaises(RouteError):
            build_upstream_url('/api/unknown', {})
        with self.assertRaises(RouteError):
            build_upstream_url('/api/eastmoney-kline', {'secid': ['https://example.com']})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `python -m unittest tests/test_local_proxy.py -v`

Expected: FAIL，因为 `scripts.local_proxy` 尚不存在。

- [ ] **Step 3: 实现最小白名单路由**

```python
ALLOWED_SECIDS = {'1.000001', '1.000300', '1.000985'}
ALLOWED_INDEX_CODES = {'000300', '000985'}

def build_upstream_url(path, query):
    if path == '/api/eastmoney-kline':
        secid = one(query, 'secid')
        if secid not in ALLOWED_SECIDS:
            raise RouteError('invalid secid')
        limit = bounded_int(one(query, 'limit', '3000'), 250, 4000)
        return build_url('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
            'secid': secid,
            'klt': '101',
            'fqt': '1',
            'lmt': str(limit),
            'fields1': 'f1,f2,f3,f4,f5,f6',
            'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        })
    if path == '/api/csindex-performance':
        index_code = one(query, 'indexCode')
        if index_code not in ALLOWED_INDEX_CODES:
            raise RouteError('invalid indexCode')
        start_date = date8(one(query, 'startDate'))
        end_date = date8(one(query, 'endDate'))
        return build_url('https://www.csindex.com.cn/csindex-home/perf/index-perf', {
            'indexCode': index_code,
            'startDate': start_date,
            'endDate': end_date,
        })
    if path == '/api/treasury':
        return build_url('https://datacenter.eastmoney.com/api/data/get', TREASURY_PARAMS)
    if path == '/api/market':
        return build_url('https://push2.eastmoney.com/api/qt/clist/get', MARKET_PARAMS)
    if path == '/api/margin':
        market = one(query, 'market')
        if market not in {'1', '2'}:
            raise RouteError('invalid market')
        return f'https://cdn.jin10.com/data_center/reports/fs_{market}.json'
    raise RouteError('unknown route')
```

- [ ] **Step 4: 运行 Python 测试并确认 GREEN**

Run: `python -m unittest tests/test_local_proxy.py -v`

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add tools/a-share-market-dashboard/scripts/local_proxy.py tools/a-share-market-dashboard/tests/test_local_proxy.py
git commit -m "feat: add allowlisted A-share data proxy routes"
```

### Task 2: 本地 HTTP 服务、上游错误处理和启动器

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/test_local_proxy.py`
- Modify: `tools/a-share-market-dashboard/scripts/local_proxy.py`
- Create: `tools/a-share-market-dashboard/启动A股大盘面板.cmd`

- [ ] **Step 1: 写 HTTP 服务失败测试**

```python
class ServerTests(unittest.TestCase):
    def test_health_and_dashboard_are_served_without_exposing_other_files(self):
        with running_server(fake_fetch) as base:
            self.assertEqual(read_json(f'{base}/health'), {'ok': True})
            self.assertIn('A股温度计', read_text(f'{base}/'))
            with self.assertRaises(HTTPError) as missing:
                urlopen(f'{base}/../../AGENTS.md')
            self.assertEqual(missing.exception.code, 404)

    def test_api_returns_normalized_json_and_safe_upstream_error(self):
        with running_server(fake_fetch) as base:
            payload = read_json(f'{base}/api/eastmoney-kline?secid=1.000300&limit=3000')
            self.assertEqual(payload['data']['klines'][0].split(',')[0], '2026-07-17')
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `python -m unittest tests/test_local_proxy.py -v`

Expected: FAIL，因为服务工厂、健康检查和静态页面尚未实现。

- [ ] **Step 3: 实现本地服务**

实现以下边界：

```python
def create_server(host='127.0.0.1', port=0, fetcher=fetch_upstream):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == '/health':
                return self.send_json(200, {'ok': True})
            if parsed.path in {'/', '/a-share-market-dashboard.html'}:
                return self.send_dashboard()
            if parsed.path.startswith('/api/'):
                return self.send_proxy(parsed, fetcher)
            return self.send_json(404, {'error': 'not found'})
    return ThreadingHTTPServer((host, port), Handler)
```

`fetch_upstream` 必须使用 12 秒超时、固定请求头和 25 MB 上限；JSONP 响应用首尾回调包装检测后解包为 JSON。中证接口异常映射为 `{ "error": "upstream request failed", "source": "csindex-performance" }`，其他路由使用各自固定来源名。

- [ ] **Step 4: 新增双击启动器**

```bat
@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if not errorlevel 1 python scripts\local_proxy.py & goto :eof
where py >nul 2>nul
if not errorlevel 1 py -3 scripts\local_proxy.py & goto :eof
echo 未找到 Python 3，请先安装 Python 3。
pause
```

Python 主入口绑定随机可用端口，打印本地地址，调用 `webbrowser.open(url)` 后 `serve_forever()`，按 Ctrl+C 安全退出。

- [ ] **Step 5: 运行 Python 测试并确认 GREEN**

Run: `python -m unittest tests/test_local_proxy.py -v`

Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```powershell
git add tools/a-share-market-dashboard/scripts/local_proxy.py tools/a-share-market-dashboard/tests/test_local_proxy.py tools/a-share-market-dashboard/启动A股大盘面板.cmd
git commit -m "feat: serve dashboard through local data proxy"
```

### Task 3: 前端自动切换同源代理

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/adapters.test.mjs`
- Modify: `tools/a-share-market-dashboard/src/adapters.mjs`

- [ ] **Step 1: 写本地代理检测和 URL 失败测试**

```javascript
test('localhost dashboard uses same-origin proxy URLs', () => {
  const location = { protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:8765' };
  assert.equal(isLocalProxyLocation(location), true);
  assert.equal(
    buildLocalProxyUrl('/api/eastmoney-kline', { secid: '1.000300', limit: 3000 }, location),
    'http://127.0.0.1:8765/api/eastmoney-kline?secid=1.000300&limit=3000',
  );
});

test('file dashboard retains public transports', () => {
  assert.equal(isLocalProxyLocation({ protocol: 'file:', hostname: '', origin: 'null' }), false);
});
```

- [ ] **Step 2: 运行 Node 测试并确认 RED**

Run: `node --test tests/adapters.test.mjs`

Expected: FAIL，因为两个导出函数尚不存在。

- [ ] **Step 3: 实现检测、构造和传输切换**

```javascript
export function isLocalProxyLocation(location = globalThis.location) {
  return location?.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(location.hostname);
}

export function buildLocalProxyUrl(path, params = {}, location = globalThis.location) {
  if (!isLocalProxyLocation(location)) throw new Error('local proxy is unavailable');
  const url = new URL(path, location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}
```

五个加载器在本地代理环境分别使用 `fetchJson(buildLocalProxyUrl('/api/eastmoney-kline', params))`、`/api/csindex-performance`、`/api/treasury`、`/api/market` 和 `/api/margin`，否则保持现有 JSONP 或直接 Fetch。解析器不复制、不改评分口径。

- [ ] **Step 4: 运行 Node 测试并确认 GREEN**

Run: `node --test tests/adapters.test.mjs`

Expected: PASS。

- [ ] **Step 5: 运行全部 Node 测试**

Run: `node --test tests/*.test.mjs`

Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```powershell
git add tools/a-share-market-dashboard/src/adapters.mjs tools/a-share-market-dashboard/tests/adapters.test.mjs
git commit -m "fix: route dashboard data through local proxy"
```

### Task 4: 审计标记、启动提示和构建契约

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/data-service.test.mjs`
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs`
- Modify: `tools/a-share-market-dashboard/src/data-service.mjs`
- Modify: `tools/a-share-market-dashboard/src/app.mjs`

- [ ] **Step 1: 写失败测试**

```javascript
test('live definitions identify local proxy sources', () => {
  const definitions = createDefaultDomainDefinitions(new Date('2026-07-17T00:00:00Z'), {
    protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:8765',
  });
  assert.match(definitions[0].providers[0].name, /本地代理/);
});

test('built artifact explains that the launcher is required for stable live data', () => {
  assert.match(output, /启动A股大盘面板\.cmd/);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node --test tests/data-service.test.mjs tests/build.test.mjs`

Expected: FAIL，因为来源标记和提示尚不存在。

- [ ] **Step 3: 实现来源和提示**

`createDefaultDomainDefinitions(nowDate, location)` 根据 `isLocalProxyLocation(location)` 为来源名称追加 `（本地代理）`。`startApp()` 在 `file://` 下显示“稳定联网请双击启动A股大盘面板.cmd”，但不阻止现有刷新和示例模式。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `node --test tests/data-service.test.mjs tests/build.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add tools/a-share-market-dashboard/src/data-service.mjs tools/a-share-market-dashboard/src/app.mjs tools/a-share-market-dashboard/tests/data-service.test.mjs tools/a-share-market-dashboard/tests/build.test.mjs
git commit -m "feat: expose local proxy status in dashboard audit"
```

### Task 5: 文档、构建与端到端验证

**Files:**
- Modify: `tools/a-share-market-dashboard/README.md`
- Modify: `tools/a-share-market-dashboard/a-share-market-dashboard.html`
- Modify: `log.md`

- [ ] **Step 1: 更新使用说明和维护日志**

README 首屏改为推荐双击 `启动A股大盘面板.cmd`；解释直接打开 HTML、代理模式、Python 3 要求、关闭服务和第三方失败边界。`log.md` 追加 `repair / local-proxy / test` 条目，不修改 `index.md`。

- [ ] **Step 2: 重新构建单文件**

Run: `node scripts/build.mjs`

Expected: 成功生成小于 2 MB 的 `a-share-market-dashboard.html`。

- [ ] **Step 3: 运行本地 HTTP 集成检查**

Run: `python -m unittest tests/test_local_proxy.py -v`

Expected: 健康检查、静态面板、固定 API 和安全错误测试全部 PASS。

- [ ] **Step 4: 运行全部面板测试**

Run: `node --test tests/*.test.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: 运行既有风险面板回归**

Run: `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; python -m pytest tests -q`

Workdir: `tools/bbxm-risk-dashboard`

Expected: 44 项测试全部 PASS。

- [ ] **Step 6: 执行静态检查**

Run: `git diff --check`

Run: `rg -n "�|鍐|鐭|鎯|灏" tools/a-share-market-dashboard docs/superpowers/specs/2026-07-17-a-share-dashboard-local-proxy-design.md docs/superpowers/plans/2026-07-17-a-share-dashboard-local-proxy.md`

Expected: `git diff --check` 无错误，乱码扫描无匹配。

- [ ] **Step 7: 提交**

```powershell
git add tools/a-share-market-dashboard/README.md tools/a-share-market-dashboard/a-share-market-dashboard.html log.md docs/superpowers/plans/2026-07-17-a-share-dashboard-local-proxy.md
git commit -m "docs: ship local proxy dashboard launcher"
```

### Task 6: 合并收尾

**Files:**
- No new files.

- [ ] **Step 1: 检查分支状态和提交范围**

Run: `git status --short`

Run: `git diff --name-status main...HEAD`

Expected: 工作区干净，差异只包含本计划列出的文件。

- [ ] **Step 2: 按 finishing-a-development-branch 规范合并到 main**

合并前确认主工作区现有未提交改动不与本任务文件重叠；若 README 或 `log.md` 已被其他任务修改，手工保留双方内容。合并后再次运行 Python 与 Node 测试。

- [ ] **Step 3: 清理隔离工作区和功能分支**

仅在合并和合并后验证成功时删除本任务 worktree 和已合并分支。
