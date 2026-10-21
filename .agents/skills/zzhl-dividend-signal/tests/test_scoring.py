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
    def test_zero_weight_percentile_is_optional(self):
        strategy = copy.deepcopy(load_strategy())
        strategy["weights"] = {"percentile": 0, "absolute": 92, "ratio": 8}
        dates = {"index": "2026-07-01", "bond": "2026-07-01", "percentile": "2027-01-01"}
        result = score_input({"dividendYield": 5, "bondYield": 2}, strategy, dates)
        self.assertAlmostEqual(result["score"], 61.6)
        self.assertTrue(result["eligible"])
        self.assertEqual(result["sourceKey"], "股息率与股债倍数")
        dates["bond"] = "2026-06-30"
        self.assertFalse(score_input({"dividendYield": 5, "bondYield": 2}, strategy, dates)["eligible"])

    def test_shared_cases(self):
        cases = json.loads(Path(__file__).with_name("scoring-cases-v2.json").read_text(encoding="utf-8"))
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
        self.assertEqual(grade_for_score(47.99999, strategy), "C")
        self.assertEqual(grade_for_score(64.99999, strategy), "B")
        for value in (float("nan"), float("inf"), True, "4"):
            result = score_input({"percentile": value, "dividendYield": value, "bondYield": value})
            self.assertIsNone(result["score"])
        result = score_input({"percentile": 80, "dividendYield": 6, "bondYield": 1.5}, dates=dict(DATES, bond="2026-10-12"), reference=True)
        self.assertNotIn("参考评分", result["quality"])
        self.assertIn("日期未对齐", result["quality"])
        self.assertFalse(result["eligible"])

    def test_strategy_validation(self):
        self.assertEqual(validate_strategy(load_strategy()), [])
        for field, value in [("weights", {"absolute": 30, "ratio": 25}), ("thresholds", {"C": 60, "B": 40, "A": 80}), ("confirmationDays", 0)]:
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
        with tempfile.TemporaryDirectory() as temp, patch.object(check_signal, "load_strategy", side_effect=load_strategy):
            output = Path(temp)
            old = check_signal.Signal(**fields)
            workbook = output / "中证红利每日信号.xlsx"
            check_signal.write_xlsx(old, workbook)
            old_row = check_signal.read_rows_from_xlsx(workbook)[0]
            check_signal.write_markdown(old, output / "最新信号.md")
            md_before, xlsx_before = (output / "最新信号.md").read_bytes(), workbook.read_bytes()
            snapshot = check_signal.snapshot_from_local(output)
            self.assertEqual(snapshot["latest"]["kind"], "snapshot")
            self.assertTrue((output / "历史归档" / "V1参考快照.md").is_file())
            self.assertFalse((output / "V1参考快照.md").exists())
            self.assertEqual((output / "最新信号.md").read_bytes(), md_before)
            self.assertEqual(workbook.read_bytes(), xlsx_before)
            current = check_signal.Signal(**dict(fields, run_date="2026-10-14", index_date="2026-10-13", bond_date="2026-10-13", lixinger_date="2026-10-13"))
            current.trading_dates = ["2026-10-09", "2026-10-12", "2026-10-13"]
            current.scoring = check_signal.score_signal(current)
            current.headline_signal = current.scoring["label"]
            check_signal.write_score_artifact(current, output)
            payload = check_signal.write_score_artifact(current, output)
            self.assertEqual(len([r for r in payload["records"] if r["dates"]["index"] == "2026-10-13"]), 1)
            self.assertEqual(payload["latest"]["confirmation"]["count"], 0)
            check_signal.write_xlsx(current, workbook)
            rows = check_signal.read_rows_from_xlsx(workbook)
            self.assertEqual(rows[0], old_row)
            self.assertAlmostEqual(rows[1]["composite_score"], 45.50577245508982)
            self.assertEqual(rows[1]["composite_grade"], "C")
            check_signal.write_markdown(current, output / "latest-v1.md")
            self.assertIn("综合分：45.5", (output / "latest-v1.md").read_text(encoding="utf-8"))
            self.assertIn("仅综合评级 A 可买入，B / C / D 均不买入", (output / "latest-v1.md").read_text(encoding="utf-8"))

    def test_fetch_uses_two_factors_without_fetching_percentile(self):
        import pandas as pd
        from datetime import datetime
        history = pd.DataFrame({"date": ["2026-10-09", "2026-10-12", "2026-10-13"], "close": [100, 101, 102]})
        with patch.object(check_signal, "import_akshare", return_value=object()), \
             patch.object(check_signal, "fetch_index_valuation", return_value=check_signal.IndexValuation("2026-10-13", 6, "test", "test")), \
             patch.object(check_signal, "fetch_csindex_index_history", return_value=history), \
             patch.object(check_signal, "get_intraday_realtime_quote", return_value=check_signal.IntradayQuote("2026-10-14", None, "test", "test")), \
             patch.object(check_signal, "fetch_bond_yield", return_value=check_signal.BondYield("2026-10-13", 1.5, "test", "test")), \
             patch.object(check_signal, "fetch_lixinger_percentile", side_effect=AssertionError("retired fetch must not run")) as retired_fetch:
            signal = check_signal.fetch_signal(target_run_date=datetime(2026, 10, 14))
        retired_fetch.assert_not_called()
        self.assertNotIn("percentile", signal.scoring["input"])
        self.assertEqual(signal.scoring["grade"], "A")
        self.assertEqual(signal.absolute_signal, "A")
        self.assertEqual(signal.headline_signal, "买入区间")
        self.assertEqual(signal.trading_dates, ["2026-10-09", "2026-10-12", "2026-10-13"])

    def test_only_composite_a_highlights_daily_rows(self):
        strategy = load_strategy()
        for dividend_yield, grade, label in [(6, "A", "买入区间"), (5, "B", "观察区间"), (4.1, "C", "等待区间"), (3, "D", "不买入")]:
            with self.subTest(grade=grade):
                result = score_input({"dividendYield": dividend_yield, "bondYield": 2}, strategy, DATES)
                self.assertEqual(result["grade"], grade)
                self.assertEqual(result["label"], label)
                self.assertEqual(check_signal.should_highlight_signal_row({"strategy_version": strategy["version"], "composite_grade": grade}), grade == "A")
        self.assertFalse(check_signal.should_highlight_signal_row({"absolute_signal": "A", "spread_signal": "A"}))
        for grade in ("B", "C", "D"):
            self.assertNotIn("买入", check_signal.display_signal_grade(grade))


if __name__ == "__main__":
    unittest.main()
