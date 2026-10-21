from contextlib import contextmanager
from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from scripts.local_proxy import create_server, dividend_strategy_store
from tests.dividend_fixture import seed_dividend_vault


@contextmanager
def strategy_server(directory, use_default_path=False):
    dashboard, _ = seed_dividend_vault(directory)
    options = {} if use_default_path else {"dividend_strategy_path": Path(directory) / "settings.json"}
    server = create_server(port=0, dashboard_path=dashboard, **options)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=3)


def request_json(url, payload=None, origin=None):
    headers = {"Content-Type": "application/json"}
    if origin:
        headers["Origin"] = origin
    request = Request(url, data=json.dumps(payload).encode("utf-8") if payload is not None else None, headers=headers)
    with urlopen(request, timeout=3) as response:
        return json.loads(response.read())


class DividendStrategyApiTest(unittest.TestCase):
    def test_default_path_migrates_and_saves_next_to_workbook(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            store = dividend_strategy_store()
            old = root / store.LEGACY_SETTINGS_RELATIVE_PATH
            new = root / store.SETTINGS_RELATIVE_PATH
            config = deepcopy(store.read_settings(old)["strategy"])
            config["thresholds"]["A"] = 67
            store.save_settings(config, 0, old)
            before = old.read_bytes()
            with strategy_server(directory, use_default_path=True) as base:
                endpoint = base + "/api/dividend-strategy"
                initial = request_json(endpoint)
                self.assertEqual(initial["revision"], 1)
                self.assertEqual(new.read_bytes(), before)
                config["thresholds"]["A"] = 68
                saved = request_json(endpoint, {"strategy": config, "expectedRevision": 1})
                self.assertEqual(saved["revision"], 2)
                self.assertEqual(store.read_settings(new)["strategy"], saved["strategy"])
                backup = root / saved["recalculation"]["backupPath"] / new.name
                self.assertEqual(backup.read_bytes(), before)
                self.assertFalse(old.exists())

    def test_read_apply_conflict_and_history(self):
        with TemporaryDirectory() as directory, strategy_server(directory) as base:
            endpoint = base + "/api/dividend-strategy"
            initial = request_json(endpoint)
            self.assertEqual(initial["revision"], 0)
            config = deepcopy(initial["strategy"]); config["thresholds"]["C"] = 30
            saved = request_json(endpoint, {"strategy": config, "expectedRevision": 0}, origin=base)
            self.assertEqual(saved["revision"], 1)
            self.assertEqual(saved["strategy"]["thresholds"]["C"], 30)
            self.assertEqual(saved["recalculation"]["updatedRows"], 2)
            view = request_json(base + "/api/dividend-view-data")
            self.assertEqual(view["payload"]["strategy"], saved["strategy"])
            self.assertTrue(view["yieldHistory"][0]["headline"].startswith("B"))
            self.assertEqual(view["yieldHistory"][0]["recordDate"], "2026-01-05")
            self.assertEqual(request_json(endpoint)["history"][0]["strategy"], initial["strategy"])
            with self.assertRaises(HTTPError) as conflict:
                request_json(endpoint, {"strategy": config, "expectedRevision": 0}, origin=base)
            self.assertEqual(conflict.exception.code, 409)
            self.assertEqual(json.loads(conflict.exception.read())["settings"]["revision"], 1)
            with self.assertRaises(HTTPError) as forbidden:
                request_json(endpoint, {"strategy": config, "expectedRevision": 1}, origin="https://example.com")
            self.assertEqual(forbidden.exception.code, 403)

    def test_invalid_or_failed_save_keeps_configuration(self):
        with TemporaryDirectory() as directory, strategy_server(directory) as base:
            endpoint = base + "/api/dividend-strategy"
            config = request_json(endpoint)["strategy"]
            config["thresholds"]["C"] = 30
            request_json(endpoint, {"strategy": config, "expectedRevision": 0})
            path = Path(directory) / "settings.json"
            before = path.read_bytes()
            config["weights"]["ratio"] = 0
            with self.assertRaises(HTTPError) as invalid:
                request_json(endpoint, {"strategy": config, "expectedRevision": 1})
            self.assertEqual(invalid.exception.code, 400)
            self.assertEqual(path.read_bytes(), before)
            config["weights"]["ratio"] = 8
            config["thresholds"]["C"] = 35
            with patch("pathlib.Path.replace", side_effect=OSError("write failed")):
                with self.assertRaises(HTTPError) as failed:
                    request_json(endpoint, {"strategy": config, "expectedRevision": 1})
                self.assertEqual(failed.exception.code, 500)
            self.assertEqual(path.read_bytes(), before)
            path.write_text("bad json", encoding="utf-8")
            with self.assertRaises(HTTPError) as corrupt:
                request_json(endpoint)
            self.assertEqual(corrupt.exception.code, 500)


if __name__ == "__main__":
    unittest.main()
