from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import json
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

from scripts.local_proxy import create_server


class TaskMonitorApiTest(unittest.TestCase):
    def test_monitor_reports_missing_outputs_read_only_and_rejects_custom_paths(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "tools/dashboard/page.html"
            artifact.parent.mkdir(parents=True)
            artifact.write_text("<html></html>", encoding="utf-8")
            server = create_server(port=0, dashboard_path=artifact)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            try:
                before = sorted(str(path) for path in root.rglob('*'))
                with urlopen(base + "/api/dividend-task-monitor", timeout=3) as response:
                    data = json.loads(response.read())
                self.assertEqual(data["schemaVersion"], 1)
                self.assertFalse(data["validation"]["ok"])
                self.assertEqual(len(data["validation"]["artifacts"]), 4)
                self.assertEqual(before, sorted(str(path) for path in root.rglob('*')))
                with self.assertRaises(HTTPError) as rejected:
                    urlopen(base + "/api/dividend-task-monitor?path=/tmp/other", timeout=3)
                self.assertEqual(rejected.exception.code, 400)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
