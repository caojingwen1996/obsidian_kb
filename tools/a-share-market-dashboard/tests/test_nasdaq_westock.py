import sys
import json
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from nasdaq_westock import fetch_chart, parse_table
from local_proxy import fetch_nasdaq100_snapshot


class WeStockNasdaqTests(unittest.TestCase):
    def runner(self, args, **kwargs):
        if args[2] == "quote":
            return SimpleNamespace(stdout="| symbol | price | time |\n|---|---|---|\n| usNDX | 110 | 2026-09-10 |")
        return SimpleNamespace(stdout="| date | last |\n|---|---|\n| 2026-09-10 | 110 |\n| 2026-09-09 | 100 |")

    def test_cli_uses_unadjusted_dated_closes(self):
        chart = fetch_chart("node", runner=self.runner)
        row = chart["chart"]["result"][0]
        self.assertEqual(row["indicators"]["quote"][0]["close"], [100, 110])
        self.assertEqual(row["meta"]["regularMarketPrice"], 110)

    def test_malformed_table_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_table("| date | last |\n|---|---|\n| 2026-09-10 |")

    def test_primary_labels_source_and_does_not_invent_pe(self):
        chart = fetch_chart("node", runner=self.runner)
        with patch("nasdaq_westock.fetch_chart", return_value=chart):
            result = fetch_nasdaq100_snapshot()
        self.assertIn("westock", result["proxySource"])
        self.assertEqual(result["data"]["dayChangePercent"], 10)
        self.assertIsNone(result["data"]["peTtm"])

    def test_primary_failure_uses_yahoo(self):
        with patch("nasdaq_westock.fetch_chart", side_effect=ValueError("missing")), \
             patch("local_proxy.fetch_yahoo_nasdaq100_snapshot", return_value={"data": {}}) as fallback:
            result = fetch_nasdaq100_snapshot()
        fallback.assert_called_once()
        self.assertIn("备用", result["data"]["quoteNote"])

    def test_package_launch_loads_primary_without_scripts_on_sys_path(self):
        chart = fetch_chart("node", runner=self.runner)
        code = '''
import json, sys
from unittest.mock import patch
from scripts.local_proxy import fetch_nasdaq100_snapshot
chart = json.loads(sys.stdin.read())
with patch("scripts.nasdaq_westock.fetch_chart", return_value=chart), \\
     patch("scripts.local_proxy.fetch_yahoo_nasdaq100_snapshot", side_effect=AssertionError("unexpected fallback")):
    result = fetch_nasdaq100_snapshot()
assert "westock" in result["proxySource"]
assert result["data"]["currentPoint"] == 110
'''
        result = subprocess.run([sys.executable, "-c", code], input=json.dumps(chart),
                                cwd=Path(__file__).resolve().parents[1], capture_output=True,
                                text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_import_failure_uses_existing_fallback(self):
        with patch("nasdaq_westock.fetch_chart", side_effect=ImportError("dependency missing")), \
             patch("local_proxy.fetch_yahoo_nasdaq100_snapshot", return_value={"data": {}}) as fallback:
            result = fetch_nasdaq100_snapshot()
        fallback.assert_called_once()
        self.assertIn("备用", result["data"]["quoteNote"])
