@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    where python >nul 2>&1
    if errorlevel 1 goto :python_missing

    echo 正在创建首次运行环境，请稍候……
    python -m venv .venv
    if errorlevel 1 goto :venv_failed

    echo 正在安装工具依赖，请稍候……
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto :install_failed
)

echo 正在启动冰冰小美风险提示工具……
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5179'"
".venv\Scripts\python.exe" run.py
set "service_exit_code=%errorlevel%"

if not "%service_exit_code%"=="0" (
    echo.
    echo 工具异常退出，请查看上方错误信息。
    pause
)
exit /b %service_exit_code%

:python_missing
echo.
echo 未找到 Python。请先安装 Python 3.11 或更高版本，再重新运行本脚本。
pause
exit /b 1

:venv_failed
echo.
echo 创建运行环境失败，请查看上方错误信息。
pause
exit /b 1

:install_failed
echo.
echo 安装工具依赖失败，请检查网络并查看上方错误信息。
pause
exit /b 1
