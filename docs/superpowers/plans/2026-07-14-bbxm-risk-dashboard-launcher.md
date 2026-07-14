# 冰冰小美风险提示工具启动脚本实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个可双击运行的 `启动工具.bat`，首次运行自动建立环境并安装依赖，后续直接启动风险提示工具。

**Architecture:** 批处理脚本始终先切换到自身目录，以 `.venv\Scripts\python.exe` 是否存在判断是否需要初始化。浏览器由独立的短延迟命令打开，Flask 服务仍在当前窗口前台运行并保留原始错误输出。

**Tech Stack:** Windows Batch、Python venv、pip、Flask、pytest

---

### Task 1: 启动脚本契约测试

**Files:**
- Create: `tools/bbxm-risk-dashboard/tests/test_launcher.py`

- [ ] **Step 1: 写失败测试**

  新增测试，按 UTF-8 读取 `启动工具.bat`，断言脚本包含：切换自身目录、检测 Python、按需创建 `.venv`、安装 `requirements.txt`、延迟打开 `http://127.0.0.1:5179`、前台运行 `run.py`，并在失败时暂停。

- [ ] **Step 2: 运行测试并确认失败原因**

  Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_launcher.py -v`

  Expected: FAIL，原因是 `tools/bbxm-risk-dashboard/启动工具.bat` 尚不存在。

### Task 2: 最小启动脚本实现

**Files:**
- Create: `tools/bbxm-risk-dashboard/启动工具.bat`

- [ ] **Step 1: 实现脚本**

  使用 `cd /d "%~dp0"` 定位目录；用 `where python` 检查解释器；仅在虚拟环境解释器不存在时执行 `python -m venv .venv` 和 `.venv\Scripts\python.exe -m pip install -r requirements.txt`；用独立命令延迟两秒打开浏览器；最后以前台方式执行 `.venv\Scripts\python.exe run.py`。每个初始化失败分支显示中文提示并 `pause`。

- [ ] **Step 2: 运行启动脚本契约测试**

  Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_launcher.py -v`

  Expected: PASS。

- [ ] **Step 3: 运行全量测试**

  Run: `python -m pytest tools/bbxm-risk-dashboard/tests -v`

  Expected: 现有测试与新增测试全部通过。

### Task 3: 使用说明与维护记录

**Files:**
- Modify: `tools/bbxm-risk-dashboard/README.md`
- Modify: `log.md`

- [ ] **Step 1: 更新使用说明**

  在 README 的运行说明中把双击 `启动工具.bat` 作为 Windows 用户的首选方式，并保留原有手动命令供排错使用。

- [ ] **Step 2: 追加维护日志**

  在 `log.md` 的 2026-07-14 条目中记录新增启动脚本、测试和说明文件，不改动其他已有条目。

### Task 4: 实际启动验证

**Files:**
- Verify: `tools/bbxm-risk-dashboard/启动工具.bat`

- [ ] **Step 1: 验证脚本可从目录外调用**

  从仓库根目录启动批处理并轮询 `http://127.0.0.1:5179/api/dashboard`，确认返回 HTTP 200；验证结束后只终止本次启动的进程。

- [ ] **Step 2: 验证虚拟环境复用**

  记录 `.venv` 解释器修改时间，再次启动脚本，确认修改时间不变且服务仍可访问。

- [ ] **Step 3: 最终检查**

  重新运行全量 pytest；检查 `git diff --check`；检查暂存文件列表仅包含本任务文件后提交。
