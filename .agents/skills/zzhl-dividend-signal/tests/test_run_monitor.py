import copy
from datetime import datetime
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from xml.sax.saxutils import escape
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import check_signal
from scripts.run_monitor import RunMonitor, SHANGHAI, inspect_outputs, monitor_payload, read_json
from scripts.scoring import load_default_strategy, score_input

TODAY = "2026-10-21"
NOW = datetime(2026, 10, 21, 12, 0, tzinfo=SHANGHAI)


def seed_outputs(directory, missing_quote=False):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    strategy = copy.deepcopy(load_default_strategy())
    strategy["version"] = "dividend-two-factor-v2-r5"
    score = score_input({"dividendYield": 4.18, "bondYield": 1.6354}, strategy=strategy)["score"]
    latest = {"recordDate": TODAY, "strategyVersion": strategy["version"], "strategySnapshot": strategy,
              "input": {"dividendYield": 4.18, "bondYield": 1.6354}, "score": score, "grade": "C",
              "dates": {"index": "2026-10-20", "bond": "2026-10-20"},
              "raw": {"run_date": TODAY, "run_time": "11:59:00", "intraday_quote_date": "" if missing_quote else TODAY,
                      "intraday_change_percent": "" if missing_quote else "-0.83"}}
    data = {"strategy": strategy, "latest": latest, "records": [latest]}
    (directory / "评分记录.json").write_text(json.dumps(data), encoding="utf-8")
    (directory / "策略参数.json").write_text(json.dumps({"schemaVersion": 1, "revision": 5, "strategy": strategy,
        "history": [{"revision": 5, "strategy": strategy}]}), encoding="utf-8")
    (directory / "最新信号.md").write_text(f"运行时间：{TODAY} 11:59:00\n策略版本：{strategy['version']}", encoding="utf-8")
    (directory / "中证红利年度表现.json").write_text(json.dumps({"indexCode": "000922", "lastDate": "2026-10-20", "rows": [{"monthly_returns": [{"month": 1, "return": 1}]}]}), encoding="utf-8")
    headers = ["run_date__record_date", "strategy_version", "composite_score", "composite_grade", "index_date__index_valuation_date", "bond_date__china_10y_yield_date", "akshare_dividend_yield_2", "bond_10y_yield"]
    values = [TODAY, strategy["version"], str(score), "C", "2026-10-20", "2026-10-20", "4.18", "1.6354"]
    rows = []
    for number, row in [(1, headers), (2, ["中文表头"]), (3, values)]:
        cells = ''.join(f'<c r="{chr(65+i)}{number}" t="inlineStr"><is><t>{escape(value)}</t></is></c>' for i, value in enumerate(row))
        rows.append(f'<row r="{number}">{cells}</row>')
    with zipfile.ZipFile(directory / "中证红利每日信号.xlsx", "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(rows) + '</sheetData></worksheet>')
    return data


class RunMonitorTest(unittest.TestCase):
    def test_previous_trading_day_is_valid_and_legacy_is_not_execution(self):
        with TemporaryDirectory() as folder:
            seed_outputs(folder)
            before = {p.name: p.read_bytes() for p in Path(folder).iterdir()}
            payload = monitor_payload(folder, NOW)
            self.assertTrue(payload["validation"]["ok"])
            self.assertEqual(payload["current"]["status"], "verified")
            self.assertEqual(payload["current"]["startedAt"], "")
            self.assertEqual(before, {p.name: p.read_bytes() for p in Path(folder).iterdir()})

    def test_missing_optional_quote_is_warning_and_required_file_fails(self):
        with TemporaryDirectory() as folder:
            seed_outputs(folder, missing_quote=True)
            self.assertEqual(monitor_payload(folder, NOW)["current"]["status"], "verified-warning")
            Path(folder, "中证红利年度表现.json").unlink()
            payload = monitor_payload(folder, NOW)
            self.assertFalse(payload["validation"]["ok"])
            self.assertEqual(payload["current"]["status"], "partial")

    def test_missing_receipt_before_and_after_grace_including_weekend(self):
        with TemporaryDirectory() as folder:
            before = datetime(2026, 10, 24, 9, 15, tzinfo=SHANGHAI)
            after = before.replace(hour=10)
            self.assertEqual(monitor_payload(folder, before)["current"]["status"], "pending")
            self.assertEqual(monitor_payload(folder, after)["current"]["status"], "overdue")

    def test_begin_live_heartbeat_failure_and_rerun_are_preserved(self):
        with TemporaryDirectory() as folder, patch("scripts.run_monitor.local_now", return_value=NOW):
            seed_outputs(folder)
            failed = RunMonitor(folder, TODAY)
            self.assertEqual(monitor_payload(folder, NOW)["current"]["status"], "running")
            failed.stage("获取指数估值")
            failed.finish(RuntimeError("source unavailable"))
            failed_bytes = failed.path.read_bytes()
            again = RunMonitor(folder, TODAY)
            again.written("评分记录.json")
            self.assertEqual(again.finish()["status"], "success")
            self.assertEqual(failed.path.read_bytes(), failed_bytes)
            attempts = [item for item in monitor_payload(folder, NOW)["history"] if item["source"] == "execution"]
            self.assertEqual(len(attempts), 2)
            self.assertEqual({item["status"] for item in attempts}, {"failed", "success"})

    def test_stale_running_and_corrupt_receipt_never_become_success(self):
        with TemporaryDirectory() as folder, patch("scripts.run_monitor.local_now", return_value=NOW):
            seed_outputs(folder)
            run = RunMonitor(folder, TODAY)
            try:
                with patch("scripts.run_monitor.process_alive", return_value=False):
                    self.assertEqual(monitor_payload(folder, NOW)["current"]["status"], "unconfirmed")
            finally:
                run.finish(RuntimeError("interrupted"))
            Path(folder, "运行记录/broken.json").write_text("bad json", encoding="utf-8")
            self.assertEqual(monitor_payload(folder, NOW)["current"]["status"], "unconfirmed")

    def test_write_failure_is_partial_and_strategy_mismatch_fails_validation(self):
        with TemporaryDirectory() as folder, patch("scripts.run_monitor.local_now", return_value=NOW):
            seed_outputs(folder)
            run = RunMonitor(folder, TODAY)
            run.written("评分记录.json")
            self.assertEqual(run.finish(OSError("Excel locked"))["status"], "partial")
            config = read_json(Path(folder, "策略参数.json"))
            config["strategy"]["weights"] = {"absolute": 90, "ratio": 10}
            Path(folder, "策略参数.json").write_text(json.dumps(config), encoding="utf-8")
            validation = inspect_outputs(folder, TODAY)
            self.assertFalse(next(c for c in validation["checks"] if c["key"] == "strategy")["ok"])

    def test_daily_entry_records_early_fetch_failure_without_overwriting_outputs(self):
        with TemporaryDirectory() as folder:
            seed_outputs(folder)
            before = Path(folder, "评分记录.json").read_bytes()
            with patch.object(sys, "argv", ["check_signal.py", "--run-date", TODAY, "--output-dir", folder]), patch.object(check_signal, "fetch_signal", side_effect=RuntimeError("missing dependency")):
                with self.assertRaisesRegex(RuntimeError, "missing dependency"):
                    check_signal.main()
            records = list(Path(folder, "运行记录").glob("*.json"))
            self.assertEqual(len(records), 1)
            self.assertEqual(read_json(records[0])["status"], "failed")
            self.assertEqual(Path(folder, "评分记录.json").read_bytes(), before)

    def test_malformed_score_is_reported_without_crashing(self):
        with TemporaryDirectory() as folder:
            seed_outputs(folder)
            Path(folder, "评分记录.json").write_text('{"latest":{"raw":[],"dates":[]}}', encoding="utf-8")
            self.assertFalse(inspect_outputs(folder, TODAY)["ok"])

    def test_exit_before_excel_write_leaves_partial_receipt(self):
        with TemporaryDirectory() as folder:
            seed_outputs(folder)
            with patch.object(sys, "argv", ["check_signal.py", "--run-date", TODAY, "--output-dir", folder]), patch.object(check_signal, "fetch_signal", return_value=object()), patch.object(check_signal, "write_score_artifact"), patch.object(check_signal, "write_xlsx", side_effect=OSError("Excel locked")):
                with self.assertRaisesRegex(OSError, "Excel locked"):
                    check_signal.main()
            record = read_json(next(Path(folder, "运行记录").glob("*.json")))
            self.assertEqual(record["status"], "partial")
            self.assertEqual(record["stage"], "写入每日信号Excel")

    def test_tampered_score_and_broken_strategy_history_do_not_pass(self):
        with TemporaryDirectory() as folder:
            seed_outputs(folder)
            path = Path(folder, "评分记录.json")
            score = read_json(path)
            score["latest"]["score"] = 99
            path.write_text(json.dumps(score), encoding="utf-8")
            checks = inspect_outputs(folder, TODAY)["checks"]
            self.assertFalse(next(c for c in checks if c["key"] == "score-math")["ok"])
            settings_path = Path(folder, "策略参数.json")
            settings = read_json(settings_path)
            settings["history"] = []
            settings_path.write_text(json.dumps(settings), encoding="utf-8")
            checks = inspect_outputs(folder, TODAY)["checks"]
            self.assertFalse(next(c for c in checks if c["key"] == "strategy")["ok"])


if __name__ == "__main__":
    unittest.main()
