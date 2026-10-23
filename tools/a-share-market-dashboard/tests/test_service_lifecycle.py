import os
from pathlib import Path
import signal
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import Mock, patch

from scripts.local_proxy import main, serve_dashboard


class ServiceLifecycleTests(unittest.TestCase):
    def test_signals_and_interrupt_release_servers_and_restore_handlers(self):
        for stop, code in ((signal.SIGTERM, 143), (signal.SIGHUP, 129), (signal.SIGINT, 130), (None, 0)):
            with self.subTest(signal=stop):
                server = Mock(server_address=("127.0.0.1", 10001))
                todo = Mock(server_address=("127.0.0.1", 10002))
                registered = {}

                def register(signum, handler):
                    registered[signum] = handler
                    return signal.SIG_DFL

                def serve():
                    if stop == signal.SIGINT:
                        raise KeyboardInterrupt
                    if stop is not None:
                        registered[stop](stop, None)

                server.serve_forever.side_effect = serve
                with patch("scripts.local_proxy.Thread"), \
                     patch("scripts.local_proxy.signal.signal", side_effect=register) as handlers, \
                     patch("scripts.local_proxy.write_proxy_log") as logger:
                    self.assertEqual(serve_dashboard(server, todo), code)
                    logger.assert_any_call("SERVICE_STOP", pid=os.getpid(), exit_code=code)
                    if stop is not None:
                        logger.assert_any_call("SERVICE_SIGNAL", signal=signal.Signals(stop).name,
                                               pid=os.getpid(), parent_pid=os.getppid())
                    self.assertEqual(handlers.call_count, 4)
                    self.assertTrue(all(value == signal.SIG_DFL for value in registered.values()))
                todo.shutdown.assert_called_once()
                todo.server_close.assert_called_once()
                server.server_close.assert_called_once()
                server.shutdown.assert_not_called()

    def test_port_conflict_fails_instead_of_returning_success(self):
        server = Mock()
        with patch("scripts.local_proxy.create_server", side_effect=[server, OSError("port in use")]), \
             patch("builtins.print"):
            self.assertEqual(main(), 1)
        server.server_close.assert_called_once()

    @unittest.skipIf(sys.platform == "win32", "POSIX signals")
    def test_real_sigterm_exits_with_143_and_records_signal(self):
        code = '''
import sys
from pathlib import Path
from unittest.mock import patch
import scripts.local_proxy as proxy
proxy.PROXY_LOG_PATH = Path(sys.argv[1])
server = proxy.create_server(port=0)
todo = proxy.create_server(port=0)
with patch.object(proxy, "prewarm_fugui_reference_data"), patch.object(proxy, "open_and_confirm_dashboard"):
    sys.exit(proxy.serve_dashboard(server, todo))
'''
        with TemporaryDirectory() as directory:
            log = Path(directory) / "proxy.log"
            process = subprocess.Popen([sys.executable, "-u", "-c", code, str(log)],
                                       cwd=Path(__file__).resolve().parents[1],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    if log.exists() and "SERVICE_START" in log.read_text(encoding="utf-8"):
                        break
                    if process.poll() is not None:
                        self.fail(process.stderr.read().decode("utf-8"))
                    time.sleep(0.05)
                else:
                    self.fail("test service did not start")
                process.send_signal(signal.SIGTERM)
                _, errors = process.communicate(timeout=5)
                self.assertEqual(process.returncode, 143, errors.decode("utf-8"))
                events = log.read_text(encoding="utf-8")
                self.assertIn("SERVICE_SIGNAL signal=SIGTERM", events)
                self.assertIn("exit_code=143", events)
                self.assertNotIn("Traceback", errors.decode("utf-8"))
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=5)


if __name__ == "__main__":
    unittest.main()
