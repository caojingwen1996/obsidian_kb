import subprocess
import unittest
from tempfile import TemporaryDirectory
from pathlib import Path
from unittest.mock import patch
from threading import Event, Thread
from types import SimpleNamespace
from urllib.request import urlopen
from scripts.local_proxy import open_dashboard_browser, open_and_confirm_dashboard, create_server, regular_chrome_command


class BrowserLaunchTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.log_path = Path(temp.name) / "proxy.log"
        patcher = patch("scripts.local_proxy.PROXY_LOG_PATH", self.log_path)
        patcher.start()
        self.addCleanup(patcher.stop)

    def events(self):
        return self.log_path.read_text(encoding="utf-8")

    @patch("scripts.local_proxy.webbrowser.open")
    @patch("scripts.local_proxy.subprocess.run")
    @patch("scripts.local_proxy.sys.platform", "darwin")
    def test_mac_uses_system_opener(self, run, browser):
        self.assertTrue(open_dashboard_browser("http://127.0.0.1:49888/"))
        self.assertEqual(run.call_args.args[0], ["/usr/bin/open", "http://127.0.0.1:49888/"])
        browser.assert_not_called()
        self.assertIn("BROWSER_OPEN_ACCEPTED method=macos-open", self.events())

    @patch("scripts.local_proxy.webbrowser.open", return_value=True)
    @patch("scripts.local_proxy.subprocess.run", side_effect=subprocess.TimeoutExpired("open", 10))
    @patch("scripts.local_proxy.sys.platform", "darwin")
    def test_timeout_falls_back(self, run, browser):
        self.assertTrue(open_dashboard_browser("http://127.0.0.1:49888/"))
        browser.assert_called_once()
        self.assertIn("TimeoutExpired", self.events())
        self.assertIn("BROWSER_OPEN_FALLBACK", self.events())
        self.assertIn("BROWSER_OPEN_ACCEPTED method=python-webbrowser", self.events())

    @patch("scripts.local_proxy.write_proxy_log")
    @patch("builtins.print")
    @patch("scripts.local_proxy.webbrowser.open", return_value=False)
    @patch("scripts.local_proxy.sys.platform", "linux")
    def test_failure_displays_manual_url(self, browser, output, logger):
        self.assertFalse(open_dashboard_browser("http://127.0.0.1:49888/"))
        logger.assert_any_call("BROWSER_OPEN_FAILED", method="python-webbrowser", url="http://127.0.0.1:49888/", result=False)
        output.assert_called_with("未能自动打开浏览器，请手动打开：http://127.0.0.1:49888/")


    @patch("scripts.local_proxy.open_dashboard_browser", return_value=True)
    @patch("scripts.local_proxy.regular_chrome_command", return_value=["chrome", "--user-data-dir=regular", "--profile-directory=Default", "--new-window", "url"])
    @patch("scripts.local_proxy.subprocess.Popen")
    @patch("scripts.local_proxy.sys.platform", "darwin")
    def test_mac_prefers_regular_profile_new_window(self, process, command, opener):
        from unittest.mock import Mock
        arrived = Mock()
        arrived.wait.return_value = True
        server = SimpleNamespace(server_address=("127.0.0.1", 49888),
                                 browser_launch_token="test-launch", browser_page_requested=arrived)
        self.assertTrue(open_and_confirm_dashboard(server))
        process.assert_called_once()
        opener.assert_not_called()
        self.assertIn("BROWSER_OPEN_CONFIRMED method=regular-chrome-profile", self.events())

    @patch("scripts.local_proxy.open_dashboard_browser", return_value=True)
    @patch("scripts.local_proxy.regular_chrome_command", return_value=None)
    @patch("scripts.local_proxy.sys.platform", "darwin")
    def test_accepted_without_page_request_is_not_success(self, command, opener):
        from unittest.mock import Mock
        arrived = Mock()
        arrived.wait.return_value = False
        server = SimpleNamespace(server_address=("127.0.0.1", 49888),
                                 browser_launch_token="test-launch", browser_page_requested=arrived)
        self.assertFalse(open_and_confirm_dashboard(server))
        self.assertNotIn("BROWSER_OPEN_CONFIRMED", self.events())

    def test_only_matching_launch_marks_page_request(self):
        artifact = self.log_path.parent / "dashboard.html"
        artifact.write_text("<html><body>Test dashboard</body></html>", encoding="utf-8")
        server = create_server(port=0, dashboard_path=artifact)
        server.browser_launch_token = "expected-launch"
        server.browser_page_requested = Event()
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_address[1]}/"
        for suffix in ["", "?launch=another-launch"]:
            with urlopen(url + suffix) as response:
                self.assertEqual(response.status, 200)
            self.assertFalse(server.browser_page_requested.is_set())
        with urlopen(url + "?launch=expected-launch") as response:
            response.read()
        self.assertTrue(server.browser_page_requested.wait(1))
        self.assertIn("BROWSER_PAGE_REQUESTED", self.events())

    def test_regular_profile_command_never_uses_automation_directory(self):
        with patch("scripts.local_proxy.Path.is_file", return_value=True), \
             patch("scripts.local_proxy.Path.is_dir", return_value=True), \
             patch("scripts.local_proxy.Path.read_bytes", return_value=b'data'), \
             patch("scripts.local_proxy.plistlib.loads", return_value={"LSHandlers":[{"LSHandlerURLScheme":"http","LSHandlerRoleAll":"com.google.chrome"}]}), \
             patch("scripts.local_proxy.Path.read_text", return_value='{"profile":{"last_used":"Profile 2"}}'):
            command = regular_chrome_command("http://127.0.0.1:49888/")
        self.assertIn("--profile-directory=Profile 2", command)
        self.assertIn("--new-window", command)
        self.assertTrue(any("Library/Application Support/Google/Chrome" in value for value in command))
        self.assertFalse(any(".xueqiu" in value for value in command))

    @patch("scripts.local_proxy.open_dashboard_browser", return_value=True)
    @patch("scripts.local_proxy.regular_chrome_command", return_value=["chrome", "--user-data-dir=regular", "--profile-directory=Default", "--new-window", "url"])
    @patch("scripts.local_proxy.subprocess.Popen", side_effect=OSError("launch failed"))
    @patch("scripts.local_proxy.sys.platform", "darwin")
    def test_regular_chrome_error_falls_back(self, process, command, opener):
        from unittest.mock import Mock
        arrived = Mock()
        arrived.wait.return_value = True
        server = SimpleNamespace(server_address=("127.0.0.1", 49888),
                                 browser_launch_token="test-launch", browser_page_requested=arrived)
        self.assertTrue(open_and_confirm_dashboard(server))
        opener.assert_called_once()
        self.assertIn("launch failed", self.events())
        self.assertIn("BROWSER_OPEN_FALLBACK method=default-browser", self.events())

    def test_other_default_browser_is_respected(self):
        with patch("scripts.local_proxy.Path.is_file", return_value=True), \
             patch("scripts.local_proxy.Path.is_dir", return_value=True), \
             patch("scripts.local_proxy.Path.read_bytes", return_value=b'data'), \
             patch("scripts.local_proxy.plistlib.loads", return_value={"LSHandlers":[{"LSHandlerURLScheme":"http","LSHandlerRoleAll":"com.apple.Safari"}]}):
            self.assertIsNone(regular_chrome_command("http://127.0.0.1:49888/"))


if __name__ == "__main__":
    unittest.main()
