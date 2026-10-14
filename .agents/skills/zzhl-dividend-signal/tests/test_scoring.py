import copy
import json
import sys
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.scoring import load_default_strategy as load_strategy, score_input, interpolate, validate_strategy, grade_for_score, confirm_records
from scripts import check_signal

DATES = {"index": "2026-10-13", "percentile": "2026-10-13", "bond": "2026-10-13"}


class ScoringTest(unittest.TestCase):
    def test_shared_cases(self):
        cases = json.loads(Path(__file__).with_name("scoring-cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                result = score_input(case["input"], dates=DATES, source_key="official")
                if case["score"] is None:
                    self.assertIsNone(result["score"])
                    self.assertAlmostEqual(result["lower"], case["lower"])
                    self.assertAlmostEqual(result["upper"], case["upper"])
                else:
                    self.assertAlmostEqual(result["score"], case["score"])
                self.assertEqual(result["grade"], case["grade"])
                for item, expected in zip(result["components"].values(), case["components"]):
                    self.assertIsNone(item["score"]) if expected is None else self.assertAlmostEqual(item["score"], expected)

    def test_anchors_boundaries_and_invalid_numbers(self):
        strategy = load_strategy()
        for points in strategy["anchors"].values():
            for x, score in points:
                self.assertEqual(interpolate(x, points)["score"], score)
        self.assertEqual(grade_for_score(39.99999, strategy), "D")
        self.assertEqual(grade_for_score(59.99999, strategy), "C")
        self.assertEqual(grade_for_score(79.99999, strategy), "B")
        for value in (float("nan"), float("inf"), True, "4"):
            result = score_input({"percentile": value, "dividendYield": value, "bondYield": value})
            self.assertIsNone(result["score"])
        result = score_input({"percentile": 80, "dividendYield": 6, "bondYield": 1.5}, dates=dict(DATES, bond="2026-10-12"), reference=True)
        self.assertIn("参考评分", result["quality"])
        self.assertIn("日期未对齐", result["quality"])
        self.assertFalse(result["eligible"])

    def test_strategy_validation(self):
        self.assertEqual(validate_strategy(load_strategy()), [])
        for field, value in [("weights", {"percentile": 0, "absolute": 30, "ratio": 25}), ("thresholds", {"C": 60, "B": 40, "A": 80}), ("confirmationDays", 0)]:
            config = copy.deepcopy(load_strategy()); config[field] = value
            self.assertTrue(validate_strategy(config))
        config = load_strategy(); config["anchors"]["ratio"][1] = [1, 40]
        self.assertTrue(validate_strategy(config))

    def test_confirmation_calendar_deduplication_and_context(self):
        calendar = ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]
        def record(day, grade="B", source="official", eligible=True, version="v1"):
            return {"dates": {"index": day}, "grade": grade, "sourceKey": source, "eligible": eligible, "strategyVersion": version}
        base = [record(d) for d in calendar[:3]]
        self.assertEqual(confirm_records(base, calendar)["status"], "established")
        self.assertEqual(confirm_records(base + [record(calendar[2])], calendar)["status"], "established")
        self.assertEqual(confirm_records(base[:1] + base[2:], calendar)["count"], 1)
        changed = base + [record(d, "A") for d in calendar[3:]]
        self.assertEqual(confirm_records(changed, calendar)["status"], "changed")
        self.assertEqual(confirm_records(changed[:-1] + [record(calendar[-1], "C")], calendar)["count"], 1)
        self.assertIsNone(confirm_records(base + [record(calendar[3], source="proxy")], calendar)["baseline"])
        self.assertIsNone(confirm_records(base + [record(calendar[3], version="v2")], calendar)["baseline"])
        self.assertEqual(confirm_records(base + [record(calendar[3], eligible=False)], calendar)["status"], "insufficient")
        self.assertIsNone(confirm_records(base + [record(calendar[3], source="proxy", eligible=False)], calendar)["baseline"])
        self.assertEqual(confirm_records(base, [calendar[0]])["status"], "insufficient")

    def test_daily_outputs_preserve_legacy_results_and_deduplicate_score_dates(self):
        fields = {
            "run_date": "2026-10-12", "run_time": "16:00:00", "index_date": "2026-10-09", "bond_date": "2026-10-09",
            "akshare_dividend_yield_2": 4.13, "bond_10y_yield": 1.67, "spread": 2.46,
            "ytd_return": 1.99, "ytd_max_drawdown": -15.96, "intraday_quote_date": "", "intraday_change_percent": "",
            "lixinger_date": "2026-10-09", "lixinger_dividend_yield": "4.30", "lixinger_percentile_10y": "35.83",
            "lixinger_percentile_80_value": "5.40", "lixinger_source": "中证官方指数推算",
            "percentile_signal": "D", "absolute_signal": "C", "spread_signal": "C",
            "headline_signal": "旧结论必须保留", "source_note": "中证官方指数推算",
        }
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            old = check_signal.Signal(**fields)
            workbook = output / "中证红利每日信号.xlsx"
            check_signal.write_xlsx(old, workbook)
            old_row = check_signal.read_rows_from_xlsx(workbook)[0]
            check_signal.write_markdown(old, output / "最新信号.md")
            md_before, xlsx_before = (output / "最新信号.md").read_bytes(), workbook.read_bytes()
            snapshot = check_signal.snapshot_from_local(output)
            self.assertEqual(snapshot["latest"]["kind"], "snapshot")
            self.assertEqual((output / "最新信号.md").read_bytes(), md_before)
            self.assertEqual(workbook.read_bytes(), xlsx_before)
            current = check_signal.Signal(**dict(fields, run_date="2026-10-14", index_date="2026-10-13", bond_date="2026-10-13", lixinger_date="2026-10-13"))
            current.trading_dates = ["2026-10-09", "2026-10-12", "2026-10-13"]
            current.scoring = check_signal.score_signal(current)
            current.headline_signal = current.scoring["label"]
            check_signal.write_score_artifact(current, output)
            payload = check_signal.write_score_artifact(current, output)
            self.assertEqual(len([r for r in payload["records"] if r["dates"]["index"] == "2026-10-13"]), 1)
            self.assertEqual(payload["latest"]["confirmation"]["count"], 1)
            check_signal.write_xlsx(current, workbook)
            rows = check_signal.read_rows_from_xlsx(workbook)
            self.assertEqual(rows[0], old_row)
            self.assertAlmostEqual(rows[1]["composite_score"], 38.04406946107784)
            self.assertEqual(rows[1]["composite_grade"], "D")
            check_signal.write_markdown(current, output / "latest-v1.md")
            self.assertIn("综合分：38.0", (output / "latest-v1.md").read_text(encoding="utf-8"))

    def test_fetch_uses_v1_without_rounding_percentile_before_scoring(self):
        import pandas as pd
        from datetime import datetime
        history = pd.DataFrame({"date": ["2026-10-09", "2026-10-12", "2026-10-13"], "close": [100, 101, 102]})
        with patch.object(check_signal, "import_akshare", return_value=object()), \
             patch.object(check_signal, "fetch_index_valuation", return_value=check_signal.IndexValuation("2026-10-13", 6, "test", "test")), \
             patch.object(check_signal, "fetch_csindex_index_history", return_value=history), \
             patch.object(check_signal, "get_intraday_realtime_quote", return_value=check_signal.IntradayQuote("2026-10-14", None, "test", "test")), \
             patch.object(check_signal, "fetch_bond_yield", return_value=check_signal.BondYield("2026-10-13", 1.5, "test", "test")), \
             patch.object(check_signal, "fetch_lixinger_percentile", return_value=check_signal.LixingerPercentile("2026-10-13", 6, 80.004, 6, "test", "test")):
            signal = check_signal.fetch_signal(target_run_date=datetime(2026, 10, 14))
        self.assertEqual(signal.scoring["input"]["percentile"], 80.004)
        self.assertEqual(signal.scoring["grade"], "A")
        self.assertEqual(signal.absolute_signal, "A")
        self.assertEqual(signal.headline_signal, "重点配置区间")
        self.assertEqual(signal.trading_dates, ["2026-10-09", "2026-10-12", "2026-10-13"])


if __name__ == "__main__":
    unittest.main()
