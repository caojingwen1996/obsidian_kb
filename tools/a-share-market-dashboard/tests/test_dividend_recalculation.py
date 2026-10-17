from copy import deepcopy
import importlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import zipfile

from scripts.dividend_recalculation import save_and_recalculate
from scripts.local_proxy import dividend_strategy_store, read_dividend_backtest_data, read_dividend_view_data
from tests.dividend_fixture import seed_dividend_vault


class DividendRecalculationTest(unittest.TestCase):
    def apply(self, root, strategy, revision):
        store = dividend_strategy_store()
        scoring = importlib.import_module(store.__package__ + ".scoring")
        return save_and_recalculate(strategy, revision, Path(root) / "settings.json", root, store, scoring, read_dividend_backtest_data)

    def test_updates_scores_and_view_preserving_inputs_package_features_and_backups(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            _, directory = seed_dividend_vault(root)
            workbook = directory / "中证红利每日信号.xlsx"
            before = workbook.read_bytes()
            old_rows = read_dividend_backtest_data(root)["rows"]
            strategy = deepcopy(dividend_strategy_store().read_settings(root / "settings.json")["strategy"])
            strategy["thresholds"]["B"] = 60
            applied = self.apply(root, strategy, 0)
            data = read_dividend_backtest_data(root)
            headers = data["rows"][0]
            self.assertEqual(data["rowNumbers"], [1, 2, 3, 5])
            self.assertEqual(applied["recalculation"]["updatedRows"], 2)
            self.assertEqual((root / applied["recalculation"]["backupPath"] / workbook.name).read_bytes(), before)
            for old, new in zip(old_rows[2:], data["rows"][2:]):
                for column in list(range(9)) + list(range(13, 18)):
                    self.assertEqual(old[column], new[column])
                self.assertEqual(new[headers.index("strategy_version")], applied["strategy"]["version"])
            self.assertEqual(data["rows"][2][12][0], "B")
            self.assertIn("历史重算", data["rows"][2][-1])
            view = read_dividend_view_data(root)
            self.assertEqual(view, applied["recalculation"]["view"])
            self.assertEqual(view["yieldHistory"][0]["recordDate"], "2026-01-05")
            self.assertFalse(view["payload"]["latest"]["eligible"])
            self.assertEqual(view["payload"]["latest"]["kind"], "legacy")
            with zipfile.ZipFile(workbook) as package:
                self.assertEqual(package.read("native-preserved.bin"), b"native content")
                xml = package.read("xl/worksheets/sheet1.xml").decode()
                self.assertIn('<autoFilter ref="A1:AE5"/>', xml)
                self.assertIn('topLeftCell="A3" state="frozen"', xml)
            repeated = self.apply(root, strategy, applied["revision"])
            self.assertFalse(repeated["changed"])
            self.assertEqual(repeated["recalculation"]["updatedRows"], 2)
            self.assertEqual(len(repeated["recalculation"]["view"]["payload"]["records"]), 2)

    def test_failure_during_commit_rolls_back_workbook_and_configuration(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            _, directory = seed_dividend_vault(root)
            strategy = deepcopy(dividend_strategy_store().read_settings(root / "settings.json")["strategy"])
            strategy["thresholds"]["C"] = 30
            self.apply(root, strategy, 0)
            before_settings = (root / "settings.json").read_bytes()
            strategy["thresholds"]["C"] = 35
            before = {path: path.read_bytes() for path in directory.iterdir() if path.is_file()}
            import os
            replace = os.replace
            failed = False
            def fail_once(source, destination):
                nonlocal failed
                if Path(destination).name == "评分记录.json" and not failed:
                    failed = True
                    raise OSError("locked score file")
                return replace(source, destination)
            with patch("scripts.dividend_recalculation.os.replace", side_effect=fail_once):
                with self.assertRaisesRegex(OSError, "locked"):
                    self.apply(root, strategy, 1)
            self.assertTrue(failed)
            self.assertEqual((root / "settings.json").read_bytes(), before_settings)
            for path, content in before.items():
                self.assertEqual(path.read_bytes(), content)

    def test_original_daily_record_and_source_details_remain_available(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            _, directory = seed_dividend_vault(root)
            store = dividend_strategy_store()
            scoring = importlib.import_module(store.__package__ + ".scoring")
            strategy = store.read_settings(root / "settings.json")["strategy"]
            original = scoring.score_input({"percentile": 10, "dividendYield": 4, "bondYield": 2}, strategy, {"index": "2026-01-06", "percentile": "2026-01-06", "bond": "2026-01-06"}, "source")
            original["raw"] = {"source_note": "原始官方来源 https://example.test/official", "run_time": "09:00:00"}
            (directory / "评分记录.json").write_text(json.dumps({"records": [original]}), encoding="utf-8")
            result = self.apply(root, strategy, 0)
            payload = result["recalculation"]["view"]["payload"]
            self.assertEqual(payload["records"][0], original)
            self.assertEqual(payload["latest"]["raw"]["run_time"], "09:00:00")
            markdown = (directory / "最新信号.md").read_text(encoding="utf-8")
            self.assertIn("https://example.test/official", markdown)
            self.assertIn("全年收益率：2%", markdown)
            self.assertIn("年内最大回撤：-2%", markdown)

    def test_missing_or_invalid_workbook_does_not_save_strategy(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            _, directory = seed_dividend_vault(root)
            strategy = deepcopy(dividend_strategy_store().read_settings(root / "settings.json")["strategy"])
            (directory / "中证红利每日信号.xlsx").unlink()
            with self.assertRaises(FileNotFoundError):
                self.apply(root, strategy, 0)
            self.assertFalse((root / "settings.json").exists())


if __name__ == "__main__":
    unittest.main()
