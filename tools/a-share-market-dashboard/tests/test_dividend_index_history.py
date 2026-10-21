import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch
from scripts.dividend_index_history import refresh_index_history


def row(day, close=100, code="000922"):
    return {"tradeDate": day, "close": close, "indexCode": code}


class IndexHistoryTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "中证红利指数日线.json"
        self.original = {"source": "official", "data": [row("20260602"), row("20261016", 5580.71)]}
        self.path.write_text(json.dumps(self.original), encoding="utf-8")
        self.logger = Mock()

    def refresh(self, payload, dates=("2026-10-16", "2026-10-19")):
        return refresh_index_history(self.path, dates, Mock(return_value=payload), self.logger)

    def test_merge_preserves_old_history_backs_up_and_refreshes_each_run(self):
        fetcher = Mock(return_value={"data": [row("20261019", 5623.37), row("20261016", 5580.71)]})
        for unused in range(2):
            data, update = refresh_index_history(self.path, {"2026-10-16", "2026-10-19"}, fetcher, self.logger)
        self.assertEqual(fetcher.call_count, 2)
        self.assertEqual([r["tradeDate"] for r in data["data"]], ["20260602", "20261016", "20261019"])
        self.assertEqual(data["data"][-1]["close"], 5623.37)
        self.assertEqual(update["status"], "updated")
        backups = list(self.path.parent.glob("备份/指数日线/*.json"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(json.loads(backups[0].read_text()), self.original)

    def test_missing_required_date_preserves_file(self):
        before = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, "仍缺日期 20261019"):
            self.refresh({"data": [row("20261016")]})
        self.assertEqual(self.path.read_bytes(), before)

    def test_wrong_index_and_invalid_price_never_replace_local_file(self):
        before = self.path.read_bytes()
        for record in [row("20261019", code="000300"), row("20261019", 0), row("20261019", True), row("20260230")]:
            with self.subTest(record=record), self.assertRaises(ValueError):
                self.refresh({"data": [record]})
        self.assertEqual(self.path.read_bytes(), before)

    def test_network_failure_only_falls_back_when_all_required_dates_exist(self):
        fetcher = Mock(side_effect=RuntimeError("offline"))
        data, update = refresh_index_history(self.path, {"2026-10-16"}, fetcher, self.logger)
        self.assertEqual(data, self.original)
        self.assertEqual(update["status"], "cached")
        with self.assertRaisesRegex(ValueError, "20261019"):
            refresh_index_history(self.path, {"2026-10-19"}, fetcher, self.logger)

    def test_replace_failure_preserves_original_and_removes_temporary(self):
        before = self.path.read_bytes()
        with patch("scripts.dividend_index_history.os.replace", side_effect=OSError("disk unavailable")):
            with self.assertRaises(OSError):
                self.refresh({"data": [row("20261019")]}, ("2026-10-19",))
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(list(self.path.parent.glob("*.tmp")), [])

    def test_can_create_missing_history_file(self):
        self.path.unlink()
        data, update = self.refresh({"data": [row("20261019")]}, ("2026-10-19",))
        self.assertTrue(self.path.exists())
        self.assertEqual(len(data["data"]), 1)

    def test_holiday_valuation_dates_do_not_create_fake_prices(self):
        data, update = self.refresh({"data": [row("20261019", 5623.37)]},
                                    ("2026-10-01", "2026-10-16", "2026-10-19"))
        self.assertNotIn("20261001", [record["tradeDate"] for record in data["data"]])
        self.assertEqual(update["status"], "updated")

    def test_metadata_persists_last_failure_without_changing_price_update_time(self):
        from scripts.dividend_index_history import index_history_metadata
        updated, result = self.refresh({"data": [row("20261019", 5623.37)]}, ("2026-10-19",))
        meta = index_history_metadata(self.path)
        self.assertEqual(meta["status"], "updated")
        self.assertEqual(meta["cutoffDate"], "2026-10-19")
        before = self.path.read_bytes()
        refresh_index_history(self.path, {"2026-10-19"}, Mock(side_effect=RuntimeError("offline")), self.logger)
        after = index_history_metadata(self.path)
        self.assertEqual(after["status"], "cached")
        self.assertEqual(after["fetchedAt"], meta["fetchedAt"])
        self.assertTrue(after["lastAttemptAt"])
        self.assertEqual(self.path.read_bytes(), before)
        with self.assertRaises(ValueError):
            refresh_index_history(self.path, {"2026-10-20"}, Mock(side_effect=RuntimeError("offline")), self.logger)
        self.assertEqual(index_history_metadata(self.path)["status"], "failed")

    def test_old_status_is_ignored_when_history_has_been_replaced(self):
        from scripts.dividend_index_history import index_history_metadata
        self.refresh({"data": [row("20261019", 5623.37)]}, ("2026-10-19",))
        self.path.write_text(json.dumps({**self.original,"fetchedAt":"new-file-time"}),encoding="utf-8")
        self.assertEqual(index_history_metadata(self.path)["status"], "saved")
