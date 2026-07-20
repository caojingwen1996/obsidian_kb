@echo off
setlocal
cd /d "%~dp0"

set "DASHBOARD_NODE="
where node >nul 2>nul
if not errorlevel 1 goto :system_node

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%CODEX_NODE%" set "DASHBOARD_NODE=%CODEX_NODE%"
if defined DASHBOARD_NODE goto :build

echo 未找到 Node.js，无法重新构建大盘面板。
pause
goto :eof

:system_node
set "DASHBOARD_NODE=node"

:build
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
