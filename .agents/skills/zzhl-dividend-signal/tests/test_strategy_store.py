from copy import deepcopy
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.scoring import load_default_strategy, load_strategy
from scripts.strategy_store import read_settings, save_settings, StrategyConflict
from scripts import check_signal


class StrategyStoreTest(unittest.TestCase):
    def test_applied_settings_have_versions_and_are_read_by_daily_task(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "strategy-settings.json"
            original = load_default_strategy()
            self.assertEqual(read_settings(path)["revision"], 0)
            changed = deepcopy(original)
            changed["thresholds"]["C"] = 30
            saved = save_settings(changed, 0, path)
            self.assertEqual(saved["revision"], 1)
            self.assertEqual(saved["strategy"]["version"], "dividend-two-factor-v2-r1")
            self.assertEqual(load_strategy(path), saved["strategy"])
            self.assertEqual(saved["history"][0]["strategy"], original)
            self.assertFalse(save_settings(changed, 1, path)["changed"])
            with self.assertRaises(StrategyConflict):
                save_settings(original, 0, path)
            before = path.read_bytes()
            bad = deepcopy(changed); bad["weights"]["ratio"] = 0
            with self.assertRaises(ValueError):
                save_settings(bad, 1, path)
            self.assertEqual(path.read_bytes(), before)
            restored = save_settings(original, 1, path)
            self.assertEqual(restored["revision"], 2)
            self.assertEqual(len(restored["history"]), 3)
            self.assertEqual(restored["history"][1]["strategy"], saved["strategy"])

    def test_corrupt_settings_are_reported_without_silent_default_reset(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "settings.json"
            for value in ("bad json", "null", json.dumps({"schemaVersion": 1, "revision": 1, "strategy": {}, "history": []})):
                path.write_text(value, encoding="utf-8")
                with self.assertRaises(ValueError):
                    read_settings(path)

    def test_same_day_new_strategy_preserves_previous_scores_and_workbook_results(self):
        with TemporaryDirectory() as directory:
            output = Path(directory)
            score = check_signal.Signal(
                run_date="2026-10-14", run_time="16:00:00", index_date="2026-10-13", bond_date="2026-10-13",
                akshare_dividend_yield_2=4.13, bond_10y_yield=1.67, spread=2.46,
                ytd_return=1.99, ytd_max_drawdown=-15.96, intraday_quote_date="", intraday_change_percent="",
                lixinger_date="2026-10-13", lixinger_dividend_yield="4.30", lixinger_percentile_10y="35.83",
                lixinger_percentile_80_value="5.4", lixinger_source="中证官方指数推算",
                percentile_signal="D", absolute_signal="C", spread_signal="C", headline_signal="原历史结论", source_note="test",
                strategy=load_default_strategy(), trading_dates=["2026-10-13"],
            )
            workbook = output / "中证红利每日信号.xlsx"
            old_payload = check_signal.write_score_artifact(score, output)
            check_signal.write_xlsx(score, workbook)
            old_record = deepcopy(old_payload["latest"])
            old_row = check_signal.read_rows_from_xlsx(workbook)[0]
            config = deepcopy(load_default_strategy()); config["thresholds"]["C"] = 30
            applied = save_settings(config, 0, output / "settings.json")
            score.strategy = applied["strategy"]
            payload = check_signal.write_score_artifact(score, output)
            score.headline_signal = score.scoring["label"]
            check_signal.write_xlsx(score, workbook)
            self.assertEqual(payload["records"][0], old_record)
            self.assertEqual(len(payload["records"]), 2)
            self.assertEqual(payload["latest"]["grade"], "C")
            self.assertEqual(payload["latest"]["strategySnapshot"], applied["strategy"])
            self.assertEqual(payload["latest"]["confirmation"]["count"], 0)
            self.assertEqual(check_signal.read_rows_from_xlsx(workbook)[0], old_row)
            check_signal.write_score_artifact(score, output)
            check_signal.write_xlsx(score, workbook)
            self.assertEqual(len(check_signal.read_rows_from_xlsx(workbook)), 2)
            self.assertEqual(len(json.loads((output / "评分记录.json").read_text(encoding="utf-8"))["records"]), 2)


if __name__ == "__main__":
    unittest.main()
