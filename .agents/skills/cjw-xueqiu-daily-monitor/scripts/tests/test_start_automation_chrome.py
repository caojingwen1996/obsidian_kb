from __future__ import annotations

import os
import sys
import subprocess
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def bash_path(path: Path) -> str:
    text = str(path)
    drive = path.drive.rstrip(":").lower()
    if drive and os.name == "nt":
        tail = text[len(path.drive) :].replace("\\", "/").lstrip("/")
        return f"/mnt/{drive}/{tail}"
    return text


def bash_is_available() -> bool:
    result = subprocess.run(
        ["bash", "-lc", "exit 0"],
        check=False,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


class StartAutomationChromeScriptTests(unittest.TestCase):
    def test_script_exists_and_uses_fixed_profile_and_port(self) -> None:
        script_path = PROJECT_ROOT / "scripts" / "start_automation_chrome.sh"
        text = script_path.read_text(encoding="utf-8")

        self.assertIn(".xueqiu-automation-profile", text)
        self.assertIn('DEFAULT_DEBUG_PORT="9333"', text)
        self.assertIn("/json/version", text)
        self.assertIn("already running", text)
        self.assertIn("open", text)
        self.assertIn("-g -n -a", text)

    def test_script_supports_dry_run_for_fixed_launch_command(self) -> None:
        if not bash_is_available():
            self.skipTest("bash is installed but no runnable shell environment is available")
        script_path = PROJECT_ROOT / "scripts" / "start_automation_chrome.sh"
        with tempfile.TemporaryDirectory() as tmpdir:
            chrome_path = Path(tmpdir) / "chrome"
            chrome_path.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            chrome_path.chmod(0o755)

            result = subprocess.run(
                ["bash", bash_path(script_path)],
                cwd=PROJECT_ROOT,
                env={
                    **os.environ,
                    "DRY_RUN": "1",
                    "CHROME_PATH": str(chrome_path),
                },
                check=False,
                capture_output=True,
                text=True,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--remote-debugging-port=9333", result.stdout)
        self.assertIn(".xueqiu-automation-profile", result.stdout)

    @unittest.skipUnless(sys.platform == "darwin", "macOS launch behavior")
    def test_script_opens_isolated_macos_bundle_in_background(self) -> None:
        if not bash_is_available():
            self.skipTest("bash is installed but no runnable shell environment is available")
        script_path = PROJECT_ROOT / "scripts" / "start_automation_chrome.sh"

        with tempfile.TemporaryDirectory() as tmpdir:
            chrome_path = Path(tmpdir) / "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
            chrome_path.parent.mkdir(parents=True)
            chrome_path.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            chrome_path.chmod(0o755)
            result = subprocess.run(
                ["bash", bash_path(script_path)],
                cwd=PROJECT_ROOT,
                env={**os.environ, "DRY_RUN": "1", "CHROME_PATH": str(chrome_path), "XUEQIU_CHROME_HEADLESS": "0"},
                check=False,
                capture_output=True,
                text=True,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("open -g -n -a", result.stdout)
        self.assertIn("Google\\ Chrome\\ for\\ Testing.app", result.stdout)
        self.assertIn("--remote-debugging-port=9333", result.stdout)

    @unittest.skipUnless(sys.platform == "darwin", "macOS isolation guard")
    def test_script_rejects_personal_chrome_even_with_explicit_override(self) -> None:
        result = subprocess.run(
            ["bash", str(PROJECT_ROOT / "scripts/start_automation_chrome.sh")],
            env={**os.environ, "DRY_RUN": "1", "CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"},
            check=False, capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Personal Google Chrome cannot be used", result.stderr)

    def test_headless_dry_run_uses_direct_binary_and_does_not_create_profile(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            chrome_path = Path(tmpdir) / "chrome"
            chrome_path.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            chrome_path.chmod(0o755)
            profile = Path(tmpdir) / "new-profile"
            result = subprocess.run(
                ["bash", str(PROJECT_ROOT / "scripts/start_automation_chrome.sh")],
                env={**os.environ, "DRY_RUN": "1", "CHROME_PATH": str(chrome_path), "XUEQIU_CHROME_HEADLESS": "1", "XUEQIU_CHROME_PROFILE_DIR": str(profile)},
                check=False, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("--headless=new", result.stdout)
            self.assertNotIn("open -g", result.stdout)
            self.assertFalse(profile.exists())


if __name__ == "__main__":
    unittest.main()
