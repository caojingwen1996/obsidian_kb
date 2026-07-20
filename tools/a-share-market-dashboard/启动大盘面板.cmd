@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if not errorlevel 1 goto :python
where py >nul 2>nul
if not errorlevel 1 goto :py
echo 未找到 Python 3，请先安装 Python 3。
pause
goto :eof

:python
python scripts\local_proxy.py
goto :eof

:py
py -3 scripts\local_proxy.py
goto :eof
