# Dashboard Auto-Build Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `启动大盘面板.cmd` rebuild the directory-driven dashboard before starting the local server, and stop instead of serving a stale artifact when Node is missing or the build fails.

**Architecture:** Keep the existing batch launcher as the single entry point. Add a strict preflight that resolves Node from `PATH` or the Codex bundled runtime, runs `scripts\build.mjs`, and reaches the unchanged Python server branch only after a zero exit status. Protect the control-flow contract with a focused Node test that reads the launcher.

**Tech Stack:** Windows batch, Node.js 20+, `node:test`, existing JavaScript dashboard builder, Python local proxy.

---

### Task 1: Add a failing launcher contract test

**Files:**
- Modify: `tools/a-share-market-dashboard/tests/build.test.mjs`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: Add the launcher path and failing test**

Add beside the existing artifact paths:

```js
const launcherPath = join(here, '..', '启动大盘面板.cmd');
```

Add this test before the artifact tests:

```js
test('launcher rebuilds the dashboard before starting the local proxy', () => {
  const launcher = readFileSync(launcherPath, 'utf8');
  const buildIndex = launcher.indexOf('scripts\\build.mjs');
  const proxyIndex = launcher.indexOf('scripts\\local_proxy.py');

  assert.match(launcher, /where node/i);
  assert.match(launcher, /%USERPROFILE%\\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node\.exe/i);
  assert.ok(buildIndex >= 0, 'launcher must invoke the dashboard builder');
  assert.ok(proxyIndex > buildIndex, 'launcher must build before starting the proxy');
  assert.match(launcher, /if errorlevel 1 goto :build_failed/i);
  assert.match(launcher, /:build_failed[\s\S]*goto :eof/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test --test-name-pattern "launcher rebuilds" tests\build.test.mjs
```

Expected: FAIL because the current launcher contains neither Node resolution nor `scripts\build.mjs`.

### Task 2: Implement strict build-before-serve behavior

**Files:**
- Modify: `tools/a-share-market-dashboard/启动大盘面板.cmd`
- Test: `tools/a-share-market-dashboard/tests/build.test.mjs`

- [ ] **Step 1: Add Node resolution and the build gate**

Replace the launcher with:

```bat
@echo off
setlocal
cd /d "%~dp0"

set "DASHBOARD_NODE="
where node >nul 2>nul
if not errorlevel 1 set "DASHBOARD_NODE=node"

if not defined DASHBOARD_NODE (
  set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if exist "%CODEX_NODE%" set "DASHBOARD_NODE=%CODEX_NODE%"
)

if not defined DASHBOARD_NODE (
  echo 未找到 Node.js，无法重新构建大盘面板。
  pause
  goto :eof
)

echo 正在重新构建大盘面板...
"%DASHBOARD_NODE%" scripts\build.mjs
if errorlevel 1 goto :build_failed
echo 大盘面板构建完成。

where python >nul 2>nul
if not errorlevel 1 goto :python
where py >nul 2>nul
if not errorlevel 1 goto :py
echo 未找到 Python 3，请先安装 Python 3。
pause
goto :eof

:build_failed
echo 大盘面板构建失败，已停止启动，避免打开旧看板。
pause
goto :eof

:python
python scripts\local_proxy.py
goto :eof

:py
py -3 scripts\local_proxy.py
goto :eof
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run the same focused command from Task 1.

Expected: PASS.

- [ ] **Step 3: Run the full dashboard test suite**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests\*.test.mjs
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests -p test_local_proxy.py -v
```

Expected: all Node and Python tests pass.

### Task 3: Document and record the behavior change

**Files:**
- Modify: `tools/a-share-market-dashboard/README.md`
- Modify: `log.md`

- [ ] **Step 1: Update launcher documentation**

Change the launcher steps in README so the first step states that it resolves Node and rebuilds `a-share-market-dashboard.html`; add that a missing Node or failed build stops startup to prevent serving stale industry reports.

- [ ] **Step 2: Append a maintenance entry**

Add a `2026-07-20` `dashboard / launcher / rebuild` entry listing the launcher, test, README, generated artifact, plan, and log. Record that the launcher now builds before serving and stops on build failure.

### Task 4: Verify end-to-end behavior, commit, and push

**Files:**
- Verify: `tools/a-share-market-dashboard/启动大盘面板.cmd`
- Verify: `tools/a-share-market-dashboard/a-share-market-dashboard.html`
- Verify: `sources/automations/支柱产业/高端制造/2026-07-20-1737-徐工机械-机构级决策研报.html`

- [ ] **Step 1: Run a real build with the resolved Node executable**

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\build.mjs
```

Expected: exit 0 and the generated artifact contains `data-filters="高端制造"` and the 徐工机械 report link.

- [ ] **Step 2: Audit the diff**

Run `git status --short`, `git diff --check`, and a task-scoped `git diff`. Confirm no unrelated files are included in the new commit.

- [ ] **Step 3: Commit only task files**

Stage the launcher, test, README, plan, log, and regenerated dashboard artifact. Commit with:

```text
feat: rebuild dashboard before launch
```

- [ ] **Step 4: Push the current branch**

Run `git push origin main`. Verify the local branch is no longer ahead of `origin/main` and that the pushed commit is present on the remote.
