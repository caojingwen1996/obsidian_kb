from pathlib import Path


LAUNCHER = Path(__file__).resolve().parents[1] / "启动工具.bat"


def test_launcher_bootstraps_and_runs_dashboard_from_its_own_directory():
    script = LAUNCHER.read_text(encoding="utf-8").lower()

    assert 'cd /d "%~dp0"' in script
    assert 'if not exist ".venv\\scripts\\python.exe"' in script
    assert "where python" in script
    assert "python -m venv .venv" in script
    assert '".venv\\scripts\\python.exe" -m pip install -r requirements.txt' in script
    assert "http://127.0.0.1:5179" in script
    assert "start-sleep -seconds 2" in script
    assert '".venv\\scripts\\python.exe" run.py' in script
    assert "pause" in script


def test_launcher_uses_windows_line_endings_required_by_cmd():
    raw_script = LAUNCHER.read_bytes()

    assert b"\r\n" in raw_script
    assert raw_script.count(b"\n") == raw_script.count(b"\r\n")
